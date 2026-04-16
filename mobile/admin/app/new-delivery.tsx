import { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { api } from "@/lib/api";
import { API_BASE } from "@/lib/config";

interface Merchant { id: string; name: string; category: string; address: string; lat: number; lng: number; }

const BIZERTE_ZONES = [
  { name: "Centre-ville Bizerte",  lat: 37.2746, lng: 9.8739 },
  { name: "Corniche Bizerte",      lat: 37.2764, lng: 9.8688 },
  { name: "Zarzouna",              lat: 37.2850, lng: 9.8900 },
  { name: "El Azib",               lat: 37.2600, lng: 9.8600 },
  { name: "Menzel Bourguiba",      lat: 37.1550, lng: 9.7900 },
  { name: "Mateur",                lat: 37.0400, lng: 9.6640 },
  { name: "Tinja",                 lat: 37.2100, lng: 9.7300 },
];

const CATEGORY_EMOJI: Record<string, string> = {
  restaurant: "🍽️", patisserie: "🧁", boucherie: "🥩", volaillerie: "🐔",
  fromagerie: "🧀", supermarche: "🛒", pharmacie: "💊", eau: "💧", course: "📦",
};

export default function NewDeliveryScreen() {
  const [merchants, setMerchants]           = useState<Merchant[]>([]);
  const [merchantSearch, setMerchantSearch] = useState("");
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [showMerchants, setShowMerchants]   = useState(false);

  const [customerName, setCustomerName]     = useState("");
  const [customerPhone, setCustomerPhone]   = useState("");
  const [orderNotes, setOrderNotes]         = useState("");
  const [customPickup, setCustomPickup]     = useState("");
  const [selectedZone, setSelectedZone]     = useState<typeof BIZERTE_ZONES[0] | null>(null);
  const [customDelivery, setCustomDelivery] = useState("");
  const [showZones, setShowZones]           = useState(false);
  const [priority, setPriority]             = useState(0);
  const [submitting, setSubmitting]         = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/merchants`)
      .then((r) => r.json())
      .then(setMerchants)
      .catch(() => {});
  }, []);

  const filteredMerchants = merchants.filter((m) =>
    m.name.toLowerCase().includes(merchantSearch.toLowerCase()) ||
    m.address.toLowerCase().includes(merchantSearch.toLowerCase())
  );

  const pickupAddress = selectedMerchant ? selectedMerchant.address : customPickup;
  const deliveryAddress = selectedZone ? selectedZone.name : customDelivery;
  const canSubmit = customerName.trim() && customerPhone.trim() && pickupAddress.trim() && deliveryAddress.trim();

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const zone = selectedZone ?? BIZERTE_ZONES[0];
      const result = await api.createDelivery({
        customerName:    customerName.trim(),
        customerPhone:   customerPhone.trim(),
        pickupAddress:   pickupAddress.trim(),
        pickupLat:       selectedMerchant?.lat ?? 37.2746,
        pickupLng:       selectedMerchant?.lng ?? 9.8739,
        deliveryAddress: deliveryAddress.trim(),
        deliveryLat:     zone.lat,
        deliveryLng:     zone.lng,
        merchantId:      selectedMerchant?.id ?? undefined,
        category:        selectedMerchant?.category ?? "course",
        notes:           orderNotes.trim() || null,
        priority,
      });
      if (result) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("✅ Course créée", `#${result.orderNumber?.slice(-6)}`, [
          { text: "OK", onPress: () => router.back() },
        ]);
      } else {
        throw new Error();
      }
    } catch {
      Alert.alert("Erreur", "Impossible de créer la course. Vérifiez votre connexion.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nouvelle course</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Section: Collecte */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📦 Point de collecte</Text>

            {/* Merchant search */}
            <Text style={styles.fieldLabel}>Marchand (optionnel)</Text>
            <TouchableOpacity
              style={styles.selectorBtn}
              onPress={() => setShowMerchants(!showMerchants)}
            >
              <Text style={selectedMerchant ? styles.selectorValue : styles.selectorPlaceholder}>
                {selectedMerchant ? `${CATEGORY_EMOJI[selectedMerchant.category] ?? "📦"} ${selectedMerchant.name}` : "Choisir un marchand..."}
              </Text>
              {selectedMerchant && (
                <TouchableOpacity onPress={() => { setSelectedMerchant(null); setMerchantSearch(""); }}>
                  <Text style={styles.clearIcon}>✕</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            {showMerchants && (
              <View style={styles.dropdown}>
                <TextInput
                  style={styles.dropdownSearch}
                  placeholder="Rechercher..."
                  placeholderTextColor="#9ca3af"
                  value={merchantSearch}
                  onChangeText={setMerchantSearch}
                  autoFocus
                />
                <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled">
                  {filteredMerchants.map((m) => (
                    <TouchableOpacity
                      key={m.id}
                      style={styles.dropdownItem}
                      onPress={() => { setSelectedMerchant(m); setShowMerchants(false); setMerchantSearch(""); }}
                    >
                      <Text style={styles.dropdownItemText}>{CATEGORY_EMOJI[m.category] ?? "📦"} {m.name}</Text>
                      <Text style={styles.dropdownItemSub}>{m.address}</Text>
                    </TouchableOpacity>
                  ))}
                  {filteredMerchants.length === 0 && (
                    <Text style={styles.dropdownEmpty}>Aucun résultat</Text>
                  )}
                </ScrollView>
              </View>
            )}

            {!selectedMerchant && (
              <>
                <Text style={styles.fieldLabelOr}>— ou adresse libre —</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Adresse de collecte..."
                  placeholderTextColor="#9ca3af"
                  value={customPickup}
                  onChangeText={setCustomPickup}
                />
              </>
            )}

            <Text style={styles.fieldLabel}>Description de la commande</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Ex: 2 sandwichs, 1 pizza margherita..."
              placeholderTextColor="#9ca3af"
              value={orderNotes}
              onChangeText={setOrderNotes}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Section: Client */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>👤 Client</Text>
            <Text style={styles.fieldLabel}>Nom *</Text>
            <TextInput style={styles.input} placeholder="Mohamed Ben Ali" placeholderTextColor="#9ca3af" value={customerName} onChangeText={setCustomerName} />
            <Text style={styles.fieldLabel}>Téléphone *</Text>
            <TextInput style={styles.input} placeholder="+216 XX XXX XXX" placeholderTextColor="#9ca3af" value={customerPhone} onChangeText={setCustomerPhone} keyboardType="phone-pad" />
          </View>

          {/* Section: Livraison */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🏠 Adresse de livraison</Text>

            <TouchableOpacity style={styles.selectorBtn} onPress={() => setShowZones(!showZones)}>
              <Text style={selectedZone ? styles.selectorValue : styles.selectorPlaceholder}>
                {selectedZone ? `📍 ${selectedZone.name}` : "Choisir une zone..."}
              </Text>
              <Text style={styles.selectorChevron}>{showZones ? "▲" : "▼"}</Text>
            </TouchableOpacity>

            {showZones && (
              <View style={styles.dropdown}>
                {BIZERTE_ZONES.map((z) => (
                  <TouchableOpacity
                    key={z.name}
                    style={[styles.dropdownItem, selectedZone?.name === z.name && styles.dropdownItemActive]}
                    onPress={() => { setSelectedZone(z); setShowZones(false); setCustomDelivery(""); }}
                  >
                    <Text style={[styles.dropdownItemText, selectedZone?.name === z.name && { color: "#2563eb" }]}>📍 {z.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.fieldLabelOr}>— ou adresse libre —</Text>
            <TextInput
              style={styles.input}
              placeholder="Adresse complète..."
              placeholderTextColor="#9ca3af"
              value={customDelivery}
              onChangeText={(v) => { setCustomDelivery(v); if (v) setSelectedZone(null); }}
              multiline
            />
          </View>

          {/* Priority */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚡ Priorité</Text>
            <View style={styles.priorityRow}>
              {[
                { val: 0, label: "Normale", color: "#64748b", bg: "#f1f5f9" },
                { val: 1, label: "🟠 Haute", color: "#ea580c", bg: "#fff7ed" },
                { val: 2, label: "🔴 Urgente", color: "#dc2626", bg: "#fef2f2" },
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
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, (!canSubmit || submitting) && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit || submitting}
            activeOpacity={0.85}
          >
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.submitBtnText}>Créer la course →</Text>
            }
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  closeBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  closeBtnText: { fontSize: 18, color: "#64748b" },
  headerTitle: { fontSize: 17, fontWeight: "800", color: "#0f172a" },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 16 },
  section: { backgroundColor: "#fff", borderRadius: 18, padding: 16, gap: 10, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: "#0f172a", marginBottom: 2 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#475569" },
  fieldLabelOr: { fontSize: 11, color: "#94a3b8", textAlign: "center" },
  input: { backgroundColor: "#f8fafc", borderWidth: 1.5, borderColor: "#e2e8f0", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: "#0f172a" },
  textArea: { height: 80, textAlignVertical: "top" },
  selectorBtn: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f8fafc", borderWidth: 1.5, borderColor: "#e2e8f0", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  selectorValue: { fontSize: 15, color: "#0f172a", flex: 1 },
  selectorPlaceholder: { fontSize: 15, color: "#94a3b8", flex: 1 },
  selectorChevron: { color: "#94a3b8", fontSize: 12 },
  clearIcon: { color: "#94a3b8", fontSize: 14, padding: 4 },
  dropdown: { backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#e2e8f0", borderRadius: 14, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  dropdownSearch: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f1f5f9", fontSize: 14, color: "#0f172a" },
  dropdownItem: { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "#f8fafc" },
  dropdownItemActive: { backgroundColor: "#eff6ff" },
  dropdownItemText: { fontSize: 14, fontWeight: "600", color: "#0f172a" },
  dropdownItemSub: { fontSize: 11, color: "#94a3b8", marginTop: 1 },
  dropdownEmpty: { padding: 16, color: "#94a3b8", textAlign: "center", fontSize: 13 },
  priorityRow: { flexDirection: "row", gap: 8 },
  priorityBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: "#e2e8f0", alignItems: "center", backgroundColor: "#f8fafc" },
  priorityBtnText: { fontSize: 12, fontWeight: "700", color: "#475569" },
  submitBtn: { backgroundColor: "#2563eb", borderRadius: 16, paddingVertical: 18, alignItems: "center", shadowColor: "#2563eb", shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  submitBtnDisabled: { opacity: 0.4, shadowOpacity: 0 },
  submitBtnText: { color: "#fff", fontSize: 17, fontWeight: "800" },
});
