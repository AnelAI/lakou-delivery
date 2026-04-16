import { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Pusher from "pusher-js";
import { API_BASE, PUSHER_KEY, PUSHER_CLUSTER } from "@/lib/config";

interface TrackData {
  orderNumber: string;
  customerName: string;
  status: "pending" | "assigned" | "picked_up" | "delivered" | "cancelled";
  pickupAddress: string;
  deliveryAddress: string;
  priority: number;
  courier: { name: string; phone: string | null } | null;
  createdAt: string;
  assignedAt: string | null;
  deliveredAt: string | null;
}

const STEPS = [
  { key: "pending",   label: "Commande reçue",   icon: "📋" },
  { key: "assigned",  label: "Coursier assigné",  icon: "🏍️" },
  { key: "picked_up", label: "Colis récupéré",   icon: "📦" },
  { key: "delivered", label: "Livré !",           icon: "✅" },
];
const STATUS_ORDER = { pending: 0, assigned: 1, picked_up: 2, delivered: 3, cancelled: -1 };

export default function TrackScreen() {
  const { orderNumber } = useLocalSearchParams<{ orderNumber: string }>();
  const [data, setData] = useState<TrackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const fetchOrder = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/track/${orderNumber}`);
      if (res.ok) setData(await res.json());
      else setNotFound(true);
    } catch { setNotFound(true); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchOrder();
    const pusher = new Pusher(PUSHER_KEY, { cluster: PUSHER_CLUSTER });
    const ch = pusher.subscribe("lakou-admin");
    ch.bind("deliveries-updated", fetchOrder);
    ch.bind("delivery-new", fetchOrder);
    return () => { ch.unbind_all(); pusher.unsubscribe("lakou-admin"); };
  }, [orderNumber]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#f97316" />
        <Text style={styles.loadingText}>Chargement de votre commande...</Text>
      </View>
    );
  }

  if (notFound || !data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.notFoundIcon}>🔍</Text>
        <Text style={styles.notFoundText}>Commande introuvable</Text>
        <Text style={styles.notFoundSub}>Vérifiez le numéro de commande.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const stepIdx = STATUS_ORDER[data.status];
  const isCancelled = data.status === "cancelled";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Suivi de commande</Text>
        <Text style={styles.headerNum}>#{data.orderNumber.slice(-6)}</Text>
      </View>

      <View style={styles.content}>
        {isCancelled ? (
          <View style={styles.cancelledBox}>
            <Text style={styles.cancelledIcon}>❌</Text>
            <Text style={styles.cancelledTitle}>Commande annulée</Text>
            <Text style={styles.cancelledSub}>Cette commande a été annulée.</Text>
          </View>
        ) : (
          <>
            {/* Big status */}
            <View style={styles.bigStatus}>
              <Text style={styles.bigStatusIcon}>{STEPS[Math.max(0, stepIdx)].icon}</Text>
              <Text style={styles.bigStatusLabel}>{STEPS[Math.max(0, stepIdx)].label}</Text>
              {data.status === "delivered" && (
                <Text style={styles.bigStatusSub}>Merci de votre confiance ! 🎉</Text>
              )}
              {data.status === "pending" && (
                <Text style={styles.bigStatusSub}>En attente d'assignation...</Text>
              )}
              {data.status === "assigned" && data.courier && (
                <Text style={styles.bigStatusSub}>{data.courier.name} se dirige vers le marchand</Text>
              )}
              {data.status === "picked_up" && data.courier && (
                <Text style={styles.bigStatusSub}>{data.courier.name} est en route !</Text>
              )}
            </View>

            {/* Steps */}
            <View style={styles.steps}>
              {STEPS.map((step, i) => {
                const done = i <= stepIdx;
                const current = i === stepIdx;
                return (
                  <View key={step.key} style={styles.stepRow}>
                    <View style={styles.stepLeft}>
                      <View style={[styles.stepDot, done ? styles.stepDotDone : styles.stepDotPending, current && styles.stepDotCurrent]}>
                        <Text style={styles.stepDotIcon}>{done ? "✓" : step.icon}</Text>
                      </View>
                      {i < STEPS.length - 1 && (
                        <View style={[styles.stepLine, done && i < stepIdx ? styles.stepLineDone : styles.stepLinePending]} />
                      )}
                    </View>
                    <Text style={[styles.stepLabel, done ? styles.stepLabelDone : styles.stepLabelPending]}>
                      {step.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Details */}
        <View style={styles.detailCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>👤</Text>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Client</Text>
              <Text style={styles.detailValue}>{data.customerName}</Text>
            </View>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>📍</Text>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Collecte</Text>
              <Text style={styles.detailValue}>{data.pickupAddress}</Text>
            </View>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>🏠</Text>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Livraison</Text>
              <Text style={styles.detailValue}>{data.deliveryAddress}</Text>
            </View>
          </View>
          {data.courier && (
            <View style={styles.detailRow}>
              <Text style={styles.detailIcon}>🏍️</Text>
              <View style={[styles.detailContent, { flex: 1 }]}>
                <Text style={styles.detailLabel}>Coursier</Text>
                <Text style={styles.detailValue}>{data.courier.name}</Text>
              </View>
              {data.courier.phone && (
                <TouchableOpacity
                  style={styles.callBtn}
                  onPress={() => Linking.openURL(`tel:${data.courier!.phone}`)}
                >
                  <Text style={styles.callBtnText}>📞 Appeler</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        <TouchableOpacity onPress={() => router.replace("/")} style={styles.homeBtn}>
          <Text style={styles.homeBtnText}>← Retour à l'accueil</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  centered: { flex: 1, backgroundColor: "#f9fafb", justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { color: "#6b7280" },
  notFoundIcon: { fontSize: 52 },
  notFoundText: { fontSize: 18, fontWeight: "700", color: "#374151" },
  notFoundSub: { fontSize: 14, color: "#9ca3af" },
  backButton: { backgroundColor: "#f97316", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  backButtonText: { color: "#fff", fontWeight: "700" },
  header: { backgroundColor: "#fff", flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f3f4f6", gap: 8 },
  backBtn: { padding: 4 },
  backBtnText: { fontSize: 22, color: "#374151" },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: "#111827" },
  headerNum: { fontSize: 13, color: "#9ca3af", fontFamily: "monospace" },
  content: { flex: 1, padding: 16, gap: 16 },
  cancelledBox: { alignItems: "center", backgroundColor: "#fff", borderRadius: 20, padding: 32, gap: 8 },
  cancelledIcon: { fontSize: 48 },
  cancelledTitle: { fontSize: 18, fontWeight: "700", color: "#374151" },
  cancelledSub: { color: "#9ca3af" },
  bigStatus: { backgroundColor: "#fff", borderRadius: 20, padding: 24, alignItems: "center", gap: 6, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  bigStatusIcon: { fontSize: 52, marginBottom: 4 },
  bigStatusLabel: { fontSize: 20, fontWeight: "800", color: "#111827" },
  bigStatusSub: { fontSize: 13, color: "#6b7280", textAlign: "center" },
  steps: { backgroundColor: "#fff", borderRadius: 20, padding: 20, gap: 0, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  stepLeft: { alignItems: "center", width: 32 },
  stepDot: { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  stepDotDone: { backgroundColor: "#f97316" },
  stepDotPending: { backgroundColor: "#f3f4f6" },
  stepDotCurrent: { borderWidth: 2, borderColor: "#f97316", backgroundColor: "#fff7ed" },
  stepDotIcon: { fontSize: 14 },
  stepLine: { width: 2, height: 28, marginTop: 2 },
  stepLineDone: { backgroundColor: "#f97316" },
  stepLinePending: { backgroundColor: "#e5e7eb" },
  stepLabel: { flex: 1, fontSize: 15, paddingVertical: 6, fontWeight: "500" },
  stepLabelDone: { color: "#111827" },
  stepLabelPending: { color: "#9ca3af" },
  detailCard: { backgroundColor: "#fff", borderRadius: 20, padding: 16, gap: 12, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  detailRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  detailIcon: { fontSize: 18, marginTop: 1 },
  detailContent: {},
  detailLabel: { fontSize: 11, color: "#9ca3af", fontWeight: "500", marginBottom: 1 },
  detailValue: { fontSize: 14, color: "#111827", fontWeight: "500" },
  callBtn: { backgroundColor: "#eff6ff", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  callBtnText: { color: "#2563eb", fontWeight: "600", fontSize: 13 },
  homeBtn: { alignItems: "center", paddingVertical: 8 },
  homeBtnText: { color: "#f97316", fontWeight: "600", fontSize: 14 },
});
