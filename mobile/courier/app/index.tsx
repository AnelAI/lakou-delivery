"use client";
import { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, KeyboardAvoidingView, Platform, Image,
} from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getCourier } from "@/lib/api";

const STORAGE_KEY = "lakou_courier_id";

export default function EntryScreen() {
  const [courierId, setCourierId] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // Auto-login if saved
    AsyncStorage.getItem(STORAGE_KEY).then(async (saved) => {
      if (saved) {
        const courier = await getCourier(saved);
        if (courier) {
          router.replace({ pathname: "/home", params: { id: saved } });
          return;
        }
      }
      setChecking(false);
    });
  }, []);

  const handleConnect = async () => {
    const trimmed = courierId.trim();
    if (!trimmed) { setError("Entrez votre identifiant"); return; }
    setLoading(true);
    setError("");
    const courier = await getCourier(trimmed);
    if (!courier) {
      setError("Identifiant introuvable. Vérifiez avec votre admin.");
      setLoading(false);
      return;
    }
    await AsyncStorage.setItem(STORAGE_KEY, trimmed);
    router.replace({ pathname: "/home", params: { id: trimmed } });
  };

  if (checking) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.inner}>
        {/* Logo */}
        <View style={styles.logoWrap}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoEmoji}>🏍️</Text>
          </View>
          <Text style={styles.title}>Lakou Delivery</Text>
          <Text style={styles.subtitle}>Application Coursier</Text>
        </View>

        {/* Form */}
        <View style={styles.card}>
          <Text style={styles.label}>Votre identifiant coursier</Text>
          <TextInput
            style={[styles.input, error ? styles.inputError : null]}
            placeholder="Collez ou tapez votre ID"
            placeholderTextColor="#6b7280"
            value={courierId}
            onChangeText={(v) => { setCourierId(v); setError(""); }}
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={handleConnect}
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleConnect}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Se connecter →</Text>
            }
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          L&apos;identifiant vous est fourni par l&apos;administrateur Lakou Delivery.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111827" },
  centered: { flex: 1, backgroundColor: "#111827", justifyContent: "center", alignItems: "center" },
  inner: { flex: 1, justifyContent: "center", paddingHorizontal: 24, gap: 24 },
  logoWrap: { alignItems: "center", gap: 8 },
  logoCircle: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: "#1d4ed8", justifyContent: "center", alignItems: "center",
    marginBottom: 4,
  },
  logoEmoji: { fontSize: 36 },
  title: { fontSize: 26, fontWeight: "800", color: "#fff", letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: "#9ca3af" },
  card: {
    backgroundColor: "#1f2937", borderRadius: 20, padding: 20,
    gap: 12, borderWidth: 1, borderColor: "#374151",
  },
  label: { fontSize: 14, fontWeight: "600", color: "#d1d5db" },
  input: {
    backgroundColor: "#111827", borderRadius: 12, borderWidth: 1,
    borderColor: "#374151", color: "#fff", fontSize: 15,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  inputError: { borderColor: "#ef4444" },
  errorText: { fontSize: 13, color: "#f87171" },
  btn: {
    backgroundColor: "#2563eb", borderRadius: 14,
    paddingVertical: 16, alignItems: "center",
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  hint: { fontSize: 12, color: "#6b7280", textAlign: "center", lineHeight: 18 },
});
