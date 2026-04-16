import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor="#111827" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#111827" } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="home" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
