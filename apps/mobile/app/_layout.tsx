import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { socket } from "@/lib/socket";
import "../global.css";

export default function RootLayout() {
  useEffect(() => {
    socket.connect();
    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#1a1a2e" },
          headerTintColor: "#fff",
          contentStyle: { backgroundColor: "#16213e" },
        }}
      >
        <Stack.Screen
          name="(tabs)"
          options={{ headerShown: false }}
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
