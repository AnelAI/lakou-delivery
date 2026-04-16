import { useState, useEffect } from "react";
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_BASE } from "@/lib/config";

interface Merchant {
  id: string;
  name: string;
  category: string;
  address: string;
  lat: number;
  lng: number;
  phone: string | null;
  description: string | null;
}

const CATEGORY_META: Record<string, { emoji: string; label: string; color: string }> = {
  restaurant:   { emoji: "🍽️", label: "Restaurant",   color: "#fef3c7" },
  patisserie:   { emoji: "🧁", label: "Pâtisserie",   color: "#fce7f3" },
  boucherie:    { emoji: "🥩", label: "Boucherie",    color: "#fee2e2" },
  volaillerie:  { emoji: "🐔", label: "Volaillerie",  color: "#fef9c3" },
  fromagerie:   { emoji: "🧀", label: "Fromagerie",   color: "#fffbeb" },
  supermarche:  { emoji: "🛒", label: "Supermarché",  color: "#ecfdf5" },
  pharmacie:    { emoji: "💊", label: "Pharmacie",    color: "#eff6ff" },
  eau:          { emoji: "💧", label: "Eau",          color: "#e0f2fe" },
  course:       { emoji: "📦", label: "Course",       color: "#f3f4f6" },
};

const CATEGORIES = ["Tous", ...Object.keys(CATEGORY_META)];

export default function MerchantsScreen() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("Tous");

  const fetchMerchants = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/merchants`);
      if (res.ok) setMerchants(await res.json());
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetchMerchants(); }, []);

  const filtered = merchants.filter((m) => {
    const matchCat = activeCategory === "Tous" || m.category === activeCategory;
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.address.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#f97316" />
        <Text style={styles.loadingText}>Chargement des marchands...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Better Call Motaz 🛵</Text>
            <Text style={styles.headerSub}>Livraison à Bizerte</Text>
          </View>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{merchants.length} marchands</Text>
          </View>
        </View>
        {/* Search */}
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un marchand..."
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category filter */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={CATEGORIES}
        keyExtractor={(c) => c}
        contentContainerStyle={styles.catList}
        renderItem={({ item }) => {
          const meta = CATEGORY_META[item];
          const isActive = activeCategory === item;
          return (
            <TouchableOpacity
              style={[styles.catChip, isActive && styles.catChipActive]}
              onPress={() => setActiveCategory(item)}
              activeOpacity={0.7}
            >
              {meta && <Text style={styles.catEmoji}>{meta.emoji}</Text>}
              <Text style={[styles.catLabel, isActive && styles.catLabelActive]}>
                {meta ? meta.label : "Tous"}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* Merchant grid */}
      <FlatList
        data={filtered}
        keyExtractor={(m) => m.id}
        numColumns={2}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.gridRow}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchMerchants(); }} tintColor="#f97316" />}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>🏪</Text>
            <Text style={styles.emptyText}>Aucun marchand trouvé</Text>
          </View>
        }
        renderItem={({ item }) => {
          const meta = CATEGORY_META[item.category] ?? { emoji: "📦", label: item.category, color: "#f3f4f6" };
          return (
            <TouchableOpacity
              style={styles.merchantCard}
              onPress={() => router.push(`/${item.id}`)}
              activeOpacity={0.85}
            >
              <View style={[styles.merchantEmoji, { backgroundColor: meta.color }]}>
                <Text style={styles.merchantEmojiText}>{meta.emoji}</Text>
              </View>
              <Text style={styles.merchantName} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.merchantAddr} numberOfLines={1}>{item.address}</Text>
              <View style={styles.merchantBottom}>
                <View style={styles.merchantCatBadge}>
                  <Text style={styles.merchantCatText}>{meta.label}</Text>
                </View>
                <Text style={styles.merchantArrow}>→</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  centered: { flex: 1, backgroundColor: "#f9fafb", justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { color: "#6b7280", fontSize: 14 },
  header: { backgroundColor: "#fff", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingTop: 8, marginBottom: 12 },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#111827" },
  headerSub: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  headerBadge: { backgroundColor: "#fff7ed", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: "#fed7aa" },
  headerBadgeText: { color: "#ea580c", fontSize: 12, fontWeight: "600" },
  searchWrap: { flexDirection: "row", alignItems: "center", backgroundColor: "#f3f4f6", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 15, color: "#111827" },
  clearBtn: { color: "#9ca3af", fontSize: 16, padding: 2 },
  catList: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  catChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: "#fff", borderRadius: 20, borderWidth: 1.5, borderColor: "#e5e7eb" },
  catChipActive: { backgroundColor: "#f97316", borderColor: "#f97316" },
  catEmoji: { fontSize: 14 },
  catLabel: { fontSize: 13, fontWeight: "600", color: "#374151" },
  catLabelActive: { color: "#fff" },
  grid: { padding: 12, gap: 12 },
  gridRow: { gap: 12 },
  merchantCard: { flex: 1, backgroundColor: "#fff", borderRadius: 18, padding: 14, borderWidth: 1, borderColor: "#f3f4f6", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2, gap: 6 },
  merchantEmoji: { width: 52, height: 52, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  merchantEmojiText: { fontSize: 28 },
  merchantName: { fontSize: 14, fontWeight: "700", color: "#111827", lineHeight: 18 },
  merchantAddr: { fontSize: 11, color: "#9ca3af" },
  merchantBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 2 },
  merchantCatBadge: { backgroundColor: "#f3f4f6", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  merchantCatText: { fontSize: 10, color: "#6b7280", fontWeight: "500" },
  merchantArrow: { color: "#f97316", fontWeight: "700", fontSize: 16 },
  emptyWrap: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: "#9ca3af", fontSize: 15 },
});
