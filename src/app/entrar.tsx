import { useRouter } from "expo-router";
import { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button, C, Card, Field, Muted, Notice } from "@/components/ui";
import { authErrorMessage, supabase, supabaseConfigured } from "@/lib/supabase";

/** Entrar o crear cuenta. La misma cuenta sirve en Dlux Delivery y Dlux Go. */
export default function Entrar() {
  const router = useRouter();
  const [modo, setModo] = useState<"entrar" | "crear">("entrar");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [aviso, setAviso] = useState("");

  const enviar = async () => {
    setAviso("");
    const db = supabase().auth;
    if (modo === "entrar") {
      const { error } = await db.signInWithPassword({ email: correo.trim(), password: clave });
      if (error) throw new Error(authErrorMessage(error));
      router.replace("/inicio");
      return;
    }
    if (nombre.trim().length < 3) throw new Error("Escribe tu nombre completo");
    if (telefono.replace(/\D/g, "").length !== 10) throw new Error("Escribe tu celular a 10 dígitos");
    const { data, error } = await db.signUp({
      email: correo.trim(),
      password: clave,
      options: { data: { full_name: nombre.trim(), phone: telefono.replace(/\D/g, "") } },
    });
    if (error) throw new Error(authErrorMessage(error));
    if (!data.session) {
      setAviso("Te mandamos un correo para confirmar tu cuenta. Ábrelo y luego entra aquí.");
      setModo("entrar");
      return;
    }
    router.replace("/inicio");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.navy }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, flexGrow: 1, justifyContent: "center" }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: "center", gap: 8 }}>
            <View style={{ backgroundColor: C.gray, borderRadius: 28, padding: 14 }}>
              <Image source={require("@/assets/images/splash-icon.png")} style={{ width: 84, height: 84 }} />
            </View>
            <Text style={{ color: "#fff", fontSize: 28, fontWeight: "800" }}>
              Dlux <Text style={{ color: C.yellow }}>Driver</Text>
            </Text>
            <Text style={{ color: C.gray, textAlign: "center" }}>Reparte comida, compras y paquetes, y haz viajes de Dlux Go en una sola app.</Text>
          </View>
          {!supabaseConfigured && <Notice tone="danger">Falta configurar EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.</Notice>}
          <Card>
            {aviso ? <Notice tone="ok">{aviso}</Notice> : null}
            {modo === "crear" && (
              <>
                <Field label="Nombre completo" value={nombre} onChangeText={setNombre} autoComplete="name" />
                <Field label="Celular" value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" maxLength={14} hint="Lo ve el cliente cuando llevas su viaje" />
              </>
            )}
            <Field label="Correo" value={correo} onChangeText={setCorreo} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
            <Field label="Contraseña" value={clave} onChangeText={setClave} secureTextEntry autoComplete={modo === "crear" ? "new-password" : "current-password"} />
            <Button title={modo === "entrar" ? "Entrar" : "Crear cuenta"} onPress={enviar} disabled={!correo || clave.length < 6} />
            <Button
              variant="outline"
              title={modo === "entrar" ? "Soy nuevo: crear cuenta" : "Ya tengo cuenta"}
              onPress={() => setModo(modo === "entrar" ? "crear" : "entrar")}
            />
            <Muted style={{ textAlign: "center" }}>Si ya usas Dlux Delivery o Dlux Go, entra con la misma cuenta.</Muted>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
