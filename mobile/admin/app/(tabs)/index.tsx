import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Pusher from "pusher-js";
import { api } from "@/lib/api";
import { PUSHER_KEY, PUSHER_CLUSTER } from "@/lib/config";
import type { Stats, Delivery, Courier } from "@/lib/types";

function StatCard({
  emoji, label, value, sub, color, onPress,
}: {
  emoji: string; label: string; value: number | string;
  sub?: string; color: string; onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.statCard, { borderLeftColor: color }]} onPress={onPress} activeOpacity={onPress ? 0.75 : 1}>
      <View style={styles.statCardTop}>
        <Text style={styles.statEmoji}>{emoji}</Text>
        <Text style={[styles.statValue, { color }]}>{value}</Text>
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      {sub && <Text style={styles.statSub}>{sub}</Text>}
    </TouchableOpacity>
  );
}

export default function DashboardScreen() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentDeliveries, setRecentDeliveries] = useState<Delivery[]>([]);
  const [activeCouriers, setActiveCouriers] = useState<Courier[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    const [s, deliveries, couriers] = await Promise.all([
      api.getStats(),
      api.getDeliveries(),
      api.getCouriers(),
    ]);
    if (s) setStats(s);
    setRecentDeliveries(deliveries.filter((d) => d.status === "pending").slice(0, 5));
    setActiveCouriers(couriers.filter((c) => c.status !== "offline"));
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const pusher = new Pusher(PUSHER_KEY, { cluster: PUSHER_CLUSTER });
    const ch = pusher.subscribe("lakou-admin");
    ch.bind("deliveries-updated", fetchAll);
    ch.bind("delivery-new", fetchAll);
    ch.bind("couriers-updated", fetchAll);
    return () => { ch.unbind_all(); pusher.disconnect(); };
  }, [fetchAll]);

  const handleStatusAction = async (deliveryId: string, action: string, courierId?: string) => {
    await api.updateDelivery(deliveryId, action, courierId);
    fetchAll();
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Lakou Delivery</Text>
          <Text style={styles.headerSub}>Administration</Text>
        </View>
        <TouchableOpacity
          style={styles.newDeliveryBtn}
          onPress={() => router.push("/new-delivery")}
          activeOpacity={0.8}
        >
          <Text style={styles.newDeliveryBtnText}>+ Nouvelle course</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll(); }} tintColor="#2563eb" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <StatCard emoji="⏳" label="En attente" value={stats?.pendingDeliveries ?? 0} color="#f59e0b" onPress={() => router.push("/deliveries")} />
          <StatCard emoji="🚀" label="En cours" value={stats?.activeDeliveries ?? 0} color="#3b82f6" onPress={() => router.push("/deliveries")} />
          <StatCard emoji="✅" label="Livrées aujourd'hui" value={stats?.deliveredToday ?? 0} color="#22c55e" />
          <StatCard emoji="🏍️" label="Coursiers actifs" value={stats?.activeCouriers ?? 0} sub={`/ ${stats?.totalCouriers ?? 0} total`} color="#8b5cf6" onPress={() => router.push("/couriers")} />
          {(stats?.activeAlerts ?? 0) > 0 && (
            <StatCard emoji="🚨" label="Alertes actives" value={stats!.activeAlerts} color="#ef4444" />
          )}
        </View>

        {/* Active couriers */}
        {activeCouriers.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Coursiers en service</Text>
              <TouchableOpacity onPress={() => router.push("/couriers")}>
                <Text style={styles.sectionLink}>Voir tout →</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.courierChips}>
              {activeCouriers.map((c) => (
                <View
                  key={c.id}
                  style={[styles.courierChip, { borderColor: c.status === "busy" ? "#3b82f6" : c.status === "available" ? "#22c55e" : "#f59e0b" }]}
                >
                  <View style={[styles.courierChipDot, { backgroundColor: c.status === "busy" ? "#3b82f6" : c.status === "available" ? "#22c55e" : "#f59e0b" }]} />
                  <Text style={styles.courierChipName}>{c.name}</Text>
                  <Text style={styles.courierChipStat}>{c.deliveredToday} auj.</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Pending deliveries */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Courses en attente</Text>
            <TouchableOpacity onPress={() => router.push("/deliveries")}>
              <Text style={styles.sectionLink}>Gérer →</Text>
            </TouchableOpacity>
          </View>
          {recentDeliveries.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>✅</Text>
              <Text style={styles.emptyText}>Aucune course en attente</Text>
            </View>
          ) : (
            recentDeliveries.map((d) => (
              <View key={d.id} style={[styles.deliveryRow, d.priority === 2 && styles.deliveryRowUrgent]}>
                <View style={styles.deliveryRowLeft}>
                  <Text style={styles.deliveryCategory}>
                    {d.priority === 2 ? "🔴" : d.priority === 1 ? "🟠" : "📦"}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.deliveryName} numberOfLines={1}>{d.customerName}</Text>
                    <Text style={styles.deliveryAddr} numberOfLines={1}>{d.deliveryAddress}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.assignQuickBtn}
                  onPress={() => router.push("/deliveries")}
                >
                  <Text style={styles.assignQuickBtnText}>Assigner</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  centered: { flex: 1, backgroundColor: "#f8fafc", justifyContent: "center", alignItems: "center", gap: 10 },
  loadingText: { color: "#6b7280" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  headerSub: { fontSize: 12, color: "#94a3b8", marginTop: 1 },
  newDeliveryBtn: { backgroundColor: "#2563eb", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  newDeliveryBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 20 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: { flex: 1, minWidth: "45%", backgroundColor: "#fff", borderRadius: 16, padding: 14, borderLeftWidth: 4, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  statCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  statEmoji: { fontSize: 22 },
  statValue: { fontSize: 28, fontWeight: "800" },
  statLabel: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  statSub: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  section: { gap: 10 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  sectionLink: { fontSize: 13, color: "#2563eb", fontWeight: "600" },
  courierChips: { gap: 8, paddingBottom: 4 },
  courierChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fff", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1.5, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  courierChipDot: { width: 7, height: 7, borderRadius: 4 },
  courierChipName: { fontSize: 13, fontWeight: "600", color: "#1e293b" },
  courierChipStat: { fontSize: 11, color: "#94a3b8" },
  emptyBox: { backgroundColor: "#fff", borderRadius: 16, padding: 28, alignItems: "center", gap: 8 },
  emptyIcon: { fontSize: 36 },
  emptyText: { color: "#94a3b8", fontSize: 14 },
  deliveryRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 14, padding: 12, gap: 10, borderWidth: 1, borderColor: "#f1f5f9", shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  deliveryRowUrgent: { borderColor: "#fecaca", backgroundColor: "#fff5f5" },
  deliveryRowLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  deliveryCategory: { fontSize: 22 },
  deliveryName: { fontSize: 14, fontWeight: "600", color: "#1e293b" },
  deliveryAddr: { fontSize: 12, color: "#94a3b8", marginTop: 1 },
  assignQuickBtn: { backgroundColor: "#eff6ff", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  assignQuickBtnText: { color: "#2563eb", fontWeight: "700", fontSize: 12 },
});
