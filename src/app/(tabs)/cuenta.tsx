import { useRouter } from "expo-router";
import { Alert, View } from "react-native";

import { Badge, Button, Card, H2, Item, Loading, Muted, Screen } from "@/components/ui";
import { useDriver } from "@/lib/driver";
import { VEHICULO, fecha } from "@/lib/format";
import { supabase } from "@/lib/supabase";

export default function Cuenta() {
  const router = useRouter();
  const { status, session, goOffline } = useDriver();
  if (!status) return <Loading />;
  const s = status.registered ? status : null;

  return (
    <Screen>
      <Card>
        <H2>{session?.user.user_metadata?.full_name ?? "Mi cuenta"}</H2>
        <Muted>{session?.user.email}</Muted>
        {s && (
          <Badge tone={s.status === "approved" ? "ok" : s.status === "suspended" ? "danger" : "warn"}>
            {s.status === "approved" ? "Conductor aprobado" : s.status === "suspended" ? "Suspendido" : "En revisión"}
          </Badge>
        )}
      </Card>

      <View style={{ gap: 8 }}>
        <Item icon="person" title="Mis datos" subtitle="Nombre y celular" onPress={() => router.push("/perfil")} />
        {s && (
          <>
            <Item
              icon="document-text"
              title="Mis documentos"
              subtitle={s.missing_docs.length ? `Faltan ${s.missing_docs.length}` : "Licencia, INE y más"}
              onPress={() => router.push("/documentos")}
            />
            <Item
              icon="car"
              title="Mis vehículos"
              subtitle={s.vehicle ? `Trabajas con: ${VEHICULO[s.vehicle.kind] ?? s.vehicle.kind} ${s.vehicle.plate ?? ""}` : "Registra tu vehículo"}
              onPress={() => router.push("/vehiculos")}
            />
            <Item icon="receipt" title="Datos fiscales" subtitle={s.tax_ok ? "RFC registrado" : "Falta tu RFC"} onPress={() => router.push("/fiscal")} />
            <Item
              icon="card"
              title="Membresía"
              subtitle={s.subscription_ok ? `Al día${s.subscription_until ? ` hasta el ${fecha(s.subscription_until)}` : ""}` : "Vencida o sin pagar"}
              right={<Badge tone={s.subscription_ok ? "ok" : "danger"}>{s.subscription_ok ? "al día" : "pendiente"}</Badge>}
            />
            {s.internal_brands.length > 0 && <Item icon="storefront" title="Repartidor de" subtitle={s.internal_brands.join(", ")} />}
          </>
        )}
      </View>

      <Button
        variant="outline"
        icon="log-out"
        title="Cerrar sesión"
        onPress={() =>
          Alert.alert("¿Cerrar sesión?", "Dejarás de recibir viajes.", [
            { text: "Cancelar", style: "cancel" },
            {
              text: "Cerrar sesión",
              style: "destructive",
              onPress: async () => {
                if (s?.online) await goOffline().catch(() => {});
                await supabase().auth.signOut();
                router.replace("/entrar");
              },
            },
          ])
        }
      />
    </Screen>
  );
}
