import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" backgroundColor="#fff" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="[merchantId]" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="track/[orderNumber]" options={{ animation: "slide_from_bottom" }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
