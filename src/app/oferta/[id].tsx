import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View, Vibration } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button, C, Card, Muted, Notice, Row, T } from "@/components/ui";
import { useDriver } from "@/lib/driver";
import { TIPO, km, minutos, pesos } from "@/lib/format";
import { rpc } from "@/lib/supabase";
import type { TripDetail } from "@/lib/types";

/** Oferta de viaje: aceptar o rechazar antes de que se acabe el tiempo. */
export default function Oferta() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { status, refresh } = useDriver();
  const [t, setT] = useState<TripDetail | null>(null);
  const [error, setError] = useState("");
  const inicial = status?.registered && status.offer?.trip_id === id ? status.offer.expires_in : 20;
  const [queda, setQueda] = useState(inicial);

  useEffect(() => {
    rpc<TripDetail>("trip_for_driver", { p_trip: id }).then(setT).catch((e: Error) => setError(e.message));
  }, [id]);

  useEffect(() => {
    const timer = setInterval(() => setQueda((q) => q - 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (queda <= 0) {
      Vibration.cancel();
      router.back();
    }
  }, [queda, router]);

  const cerrar = async () => {
    Vibration.cancel();
    await refresh();
  };

  const recoge = t?.stops[0];
  const deja = t?.stops[t.stops.length - 1];
  const paradas = t ? t.stops.length - 2 : 0;
  const gana = t ? Number(t.fare) : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.navy }}>
      <View style={{ flex: 1, padding: 16, gap: 12 }}>
        <Row style={{ justifyContent: "space-between" }}>
          <Text style={{ color: C.yellow, fontWeight: "800", fontSize: 16 }}>NUEVO {t ? (TIPO[t.kind] ?? t.kind).toUpperCase() : "VIAJE"}</Text>
          <View style={{ backgroundColor: queda <= 5 ? C.danger : C.yellow, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 }}>
            <Text style={{ color: queda <= 5 ? "#fff" : C.navy, fontWeight: "800", fontSize: 18 }}>{Math.max(0, queda)} s</Text>
          </View>
        </Row>

        {error ? <Notice tone="danger">{error}</Notice> : null}

        {t && (
          <>
            <View style={{ alignItems: "center", paddingVertical: 8 }}>
              <Text style={{ color: "#fff", fontSize: 44, fontWeight: "900" }}>{pesos(gana)}</Text>
              <Text style={{ color: C.gray, fontSize: 15 }}>
                {t.service} · {km(t.distance_m)} · {minutos(t.duration_s)}
              </Text>
            </View>

            {t.danger && <Notice tone="danger" icon="warning">Parte de la ruta pasa por una zona de riesgo.</Notice>}

            <Card style={{ gap: 12 }}>
              <Row style={{ alignItems: "flex-start" }}>
                <Ionicons name="radio-button-on" size={20} color={C.ok} />
                <View style={{ flex: 1 }}>
                  <Muted>Recoges{t.order ? ` en ${t.order.brand}` : ""}</Muted>
                  <T bold>{recoge?.address}</T>
                </View>
              </Row>
              {paradas > 0 && <Muted>+ {paradas} {paradas === 1 ? "parada" : "paradas"} en el camino</Muted>}
              <Row style={{ alignItems: "flex-start" }}>
                <Ionicons name="location" size={20} color={C.danger} />
                <View style={{ flex: 1 }}>
                  <Muted>Entregas</Muted>
                  <T bold>{deja?.address}</T>
                </View>
              </Row>
            </Card>

            <Card>
              <Row style={{ justifyContent: "space-between" }}>
                <Muted>Pago del cliente</Muted>
                <T bold>{t.payment_method === "cash" ? "Efectivo" : "Tarjeta"}</T>
              </Row>
              {t.cash_to_collect != null && (
                <Row style={{ justifyContent: "space-between" }}>
                  <Muted>Cobras en efectivo</Muted>
                  <T bold>{pesos(t.cash_to_collect)}</T>
                </Row>
              )}
              {t.pay_store != null && (
                <Row style={{ justifyContent: "space-between" }}>
                  <Muted>Pagas al comercio al recoger</Muted>
                  <T bold>{pesos(t.pay_store)}</T>
                </Row>
              )}
              {t.order?.requires_purchase && <Notice tone="navy" icon="cart">Compras tú en la tienda (hasta {pesos(t.order.purchase_max)}) y subes el ticket.</Notice>}
              {t.scheduled_for && <Notice tone="navy" icon="calendar">Viaje agendado</Notice>}
            </Card>
          </>
        )}

        <View style={{ flex: 1 }} />
        <Button
          big
          variant="yellow"
          title="Aceptar"
          icon="checkmark-circle"
          disabled={!t}
          onPress={async () => {
            await rpc("accept_trip", { p_trip: id });
            await cerrar();
            router.replace({ pathname: "/viaje/[id]", params: { id } });
          }}
        />
        <Button
          variant="danger"
          title="Rechazar"
          onPress={async () => {
            try {
              await rpc("reject_offer", { p_trip: id });
            } finally {
              await cerrar();
              router.back();
            }
          }}
        />
      </View>
    </SafeAreaView>
  );
}
