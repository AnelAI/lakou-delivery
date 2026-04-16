import { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Alert, Linking, KeyboardAvoidingView, Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { API_BASE } from "@/lib/config";

interface Merchant {
  id: string;
  name: string;
  category: string;
  address: string;
  phone: string | null;
  description: string | null;
  lat: number;
  lng: number;
}

interface Zone {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

const CATEGORY_META: Record<string, { emoji: string }> = {
  restaurant: { emoji: "🍽️" }, patisserie: { emoji: "🧁" }, boucherie: { emoji: "🥩" },
  volaillerie: { emoji: "🐔" }, fromagerie: { emoji: "🧀" }, supermarche: { emoji: "🛒" },
  pharmacie: { emoji: "💊" }, eau: { emoji: "💧" }, course: { emoji: "📦" },
};

const BIZERTE_ZONES = [
  { name: "Centre-ville Bizerte", lat: 37.2746, lng: 9.8739 },
  { name: "Corniche Bizerte", lat: 37.2764, lng: 9.8688 },
  { name: "Zarzouna", lat: 37.2850, lng: 9.8900 },
  { name: "El Azib", lat: 37.2600, lng: 9.8600 },
  { name: "Menzel Bourguiba", lat: 37.1550, lng: 9.7900 },
];

export default function MerchantScreen() {
  const { merchantId } = useLocalSearchParams<{ merchantId: string }>();
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Order form
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [selectedZone, setSelectedZone] = useState<typeof BIZERTE_ZONES[0] | null>(null);
  const [customAddress, setCustomAddress] = useState("");
  const [showZones, setShowZones] = useState(false);
  const [priority, setPriority] = useState(0);

  useEffect(() => {
    fetch(`${API_BASE}/api/merchants/${merchantId}`)
      .then((r) => r.json())
      .then((data) => { setMerchant(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [merchantId]);

  const deliveryAddress = selectedZone ? selectedZone.name : customAddress;
  const canOrder = customerName.trim() && customerPhone.trim() && deliveryAddress.trim();

  const handleOrder = async () => {
    if (!canOrder || !merchant) return;
    setSubmitting(true);
    try {
      const zone = selectedZone ?? BIZERTE_ZONES[0];
      const res = await fetch(`${API_BASE}/api/deliveries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          pickupAddress: merchant.address,
          pickupLat: merchant.lat,
          pickupLng: merchant.lng,
          deliveryAddress: deliveryAddress.trim(),
          deliveryLat: zone.lat,
          deliveryLng: zone.lng,
          merchantId: merchant.id,
          category: merchant.category,
          notes: orderNotes.trim() || null,
          priority,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          "✅ Commande confirmée !",
          `Votre commande #${data.orderNumber?.slice(-6) ?? "---"} a été enregistrée. Vous serez contacté par le coursier.`,
          [
            {
              text: "Suivre ma commande",
              onPress: () => router.push(`/track/${data.orderNumber}`),
            },
            { text: "Fermer", onPress: () => router.back() },
          ]
        );
      } else {
        throw new Error("Erreur serveur");
      }
    } catch {
      Alert.alert("Erreur", "Impossible d'envoyer la commande. Vérifiez votre connexion.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }
  if (!merchant) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Marchand introuvable</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>← Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const emoji = CATEGORY_META[merchant.category]?.emoji ?? "📦";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Text style={styles.backBtnText}>←</Text>
            </TouchableOpacity>
            <View style={styles.merchantHero}>
              <View style={styles.heroEmoji}>
                <Text style={{ fontSize: 44 }}>{emoji}</Text>
              </View>
              <Text style={styles.heroName}>{merchant.name}</Text>
              <Text style={styles.heroAddr}>📍 {merchant.address}</Text>
              {merchant.phone && (
                <TouchableOpacity onPress={() => Linking.openURL(`tel:${merchant.phone}`)}>
                  <Text style={styles.heroPhone}>📞 {merchant.phone}</Text>
                </TouchableOpacity>
              )}
              {merchant.description && (
                <Text style={styles.heroDesc}>{merchant.description}</Text>
              )}
            </View>
          </View>

          {/* Order form */}
          <View style={styles.form}>
            <Text style={styles.formTitle}>🛵 Passer une commande</Text>

            {/* Customer info */}
            <Text style={styles.fieldLabel}>Votre nom *</Text>
            <TextInput
              style={styles.input}
              placeholder="Mohamed Ben Ali"
              placeholderTextColor="#9ca3af"
              value={customerName}
              onChangeText={setCustomerName}
            />

            <Text style={styles.fieldLabel}>Votre numéro *</Text>
            <TextInput
              style={styles.input}
              placeholder="+216 XX XXX XXX"
              placeholderTextColor="#9ca3af"
              value={customerPhone}
              onChangeText={setCustomerPhone}
              keyboardType="phone-pad"
            />

            {/* Delivery address */}
            <Text style={styles.fieldLabel}>Adresse de livraison *</Text>
            <TouchableOpacity
              style={styles.zoneSelector}
              onPress={() => setShowZones(!showZones)}
              activeOpacity={0.7}
            >
              <Text style={selectedZone ? styles.zoneSelectorText : styles.zoneSelectorPlaceholder}>
                {selectedZone ? `📍 ${selectedZone.name}` : "Choisir une zone..."}
              </Text>
              <Text style={styles.zoneSelectorChevron}>{showZones ? "▲" : "▼"}</Text>
            </TouchableOpacity>
            {showZones && (
              <View style={styles.zoneList}>
                {BIZERTE_ZONES.map((z) => (
                  <TouchableOpacity
                    key={z.name}
                    style={[styles.zoneItem, selectedZone?.name === z.name && styles.zoneItemActive]}
                    onPress={() => { setSelectedZone(z); setShowZones(false); setCustomAddress(""); }}
                  >
                    <Text style={[styles.zoneItemText, selectedZone?.name === z.name && styles.zoneItemTextActive]}>
                      📍 {z.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <Text style={styles.fieldLabelOr}>— ou entrez une adresse libre —</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Rue des Fleurs, Appartement 3B..."
              placeholderTextColor="#9ca3af"
              value={customAddress}
              onChangeText={(v) => { setCustomAddress(v); if (v) setSelectedZone(null); }}
              multiline
            />

            {/* Order notes */}
            <Text style={styles.fieldLabel}>Instructions / description de la commande</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Ex: 1 sandwich thon, 1 bouteille d'eau... Sonner 2 fois..."
              placeholderTextColor="#9ca3af"
              value={orderNotes}
              onChangeText={setOrderNotes}
              multiline
              numberOfLines={3}
            />

            {/* Priority */}
            <Text style={styles.fieldLabel}>Priorité</Text>
            <View style={styles.priorityRow}>
              {[
                { val: 0, label: "Normale", color: "#6b7280" },
                { val: 1, label: "🟠 Haute",  color: "#ea580c" },
                { val: 2, label: "🔴 Urgente", color: "#dc2626" },
              ].map((p) => (
                <TouchableOpacity
                  key={p.val}
                  style={[styles.priorityBtn, priority === p.val && { backgroundColor: p.color, borderColor: p.color }]}
                  onPress={() => setPriority(p.val)}
                >
                  <Text style={[styles.priorityBtnText, priority === p.val && { color: "#fff" }]}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, (!canOrder || submitting) && styles.submitBtnDisabled]}
              onPress={handleOrder}
              disabled={!canOrder || submitting}
              activeOpacity={0.85}
            >
              {submitting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitBtnText}>Commander maintenant 🛵</Text>
              }
            </TouchableOpacity>

            <Text style={styles.disclaimer}>
              Un coursier Lakou Delivery vous contactera pour confirmer votre commande.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f9fafb", gap: 12 },
  errorText: { color: "#6b7280", fontSize: 16 },
  backLink: { color: "#f97316", fontSize: 15, fontWeight: "600" },
  header: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  backBtn: { paddingHorizontal: 16, paddingTop: 12 },
  backBtnText: { fontSize: 22, color: "#374151" },
  merchantHero: { alignItems: "center", padding: 20, gap: 6 },
  heroEmoji: { width: 80, height: 80, borderRadius: 24, backgroundColor: "#fff7ed", justifyContent: "center", alignItems: "center", marginBottom: 4 },
  heroName: { fontSize: 22, fontWeight: "800", color: "#111827", textAlign: "center" },
  heroAddr: { fontSize: 13, color: "#6b7280", textAlign: "center" },
  heroPhone: { fontSize: 14, color: "#2563eb", fontWeight: "600" },
  heroDesc: { fontSize: 13, color: "#9ca3af", textAlign: "center", fontStyle: "italic", lineHeight: 18 },
  form: { padding: 16, gap: 8 },
  formTitle: { fontSize: 18, fontWeight: "800", color: "#111827", marginBottom: 8 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#374151", marginTop: 8 },
  fieldLabelOr: { fontSize: 11, color: "#9ca3af", textAlign: "center", marginVertical: 4 },
  input: { backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#111827" },
  textArea: { height: 80, textAlignVertical: "top" },
  zoneSelector: { backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  zoneSelectorText: { fontSize: 15, color: "#111827" },
  zoneSelectorPlaceholder: { fontSize: 15, color: "#9ca3af" },
  zoneSelectorChevron: { color: "#9ca3af" },
  zoneList: { backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 12, overflow: "hidden" },
  zoneItem: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  zoneItemActive: { backgroundColor: "#fff7ed" },
  zoneItemText: { fontSize: 14, color: "#374151" },
  zoneItemTextActive: { color: "#f97316", fontWeight: "600" },
  priorityRow: { flexDirection: "row", gap: 8 },
  priorityBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, borderColor: "#e5e7eb", alignItems: "center" },
  priorityBtnText: { fontSize: 12, fontWeight: "600", color: "#374151" },
  submitBtn: { backgroundColor: "#f97316", borderRadius: 16, paddingVertical: 18, alignItems: "center", marginTop: 12, shadowColor: "#f97316", shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  submitBtnDisabled: { opacity: 0.45, shadowOpacity: 0 },
  submitBtnText: { color: "#fff", fontSize: 17, fontWeight: "800" },
  disclaimer: { fontSize: 11, color: "#9ca3af", textAlign: "center", lineHeight: 16, marginBottom: 24 },
});
