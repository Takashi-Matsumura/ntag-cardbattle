import { Tabs } from "expo-router";
import { Text } from "react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#1a1a2e" },
        headerTintColor: "#fff",
        tabBarStyle: { backgroundColor: "#1a1a2e", borderTopColor: "#2a2a4e" },
        tabBarActiveTintColor: "#e94560",
        tabBarInactiveTintColor: "#888",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "ホーム",
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>⚔️</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="mycard"
        options={{
          title: "マイカード",
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 20 }}>🃏</Text>
          ),
        }}
      />
    </Tabs>
  );
}
