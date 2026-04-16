import { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, Vibration, Platform, Linking, RefreshControl,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, Polyline, UrlTile, Circle } from "react-native-maps";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

import { getCourier, getDeliveries, updateDeliveryStatus, sendLocation } from "@/lib/api";
import { getPusher, ADMIN_CHANNEL, courierChannel, EVENTS } from "@/lib/pusher";
import { haversineDistance, formatDistance } from "@/lib/geo";
import type { Delivery, CourierInfo } from "@/lib/types";

const ARRIVAL_RADIUS_KM = 0.15;
const GPS_INTERVAL_MS = 5000;

const STATUS_COLOR = { pending: "#f59e0b", assigned: "#3b82f6", picked_up: "#a855f7", delivered: "#22c55e", cancelled: "#6b7280" };
const CATEGORY_EMOJI: Record<string, string> = {
  restaurant: "🍽️", patisserie: "🧁", boucherie: "🥩", volaillerie: "🐔",
  fromagerie: "🧀", supermarche: "🛒", pharmacie: "💊", eau: "💧", course: "📦",
};

export default function HomeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [courier, setCourier] = useState<CourierInfo | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [tracking, setTracking] = useState<"idle" | "starting" | "active" | "error">("idle");
  const [position, setPosition] = useState<{ lat: number; lng: number; speed: number; accuracy: number; heading: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(true);

  const locationSub = useRef<Location.LocationSubscription | null>(null);
  const arrivedSet = useRef<Set<string>>(new Set());

  const fetchDeliveries = useCallback(async () => {
    const data = await getDeliveries(id);
    setDeliveries(data);
  }, [id]);

  useEffect(() => {
    getCourier(id).then((c) => { if (c) setCourier(c); });
    fetchDeliveries();

    const pusher = getPusher();
    const adminCh = pusher.subscribe(ADMIN_CHANNEL);
    const courierCh = pusher.subscribe(courierChannel(id));
    adminCh.bind(EVENTS.DELIVERIES_UPDATED, fetchDeliveries);
    adminCh.bind(EVENTS.DELIVERIES_NEW, fetchDeliveries);
    courierCh.bind(EVENTS.DELIVERY_ASSIGNED, fetchDeliveries);

    return () => {
      adminCh.unbind_all();
      pusher.unsubscribe(ADMIN_CHANNEL);
      pusher.unsubscribe(courierChannel(id));
      locationSub.current?.remove();
    };
  }, [id, fetchDeliveries]);

  const startTracking = async () => {
    setTracking("starting");
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setTracking("error");
      Alert.alert("Permission GPS refusée", "Activez la localisation dans les réglages.", [
        { text: "Réglages", onPress: () => Linking.openSettings() },
        { text: "Annuler" },
      ]);
      return;
    }

    locationSub.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: GPS_INTERVAL_MS,
        distanceInterval: 10,
      },
      (loc) => {
        const pos = {
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          speed: Math.max(0, (loc.coords.speed ?? 0) * 3.6),
          accuracy: loc.coords.accuracy ?? 99,
          heading: loc.coords.heading ?? 0,
        };
        setPosition(pos);
        sendLocation(id, pos.lat, pos.lng, pos.speed, pos.heading, pos.accuracy);
        checkArrival(pos.lat, pos.lng);
      }
    );
    setTracking("active");
  };

  const stopTracking = () => {
    locationSub.current?.remove();
    locationSub.current = null;
    setTracking("idle");
  };

  const checkArrival = (lat: number, lng: number) => {
    const active = deliveries.filter((d) => ["assigned", "picked_up"].includes(d.status));
    for (const delivery of active) {
      const isPickedUp = delivery.status === "picked_up";
      const targetLat = isPickedUp ? delivery.deliveryLat : delivery.pickupLat;
      const targetLng = isPickedUp ? delivery.deliveryLng : delivery.pickupLng;
      const dist = haversineDistance(lat, lng, targetLat, targetLng);
      const key = `${delivery.id}-${isPickedUp ? "dest" : "pickup"}`;

      if (dist <= ARRIVAL_RADIUS_KM && !arrivedSet.current.has(key)) {
        arrivedSet.current.add(key);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          isPickedUp ? "🏠 Destination atteinte !" : "📦 Point de collecte atteint !",
          `${delivery.customerName}`,
          [
            {
              text: isPickedUp ? "Confirmer livraison ✓" : "Confirmer collecte ✓",
              onPress: () => handleAction(delivery.id, isPickedUp ? "deliver" : "pickup"),
            },
            { text: "Pas encore", style: "cancel" },
          ]
        );
      } else if (dist > ARRIVAL_RADIUS_KM * 2) {
        arrivedSet.current.delete(key);
      }
    }
  };

  const handleAction = async (deliveryId: string, action: "pickup" | "deliver" | "cancel") => {
    const ok = await updateDeliveryStatus(deliveryId, action);
    if (ok) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      fetchDeliveries();
    }
  };

  const handleLogout = async () => {
    Alert.alert("Se déconnecter", "Vous devrez entrer votre identifiant à nouveau.", [
      {
        text: "Se déconnecter",
        style: "destructive",
        onPress: async () => {
          stopTracking();
          await AsyncStorage.removeItem("lakou_courier_id");
          router.replace("/");
        },
      },
      { text: "Annuler", style: "cancel" },
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDeliveries();
    setRefreshing(false);
  };

  const activeDeliveries = deliveries.filter((d) => ["assigned", "picked_up"].includes(d.status));
  const deliveredToday = deliveries.filter((d) => d.status === "delivered").length;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.avatar, tracking === "active" && styles.avatarActive]}>
            <Text style={styles.avatarText}>{courier?.name.charAt(0).toUpperCase() ?? "?"}</Text>
          </View>
          <View>
            <Text style={styles.headerName}>{courier?.name ?? "Chargement..."}</Text>
            <Text style={styles.headerPhone}>{courier?.phone}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.statusBadge, tracking === "active" ? styles.badgeOnline : styles.badgeOffline]}>
            <View style={[styles.statusDot, tracking === "active" ? styles.dotGreen : styles.dotGray]} />
            <Text style={[styles.statusText, tracking === "active" ? styles.textGreen : styles.textGray]}>
              {tracking === "active" ? "En ligne" : tracking === "starting" ? "GPS..." : "Hors ligne"}
            </Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>⎋</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Map ── */}
        <View style={styles.mapSection}>
          <TouchableOpacity
            style={styles.mapToggle}
            onPress={() => setMapExpanded((v) => !v)}
            activeOpacity={0.7}
          >
            <Text style={styles.mapToggleText}>🗺  Carte en temps réel</Text>
            <Text style={styles.mapToggleChevron}>{mapExpanded ? "▲" : "▼"}</Text>
          </TouchableOpacity>
          {mapExpanded && (
            <MapView
              style={styles.map}
              region={{
                latitude: position?.lat ?? 37.2746,
                longitude: position?.lng ?? 9.8739,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              }}
              showsUserLocation={false}
            >
              <UrlTile
                urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                maximumZ={19}
                flipY={false}
              />
              {/* Courier position */}
              {position && (
                <Marker coordinate={{ latitude: position.lat, longitude: position.lng }} anchor={{ x: 0.5, y: 0.5 }}>
                  <View style={styles.courierMarker}>
                    <Text style={{ fontSize: 20 }}>🏍️</Text>
                  </View>
                </Marker>
              )}
              {position && (
                <Circle
                  center={{ latitude: position.lat, longitude: position.lng }}
                  radius={position.accuracy}
                  strokeColor="rgba(59,130,246,0.4)"
                  fillColor="rgba(59,130,246,0.1)"
                />
              )}
              {/* Delivery waypoints */}
              {activeDeliveries.map((d, i) => (
                <View key={d.id}>
                  {d.status !== "picked_up" && (
                    <Marker
                      coordinate={{ latitude: d.pickupLat, longitude: d.pickupLng }}
                      title={`Collecte — ${d.customerName}`}
                      description={d.pickupAddress}
                    >
                      <View style={[styles.waypointMarker, { backgroundColor: "#7c3aed" }]}>
                        <Text style={styles.waypointNum}>{i + 1}</Text>
                      </View>
                    </Marker>
                  )}
                  <Marker
                    coordinate={{ latitude: d.deliveryLat, longitude: d.deliveryLng }}
                    title={`Livraison — ${d.customerName}`}
                    description={d.deliveryAddress}
                  >
                    <View style={[styles.waypointMarker, { backgroundColor: "#ea580c" }]}>
                      <Text style={styles.waypointNum}>🏠</Text>
                    </View>
                  </Marker>
                </View>
              ))}
            </MapView>
          )}
        </View>

        {/* ── Speed bar ── */}
        {tracking === "active" && position && (
          <View style={styles.speedBar}>
            <View style={styles.speedItem}>
              <Text style={styles.speedValue}>{Math.round(position.speed)}</Text>
              <Text style={styles.speedLabel}>km/h</Text>
            </View>
            {activeDeliveries[0] && (() => {
              const d = activeDeliveries[0];
              const isPickedUp = d.status === "picked_up";
              const dist = haversineDistance(position.lat, position.lng, isPickedUp ? d.deliveryLat : d.pickupLat, isPickedUp ? d.deliveryLng : d.pickupLng);
              const eta = position.speed > 1 ? Math.ceil((dist / position.speed) * 60) : Math.ceil((dist / 30) * 60);
              return (
                <View style={styles.speedNext}>
                  <Text style={styles.speedNextLabel}>{isPickedUp ? "🏠 Livraison" : "📦 Collecte"}</Text>
                  <View style={styles.speedNextRow}>
                    <Text style={styles.speedNextDist}>{formatDistance(dist)}</Text>
                    <Text style={styles.speedNextEta}>~{eta} min</Text>
                  </View>
                  <Text style={styles.speedNextAddr} numberOfLines={1}>
                    {isPickedUp ? d.deliveryAddress : d.pickupAddress}
                  </Text>
                </View>
              );
            })()}
            <View style={styles.speedItem}>
              <Text style={[styles.speedValue, { fontSize: 14, color: position.accuracy < 15 ? "#22c55e" : position.accuracy < 50 ? "#f59e0b" : "#ef4444" }]}>
                ±{Math.round(position.accuracy)}m
              </Text>
              <Text style={styles.speedLabel}>GPS</Text>
            </View>
          </View>
        )}

        {/* ── Main GPS button ── */}
        <TouchableOpacity
          style={[
            styles.gpsBtn,
            tracking === "active" && styles.gpsBtnStop,
            tracking === "starting" && styles.gpsBtnStarting,
          ]}
          onPress={tracking === "active" ? stopTracking : startTracking}
          disabled={tracking === "starting"}
          activeOpacity={0.85}
        >
          <Text style={styles.gpsBtnText}>
            {tracking === "active" && "⏹  Arrêter le tracking"}
            {tracking === "starting" && "🛰  Acquisition GPS..."}
            {tracking === "idle" && "▶  Démarrer le tracking"}
            {tracking === "error" && "↺  Réessayer"}
          </Text>
        </TouchableOpacity>

        {/* ── Today counter ── */}
        <View style={styles.todayRow}>
          <Text style={styles.todayText}>
            {deliveredToday > 0
              ? `✓ ${deliveredToday} course${deliveredToday > 1 ? "s" : ""} livrée${deliveredToday > 1 ? "s" : ""} aujourd'hui`
              : "Aucune livraison encore aujourd'hui"}
          </Text>
        </View>

        {/* ── Section title ── */}
        <Text style={styles.sectionTitle}>MES COURSES ({activeDeliveries.length})</Text>

        {/* ── Deliveries ── */}
        {activeDeliveries.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>Aucune course assignée</Text>
            <Text style={styles.emptySubtitle}>L'admin vous assignera des courses dès qu'elles arrivent</Text>
          </View>
        ) : (
          activeDeliveries.map((delivery, index) => {
            const isPickedUp = delivery.status === "picked_up";
            const distInfo = position ? (() => {
              const dist = haversineDistance(position.lat, position.lng, isPickedUp ? delivery.deliveryLat : delivery.pickupLat, isPickedUp ? delivery.deliveryLng : delivery.pickupLng);
              const eta = position.speed > 1 ? Math.ceil((dist / position.speed) * 60) : Math.ceil((dist / 30) * 60);
              return { dist: formatDistance(dist), eta };
            })() : null;

            return (
              <View key={delivery.id} style={[styles.deliveryCard, index === 0 && styles.deliveryCardFirst]}>
                {/* Card header */}
                <View style={styles.deliveryCardHeader}>
                  <View style={styles.deliveryCardHeaderLeft}>
                    {index === 0 && <View style={styles.nextBadge}><Text style={styles.nextBadgeText}>Prochaine</Text></View>}
                    <Text style={styles.orderNum}>#{delivery.orderNumber.slice(-6)}</Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: isPickedUp ? "#7c2d12" : "#1e3a5f" }]}>
                    <Text style={[styles.statusPillText, { color: isPickedUp ? "#fb923c" : "#60a5fa" }]}>
                      {isPickedUp ? "En route" : "À récupérer"}
                    </Text>
                  </View>
                </View>

                {/* Client */}
                <View style={styles.clientRow}>
                  <View style={styles.clientAvatar}>
                    <Text style={styles.clientAvatarText}>{delivery.customerName.charAt(0)}</Text>
                  </View>
                  <View style={styles.clientInfo}>
                    <Text style={styles.clientName}>{delivery.customerName}</Text>
                    {delivery.customerPhone && (
                      <TouchableOpacity onPress={() => Linking.openURL(`tel:${delivery.customerPhone}`)}>
                        <Text style={styles.clientPhone}>📞 {delivery.customerPhone}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Addresses */}
                {!isPickedUp && (
                  <View style={[styles.addressBox, { backgroundColor: "#2e1065" }]}>
                    <Text style={styles.addressLabel}>📦 Collecte</Text>
                    <Text style={styles.addressText}>{delivery.pickupAddress}</Text>
                    {delivery.merchant && <Text style={styles.merchantText}>@ {delivery.merchant.name}</Text>}
                  </View>
                )}
                <View style={[styles.addressBox, { backgroundColor: "#431407" }]}>
                  <Text style={styles.addressLabel}>🏠 Livraison</Text>
                  <Text style={styles.addressText}>{delivery.deliveryAddress}</Text>
                </View>

                {/* Distance / ETA */}
                {distInfo && (
                  <View style={styles.distRow}>
                    <Text style={styles.distValue}>📍 {distInfo.dist}</Text>
                    <Text style={styles.distEta}>⏱ ~{distInfo.eta} min</Text>
                    {delivery.distance && <Text style={styles.distTotal}>Total: {delivery.distance} km</Text>}
                  </View>
                )}

                {/* Notes */}
                {delivery.notes && (
                  <View style={styles.notesBox}>
                    <Text style={styles.notesText}>📝 {delivery.notes}</Text>
                  </View>
                )}

                {/* Action button */}
                {!isPickedUp && (
                  <TouchableOpacity
                    style={styles.actionBtnPurple}
                    onPress={() => handleAction(delivery.id, "pickup")}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.actionBtnText}>📦  Colis récupéré</Text>
                  </TouchableOpacity>
                )}
                {isPickedUp && (
                  <TouchableOpacity
                    style={styles.actionBtnGreen}
                    onPress={() => handleAction(delivery.id, "deliver")}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.actionBtnText}>✅  Course livrée !</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111827" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#1f2937", borderBottomWidth: 1, borderBottomColor: "#374151" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#374151", justifyContent: "center", alignItems: "center" },
  avatarActive: { backgroundColor: "#1d4ed8" },
  avatarText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  headerName: { color: "#fff", fontWeight: "700", fontSize: 16 },
  headerPhone: { color: "#9ca3af", fontSize: 12, marginTop: 1 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  badgeOnline: { backgroundColor: "rgba(16,185,129,0.15)" },
  badgeOffline: { backgroundColor: "rgba(75,85,99,0.3)" },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  dotGreen: { backgroundColor: "#22c55e" },
  dotGray: { backgroundColor: "#6b7280" },
  statusText: { fontSize: 12, fontWeight: "600" },
  textGreen: { color: "#4ade80" },
  textGray: { color: "#9ca3af" },
  logoutBtn: { padding: 8 },
  logoutText: { color: "#6b7280", fontSize: 18 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  mapSection: { backgroundColor: "#1f2937", borderRadius: 16, overflow: "hidden" },
  mapToggle: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12 },
  mapToggleText: { color: "#9ca3af", fontSize: 13, fontWeight: "500" },
  mapToggleChevron: { color: "#6b7280", fontSize: 12 },
  map: { height: 220, width: "100%" },
  courierMarker: { backgroundColor: "rgba(29,78,216,0.8)", borderRadius: 20, padding: 4, borderWidth: 2, borderColor: "#fff" },
  waypointMarker: { width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#fff" },
  waypointNum: { color: "#fff", fontSize: 11, fontWeight: "700" },
  speedBar: { flexDirection: "row", backgroundColor: "#1f2937", borderRadius: 16, padding: 14, alignItems: "center", gap: 8 },
  speedItem: { alignItems: "center", minWidth: 52 },
  speedValue: { color: "#fff", fontSize: 24, fontWeight: "800", fontVariant: ["tabular-nums"] },
  speedLabel: { color: "#6b7280", fontSize: 11, marginTop: 2 },
  speedNext: { flex: 1, backgroundColor: "rgba(55,65,81,0.5)", borderRadius: 12, padding: 10 },
  speedNextLabel: { color: "#9ca3af", fontSize: 11, marginBottom: 2 },
  speedNextRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  speedNextDist: { color: "#60a5fa", fontWeight: "700", fontSize: 15 },
  speedNextEta: { color: "#9ca3af", fontSize: 13 },
  speedNextAddr: { color: "#6b7280", fontSize: 11, marginTop: 2 },
  gpsBtn: { backgroundColor: "#2563eb", borderRadius: 18, paddingVertical: 20, alignItems: "center", shadowColor: "#1d4ed8", shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  gpsBtnStop: { backgroundColor: "#dc2626", shadowColor: "#991b1b" },
  gpsBtnStarting: { backgroundColor: "#1e3a5f", shadowOpacity: 0 },
  gpsBtnText: { color: "#fff", fontSize: 18, fontWeight: "800", letterSpacing: 0.3 },
  todayRow: { alignItems: "center", paddingVertical: 4 },
  todayText: { color: "#4b5563", fontSize: 12 },
  sectionTitle: { color: "#6b7280", fontSize: 11, fontWeight: "700", letterSpacing: 1, marginTop: 4 },
  emptyCard: { backgroundColor: "#1f2937", borderRadius: 20, padding: 40, alignItems: "center", gap: 8 },
  emptyIcon: { fontSize: 42 },
  emptyTitle: { color: "#9ca3af", fontWeight: "600", fontSize: 15 },
  emptySubtitle: { color: "#6b7280", fontSize: 13, textAlign: "center", lineHeight: 18 },
  deliveryCard: { backgroundColor: "#1f2937", borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: "#374151" },
  deliveryCardFirst: { borderColor: "#2563eb" },
  deliveryCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "rgba(55,65,81,0.3)", borderBottomWidth: 1, borderBottomColor: "rgba(75,85,99,0.3)" },
  deliveryCardHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  nextBadge: { backgroundColor: "#1d4ed8", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  nextBadgeText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  orderNum: { color: "#6b7280", fontSize: 11, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  statusPill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  statusPillText: { fontSize: 12, fontWeight: "600" },
  clientRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  clientAvatar: { width: 38, height: 38, backgroundColor: "#374151", borderRadius: 10, justifyContent: "center", alignItems: "center" },
  clientAvatarText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  clientInfo: { flex: 1 },
  clientName: { color: "#f9fafb", fontWeight: "600", fontSize: 15 },
  clientPhone: { color: "#60a5fa", fontSize: 13, marginTop: 2 },
  addressBox: { marginHorizontal: 16, marginBottom: 8, borderRadius: 12, padding: 12 },
  addressLabel: { color: "#c4b5fd", fontSize: 11, fontWeight: "600", marginBottom: 3 },
  addressText: { color: "#e5e7eb", fontSize: 14 },
  merchantText: { color: "#9ca3af", fontSize: 12, marginTop: 2 },
  distRow: { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 16, backgroundColor: "rgba(55,65,81,0.3)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8 },
  distValue: { color: "#60a5fa", fontWeight: "700", fontSize: 14 },
  distEta: { color: "#9ca3af", fontSize: 13 },
  distTotal: { color: "#6b7280", fontSize: 11, marginLeft: "auto" },
  notesBox: { marginHorizontal: 16, backgroundColor: "rgba(120,53,15,0.25)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8 },
  notesText: { color: "#fbbf24", fontSize: 13, fontStyle: "italic" },
  actionBtnPurple: { margin: 16, backgroundColor: "#7c3aed", borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  actionBtnGreen: { margin: 16, backgroundColor: "#15803d", borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  actionBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
