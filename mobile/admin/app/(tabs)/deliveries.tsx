import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, Modal, FlatList, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Pusher from "pusher-js";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { api } from "@/lib/api";
import { PUSHER_KEY, PUSHER_CLUSTER } from "@/lib/config";
import type { Delivery, Courier } from "@/lib/types";

const TABS = [
  { id: "pending",   label: "Attente",    dot: "#f59e0b" },
  { id: "active",    label: "En cours",   dot: "#3b82f6" },
  { id: "history",   label: "Historique", dot: "#9ca3af" },
] as const;
type TabId = typeof TABS[number]["id"];

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: "En attente",  color: "#92400e", bg: "#fef3c7" },
  assigned:  { label: "Assignée",    color: "#1e40af", bg: "#dbeafe" },
  picked_up: { label: "En route",    color: "#5b21b6", bg: "#ede9fe" },
  delivered: { label: "Livrée",      color: "#14532d", bg: "#dcfce7" },
  cancelled: { label: "Annulée",     color: "#374151", bg: "#f3f4f6" },
};
const CATEGORY_EMOJI: Record<string, string> = {
  restaurant: "🍽️", patisserie: "🧁", boucherie: "🥩", volaillerie: "🐔",
  fromagerie: "🧀", supermarche: "🛒", pharmacie: "💊", eau: "💧", course: "📦",
};

export default function DeliveriesScreen() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [tab, setTab] = useState<TabId>("pending");
  const [refreshing, setRefreshing] = useState(false);
  const [assignModal, setAssignModal] = useState<Delivery | null>(null);

  const fetchAll = useCallback(async () => {
    const [d, c] = await Promise.all([api.getDeliveries(), api.getCouriers()]);
    setDeliveries(d);
    setCouriers(c);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const pusher = new Pusher(PUSHER_KEY, { cluster: PUSHER_CLUSTER });
    const ch = pusher.subscribe("lakou-admin");
    ch.bind("deliveries-updated", fetchAll);
    ch.bind("delivery-new", fetchAll);
    return () => { ch.unbind_all(); pusher.disconnect(); };
  }, [fetchAll]);

  const doAction = async (deliveryId: string, action: string, courierId?: string) => {
    const ok = await api.updateDelivery(deliveryId, action, courierId);
    if (ok) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      fetchAll();
    }
  };

  const confirmCancel = (deliveryId: string) => {
    Alert.alert("Annuler la course ?", "Cette action est irréversible.", [
      { text: "Annuler", style: "cancel" },
      { text: "Confirmer", style: "destructive", onPress: () => doAction(deliveryId, "cancel") },
    ]);
  };

  const pending  = deliveries.filter((d) => d.status === "pending");
  const active   = deliveries.filter((d) => ["assigned", "picked_up"].includes(d.status));
  const history  = deliveries.filter((d) => ["delivered", "cancelled"].includes(d.status));
  const list = tab === "pending" ? pending : tab === "active" ? active : history;

  const availableCouriers = couriers.filter((c) => ["available", "busy"].includes(c.status));

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📦 Courses</Text>
        <View style={styles.countersRow}>
          <View style={[styles.counter, { backgroundColor: "#fef3c7" }]}>
            <Text style={[styles.counterNum, { color: "#92400e" }]}>{pending.length}</Text>
            <Text style={styles.counterLabel}>attente</Text>
          </View>
          <View style={[styles.counter, { backgroundColor: "#dbeafe" }]}>
            <Text style={[styles.counterNum, { color: "#1e40af" }]}>{active.length}</Text>
            <Text style={styles.counterLabel}>cours</Text>
          </View>
          <View style={[styles.counter, { backgroundColor: "#dcfce7" }]}>
            <Text style={[styles.counterNum, { color: "#14532d" }]}>{history.filter((d) => d.status === "delivered").length}</Text>
            <Text style={styles.counterLabel}>livrées</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {TABS.map((t) => {
          const count = t.id === "pending" ? pending.length : t.id === "active" ? active.length : history.length;
          return (
            <TouchableOpacity
              key={t.id}
              style={[styles.tab, tab === t.id && styles.tabActive]}
              onPress={() => setTab(t.id)}
            >
              <Text style={[styles.tabLabel, tab === t.id && styles.tabLabelActive]}>{t.label}</Text>
              {count > 0 && (
                <View style={[styles.tabBadge, { backgroundColor: t.dot }]}>
                  <Text style={styles.tabBadgeText}>{count > 9 ? "9+" : count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* List */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll(); }} tintColor="#2563eb" />}
        showsVerticalScrollIndicator={false}
      >
        {list.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>{tab === "pending" ? "⏳" : tab === "active" ? "🏍️" : "✅"}</Text>
            <Text style={styles.emptyText}>
              {tab === "pending" ? "Aucune course en attente" : tab === "active" ? "Aucune course en cours" : "Aucun historique"}
            </Text>
          </View>
        ) : (
          list.map((delivery) => {
            const meta = STATUS_META[delivery.status] ?? STATUS_META.pending;
            const emoji = CATEGORY_EMOJI[delivery.category ?? ""] ?? "📦";
            return (
              <View key={delivery.id} style={[styles.card, delivery.priority > 0 && styles.cardPriority]}>
                {/* Card top */}
                <View style={styles.cardTop}>
                  <View style={styles.cardTopLeft}>
                    <Text style={styles.cardEmoji}>{emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardName} numberOfLines={1}>{delivery.customerName}</Text>
                      <Text style={styles.cardMeta} numberOfLines={1}>
                        {delivery.merchant ? `@ ${delivery.merchant.name} · ` : ""}
                        {formatDistanceToNow(new Date(delivery.createdAt), { addSuffix: true, locale: fr })}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                    <Text style={[styles.statusPillText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>

                {/* Addresses */}
                <View style={styles.addresses}>
                  <Text style={styles.addrPickup} numberOfLines={1}>↑ {delivery.pickupAddress}</Text>
                  <Text style={styles.addrDelivery} numberOfLines={1}>↓ {delivery.deliveryAddress}</Text>
                </View>

                {/* Courier tag */}
                {delivery.courier && (
                  <View style={styles.courierTag}>
                    <Text style={styles.courierTagText}>🏍️ {delivery.courier.name}</Text>
                  </View>
                )}

                {/* Priority badge */}
                {delivery.priority > 0 && (
                  <Text style={styles.priorityBadge}>
                    {delivery.priority === 2 ? "🔴 Urgent" : "🟠 Haute priorité"}
                  </Text>
                )}

                {/* Actions */}
                <View style={styles.actions}>
                  {delivery.status === "pending" && (
                    <TouchableOpacity
                      style={styles.actionBtnBlue}
                      onPress={() => setAssignModal(delivery)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.actionBtnText}>👤 Assigner</Text>
                    </TouchableOpacity>
                  )}
                  {delivery.status === "assigned" && (
                    <TouchableOpacity
                      style={styles.actionBtnPurple}
                      onPress={() => doAction(delivery.id, "pickup")}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.actionBtnText}>📦 Collecté</Text>
                    </TouchableOpacity>
                  )}
                  {delivery.status === "picked_up" && (
                    <TouchableOpacity
                      style={styles.actionBtnGreen}
                      onPress={() => doAction(delivery.id, "deliver")}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.actionBtnText}>✅ Livré</Text>
                    </TouchableOpacity>
                  )}
                  {["pending", "assigned"].includes(delivery.status) && (
                    <TouchableOpacity
                      style={styles.actionBtnRed}
                      onPress={() => confirmCancel(delivery.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.actionBtnText, { color: "#ef4444" }]}>✕ Annuler</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Assign modal */}
      <Modal visible={!!assignModal} animationType="slide" transparent onRequestClose={() => setAssignModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Assigner un coursier</Text>
            {assignModal && (
              <Text style={styles.modalSub}>{assignModal.customerName} — {assignModal.deliveryAddress}</Text>
            )}
            {availableCouriers.length === 0 ? (
              <View style={styles.noCoUrierBox}>
                <Text style={styles.noCourierText}>Aucun coursier disponible</Text>
              </View>
            ) : (
              <FlatList
                data={availableCouriers}
                keyExtractor={(c) => c.id}
                style={styles.courierList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.courierItem}
                    onPress={() => {
                      if (assignModal) {
                        doAction(assignModal.id, "assign", item.id);
                        setAssignModal(null);
                      }
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.courierItemAvatar, { backgroundColor: item.status === "available" ? "#22c55e" : "#3b82f6" }]}>
                      <Text style={styles.courierItemAvatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.courierItemName}>{item.name}</Text>
                      <Text style={styles.courierItemStatus}>
                        {item.status === "available" ? "✓ Disponible" : `En course · ${item.deliveredToday} auj.`}
                      </Text>
                    </View>
                    <Text style={styles.courierItemArrow}>→</Text>
                  </TouchableOpacity>
                )}
              />
            )}
            <TouchableOpacity style={styles.modalClose} onPress={() => setAssignModal(null)}>
              <Text style={styles.modalCloseText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  countersRow: { flexDirection: "row", gap: 6 },
  counter: { alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  counterNum: { fontSize: 16, fontWeight: "800" },
  counterLabel: { fontSize: 9, color: "#64748b", fontWeight: "600", textTransform: "uppercase" },
  tabs: { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: "#2563eb" },
  tabLabel: { fontSize: 13, fontWeight: "600", color: "#94a3b8" },
  tabLabelActive: { color: "#2563eb" },
  tabBadge: { width: 18, height: 18, borderRadius: 9, justifyContent: "center", alignItems: "center" },
  tabBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  scroll: { flex: 1 },
  scrollContent: { padding: 12, gap: 10 },
  emptyBox: { alignItems: "center", paddingVertical: 64, gap: 10 },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: "#94a3b8", fontSize: 15, fontWeight: "500" },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 14, gap: 10, borderWidth: 1, borderColor: "#f1f5f9", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardPriority: { borderColor: "#fed7aa" },
  cardTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  cardTopLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  cardEmoji: { fontSize: 26 },
  cardName: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  cardMeta: { fontSize: 12, color: "#94a3b8", marginTop: 1 },
  statusPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20, flexShrink: 0 },
  statusPillText: { fontSize: 11, fontWeight: "700" },
  addresses: { backgroundColor: "#f8fafc", borderRadius: 12, padding: 10, gap: 4 },
  addrPickup: { fontSize: 12, color: "#7c3aed", fontWeight: "500" },
  addrDelivery: { fontSize: 12, color: "#ea580c", fontWeight: "500" },
  courierTag: { flexDirection: "row" },
  courierTagText: { fontSize: 12, color: "#2563eb", fontWeight: "600", backgroundColor: "#eff6ff", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  priorityBadge: { fontSize: 12, fontWeight: "600", color: "#92400e" },
  actions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  actionBtnBlue:   { flex: 1, backgroundColor: "#2563eb", borderRadius: 12, paddingVertical: 10, alignItems: "center", minWidth: 100 },
  actionBtnPurple: { flex: 1, backgroundColor: "#7c3aed", borderRadius: 12, paddingVertical: 10, alignItems: "center", minWidth: 100 },
  actionBtnGreen:  { flex: 1, backgroundColor: "#15803d", borderRadius: 12, paddingVertical: 10, alignItems: "center", minWidth: 100 },
  actionBtnRed:    { flex: 1, borderWidth: 1.5, borderColor: "#fecaca", borderRadius: 12, paddingVertical: 10, alignItems: "center", minWidth: 100, backgroundColor: "#fff5f5" },
  actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, maxHeight: "75%", gap: 12 },
  modalHandle: { width: 40, height: 4, backgroundColor: "#e2e8f0", borderRadius: 2, alignSelf: "center", marginBottom: 4 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  modalSub: { fontSize: 13, color: "#64748b" },
  courierList: { maxHeight: 300 },
  courierItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  courierItemAvatar: { width: 42, height: 42, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  courierItemAvatarText: { color: "#fff", fontWeight: "700", fontSize: 18 },
  courierItemName: { fontSize: 15, fontWeight: "600", color: "#0f172a" },
  courierItemStatus: { fontSize: 12, color: "#64748b", marginTop: 1 },
  courierItemArrow: { color: "#2563eb", fontWeight: "700", fontSize: 18 },
  noCoUrierBox: { padding: 24, alignItems: "center" },
  noCourierText: { color: "#94a3b8", fontSize: 14 },
  modalClose: { backgroundColor: "#f1f5f9", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  modalCloseText: { color: "#374151", fontWeight: "700", fontSize: 15 },
});
