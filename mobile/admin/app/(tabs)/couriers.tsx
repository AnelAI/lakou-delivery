import { useState, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Linking, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Pusher from "pusher-js";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { api } from "@/lib/api";
import { PUSHER_KEY, PUSHER_CLUSTER, API_BASE } from "@/lib/config";
import type { Courier } from "@/lib/types";

const STATUS_META: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  available: { label: "Disponible",  color: "#14532d", bg: "#dcfce7", dot: "#22c55e" },
  busy:      { label: "En course",   color: "#1e40af", bg: "#dbeafe", dot: "#3b82f6" },
  paused:    { label: "En pause",    color: "#713f12", bg: "#fef9c3", dot: "#eab308" },
  offline:   { label: "Hors ligne",  color: "#374151", bg: "#f3f4f6", dot: "#9ca3af" },
};

export default function CouriersScreen() {
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCouriers = useCallback(async () => {
    const data = await api.getCouriers();
    setCouriers(data);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchCouriers();
    const pusher = new Pusher(PUSHER_KEY, { cluster: PUSHER_CLUSTER });
    const ch = pusher.subscribe("lakou-admin");
    ch.bind("couriers-updated", fetchCouriers);
    ch.bind("courier-location-update", fetchCouriers);
    return () => { ch.unbind_all(); pusher.disconnect(); };
  }, [fetchCouriers]);

  const activeCount  = couriers.filter((c) => c.status !== "offline").length;
  const busyCount    = couriers.filter((c) => c.status === "busy").length;
  const deliveredSum = couriers.reduce((sum, c) => sum + c.deliveredToday, 0);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🏍️ Coursiers</Text>
        <View style={styles.headerStats}>
          <View style={styles.headerStat}>
            <Text style={styles.headerStatNum}>{activeCount}</Text>
            <Text style={styles.headerStatLabel}>actifs</Text>
          </View>
          <View style={styles.headerStatDivider} />
          <View style={styles.headerStat}>
            <Text style={[styles.headerStatNum, { color: "#3b82f6" }]}>{busyCount}</Text>
            <Text style={styles.headerStatLabel}>en course</Text>
          </View>
          <View style={styles.headerStatDivider} />
          <View style={styles.headerStat}>
            <Text style={[styles.headerStatNum, { color: "#22c55e" }]}>{deliveredSum}</Text>
            <Text style={styles.headerStatLabel}>livrées auj.</Text>
          </View>
        </View>
      </View>

      <FlatList
        data={couriers}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchCouriers(); }} tintColor="#2563eb" />}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>🏍️</Text>
            <Text style={styles.emptyText}>Aucun coursier enregistré</Text>
          </View>
        }
        renderItem={({ item }) => {
          const meta = STATUS_META[item.status] ?? STATUS_META.offline;
          return (
            <View style={styles.card}>
              {/* Left accent bar */}
              <View style={[styles.cardAccent, { backgroundColor: meta.dot }]} />

              <View style={styles.cardContent}>
                {/* Top row */}
                <View style={styles.cardTop}>
                  <View style={[styles.avatar, { backgroundColor: meta.dot }]}>
                    <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.courierName}>{item.name}</Text>
                    <TouchableOpacity onPress={() => Linking.openURL(`tel:${item.phone}`)}>
                      <Text style={styles.courierPhone}>📞 {item.phone}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                    <View style={[styles.statusDot, { backgroundColor: meta.dot }]} />
                    <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>

                {/* Stats row */}
                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>{item.deliveredToday}</Text>
                    <Text style={styles.statLabel}>Auj.</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>{item.deliveredCount}</Text>
                    <Text style={styles.statLabel}>Total</Text>
                  </View>
                  {item.lastSeen && item.status !== "offline" && (
                    <View style={styles.statBox}>
                      <Text style={[styles.statValue, { fontSize: 11, color: "#22c55e" }]}>
                        {formatDistanceToNow(new Date(item.lastSeen), { addSuffix: true, locale: fr })}
                      </Text>
                      <Text style={styles.statLabel}>Vu</Text>
                    </View>
                  )}
                </View>

                {/* GPS indicator */}
                {item.currentLat && item.currentLng && item.status !== "offline" && (
                  <View style={styles.gpsRow}>
                    <View style={styles.gpsActiveDot} />
                    <Text style={styles.gpsText}>
                      GPS actif · {item.currentLat.toFixed(4)}, {item.currentLng.toFixed(4)}
                    </Text>
                  </View>
                )}

                {/* Actions */}
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.detailBtn}
                    onPress={() => Linking.openURL(`${API_BASE}/couriers/${item.id}`)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.detailBtnText}>📊 Voir détail</Text>
                  </TouchableOpacity>
                  {item.status !== "offline" && (
                    <TouchableOpacity
                      style={styles.mapBtn}
                      onPress={() => Linking.openURL(`${API_BASE}?focus=${item.id}`)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.mapBtnText}>🗺️ Sur carte</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: { paddingHorizontal: 16, paddingVertical: 14, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f1f5f9", gap: 12 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  headerStats: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerStat: { alignItems: "center" },
  headerStatNum: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  headerStatLabel: { fontSize: 10, color: "#94a3b8", fontWeight: "600", textTransform: "uppercase" },
  headerStatDivider: { width: 1, height: 24, backgroundColor: "#e2e8f0" },
  list: { padding: 12, gap: 10 },
  emptyBox: { alignItems: "center", paddingVertical: 60, gap: 10 },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: "#94a3b8", fontSize: 15 },
  card: { flexDirection: "row", backgroundColor: "#fff", borderRadius: 18, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardAccent: { width: 5 },
  cardContent: { flex: 1, padding: 14, gap: 10 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  avatar: { width: 46, height: 46, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  avatarText: { color: "#fff", fontSize: 20, fontWeight: "700" },
  courierName: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  courierPhone: { fontSize: 13, color: "#2563eb", marginTop: 2 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "700" },
  statsRow: { flexDirection: "row", gap: 12 },
  statBox: { backgroundColor: "#f8fafc", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, alignItems: "center", minWidth: 56 },
  statValue: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  statLabel: { fontSize: 10, color: "#94a3b8", fontWeight: "600", textTransform: "uppercase", marginTop: 1 },
  gpsRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  gpsActiveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#22c55e" },
  gpsText: { fontSize: 11, color: "#64748b", fontFamily: "monospace" },
  cardActions: { flexDirection: "row", gap: 8 },
  detailBtn: { flex: 1, backgroundColor: "#eff6ff", borderRadius: 12, paddingVertical: 9, alignItems: "center" },
  detailBtnText: { color: "#2563eb", fontWeight: "700", fontSize: 13 },
  mapBtn: { flex: 1, backgroundColor: "#f0fdf4", borderRadius: 12, paddingVertical: 9, alignItems: "center" },
  mapBtnText: { color: "#15803d", fontWeight: "700", fontSize: 13 },
});
