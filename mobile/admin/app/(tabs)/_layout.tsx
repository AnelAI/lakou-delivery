import { Tabs } from "expo-router";
import { View, Text, StyleSheet } from "react-native";

function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  return (
    <View style={styles.tabItem}>
      <Text style={{ fontSize: 20 }}>{emoji}</Text>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="📊" label="Tableau de bord" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="deliveries"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="📦" label="Courses" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="couriers"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏍️" label="Coursiers" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🗺️" label="Carte" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 72,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    paddingBottom: 8,
    paddingTop: 6,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -2 },
  },
  tabItem: { alignItems: "center", gap: 2, paddingTop: 2 },
  tabLabel: { fontSize: 10, color: "#9ca3af", fontWeight: "500" },
  tabLabelActive: { color: "#2563eb", fontWeight: "700" },
});
