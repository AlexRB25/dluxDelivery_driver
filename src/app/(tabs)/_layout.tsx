import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";

import { C, Loading } from "@/components/ui";
import { useDriver } from "@/lib/driver";

export default function TabsLayout() {
  const { loading, session } = useDriver();
  if (loading) return <Loading />;
  if (!session) return <Redirect href="/entrar" />;
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: C.navy },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "700" },
        tabBarActiveTintColor: C.navy,
        tabBarInactiveTintColor: C.muted,
      }}
    >
      <Tabs.Screen name="inicio" options={{ title: "Dlux Driver", tabBarLabel: "Inicio", tabBarIcon: ({ color, size }) => <Ionicons name="speedometer" color={color} size={size} /> }} />
      <Tabs.Screen name="ganancias" options={{ title: "Ganancias", tabBarIcon: ({ color, size }) => <Ionicons name="wallet" color={color} size={size} /> }} />
      <Tabs.Screen name="cuenta" options={{ title: "Cuenta", tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" color={color} size={size} /> }} />
    </Tabs>
  );
}
