import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "../global.css";

export default function RootLayout() {
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
      </Stack>
    </>
  );
}
