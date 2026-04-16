import { useRef, useState } from "react";
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { WEB_ADMIN_URL } from "@/lib/config";

export default function MapScreen() {
  const webviewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🗺️ Carte en direct</Text>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => webviewRef.current?.reload()}
        >
          <Text style={styles.refreshBtnText}>↺ Actualiser</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Chargement de la carte...</Text>
        </View>
      )}

      <WebView
        ref={webviewRef}
        source={{ uri: WEB_ADMIN_URL }}
        style={styles.webview}
        onLoadEnd={() => setLoading(false)}
        onLoadStart={() => setLoading(true)}
        // Inject JS to hide navbar and switch directly to map tab on mobile
        injectedJavaScript={`
          (function() {
            // Wait for React to hydrate
            setTimeout(function() {
              // Hide top nav and bottom nav, show only the map
              var nav = document.querySelector('nav');
              if (nav) nav.style.display = 'none';
              // Click the Carte tab if available
              var btns = document.querySelectorAll('button');
              btns.forEach(function(b) {
                if (b.textContent && b.textContent.trim() === 'Carte') b.click();
              });
            }, 1500);
          })();
          true;
        `}
        javaScriptEnabled
        domStorageEnabled
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  refreshBtn: { backgroundColor: "#eff6ff", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  refreshBtnText: { color: "#2563eb", fontWeight: "700", fontSize: 13 },
  webview: { flex: 1 },
  loadingOverlay: { position: "absolute", top: 60, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center", backgroundColor: "#f8fafc", zIndex: 10, gap: 12 },
  loadingText: { color: "#64748b", fontSize: 14 },
});
