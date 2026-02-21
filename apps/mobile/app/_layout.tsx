import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { getSettings } from "@/lib/settings";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import "../global.css";

export default function RootLayout() {
  useEffect(() => {
    getSettings().then((s) => {
      if (s.onlineMode && s.serverUrl) {
        connectSocket(s.serverUrl);
      }
    });
    return () => {
      disconnectSocket();
    };
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#0f0f1a" },
          headerTintColor: "#fff",
          contentStyle: { backgroundColor: "#0f0f1a" },
        }}
      >
        <Stack.Screen
          name="(tabs)"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="battle/tutorial"
          options={{
            title: "チュートリアル",
          }}
        />
        <Stack.Screen
          name="battle/[roomId]"
          options={{
            title: "バトル",
            headerBackVisible: false,
            gestureEnabled: false,
          }}
        />
      </Stack>
    </>
  );
}
