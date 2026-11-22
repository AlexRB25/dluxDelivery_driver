import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { C } from "@/components/ui";
import { DriverProvider } from "@/lib/driver";

export default function RootLayout() {
  return (
    <DriverProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: C.navy },
          headerTintColor: "#fff",
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: C.background },
          headerBackTitle: "Atrás",
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="entrar" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="oferta/[id]" options={{ presentation: "fullScreenModal", headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="viaje/[id]" options={{ title: "Viaje" }} />
        <Stack.Screen name="documentos" options={{ title: "Mis documentos" }} />
        <Stack.Screen name="vehiculos" options={{ title: "Mis vehículos" }} />
        <Stack.Screen name="fiscal" options={{ title: "Datos fiscales" }} />
        <Stack.Screen name="perfil" options={{ title: "Mis datos" }} />
      </Stack>
    </DriverProvider>
  );
}
