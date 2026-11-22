import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { C, Card, H2, Loading, Money, Muted, Notice, Row, Screen, T } from "@/components/ui";
import { MOVIMIENTO, fecha, hora, pesos } from "@/lib/format";
import { rpc } from "@/lib/supabase";
import type { Earnings } from "@/lib/types";

const RANGOS = [
  ["hoy", "Hoy", 0],
  ["semana", "7 días", 6],
  ["mes", "30 días", 29],
] as const;

// fecha local (Guadalajara) en formato AAAA-MM-DD
const dia = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export default function Ganancias() {
  const [rango, setRango] = useState<(typeof RANGOS)[number][0]>("hoy");
  const [e, setE] = useState<Earnings | null>(null);
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      const dias = RANGOS.find((r) => r[0] === rango)![2];
      const hasta = new Date();
      const desde = new Date(hasta.getTime() - dias * 86400000);
      rpc<Earnings>("driver_earnings", { p_from: dia(desde), p_to: dia(hasta) })
        .then((x) => { setE(x); setError(""); })
        .catch((err: Error) => setError(err.message));
    }, [rango]),
  );

  return (
    <Screen>
      <Row style={{ backgroundColor: C.surface, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: C.border }}>
        {RANGOS.map(([k, label]) => (
          <Pressable key={k} onPress={() => setRango(k)} style={{ flex: 1, paddingVertical: 8, borderRadius: 9, backgroundColor: rango === k ? C.navy : "transparent" }}>
            <Text style={{ textAlign: "center", fontWeight: "700", color: rango === k ? "#fff" : C.muted }}>{label}</Text>
          </Pressable>
        ))}
      </Row>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {!e ? (
        <Loading />
      ) : (
        <>
          <Card>
            <Muted>Ganaste</Muted>
            <Money size={34}>{pesos(e.earned)}</Money>
            <Muted>{e.trips} {e.trips === 1 ? "viaje" : "viajes"}{Number(e.tips) > 0 ? ` · ${pesos(e.tips)} de propinas` : ""}</Muted>
            <View style={{ gap: 4, marginTop: 6 }}>
              <Linea label="Impuestos retenidos (ISR e IVA)" valor={-e.withheld} />
              {Number(e.owner_share) > 0 && <Linea label="Parte del dueño del vehículo" valor={-e.owner_share} />}
              {Number(e.cash_collected) > 0 && <Linea label="Efectivo que ya cobraste" valor={-e.cash_collected} />}
              <Linea label="Movimiento neto en tu saldo" valor={e.net} bold />
            </View>
          </Card>
          <Card>
            <Row style={{ justifyContent: "space-between" }}>
              <Muted>Tu saldo con Dlux</Muted>
              <T bold style={{ fontSize: 18, color: Number(e.balance) < 0 ? C.danger : C.ok }}>{pesos(e.balance)}</T>
            </Row>
            <Muted>
              {Number(e.balance) < 0
                ? "Debes a Dlux por retenciones de viajes en efectivo: se descuenta de tu próximo pago."
                : "Dlux te transfiere tu saldo a tu cuenta. Las retenciones aparecen en tu constancia mensual."}
            </Muted>
          </Card>
          {e.days.length > 1 && (
            <Card>
              <H2>Por día</H2>
              {e.days.map((d) => (
                <Row key={d.day} style={{ justifyContent: "space-between" }}>
                  <T>{fecha(`${d.day}T12:00:00`)}</T>
                  <Muted>{d.trips} viajes</Muted>
                  <T bold>{pesos(d.earned)}</T>
                </Row>
              ))}
            </Card>
          )}
          <Card>
            <H2>Movimientos</H2>
            {e.entries.length === 0 && <Muted>Todavía no hay movimientos en estas fechas.</Muted>}
            {e.entries.map((m, i) => (
              <Row key={i} style={{ justifyContent: "space-between", paddingVertical: 4 }}>
                <View style={{ flex: 1 }}>
                  <T>{MOVIMIENTO[m.kind] ?? m.kind}</T>
                  <Muted>{fecha(m.at)} · {hora(m.at)}{m.note ? ` · ${m.note}` : ""}</Muted>
                </View>
                <T bold style={{ color: Number(m.amount) < 0 ? C.danger : C.ok }}>{pesos(m.amount)}</T>
              </Row>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

function Linea({ label, valor, bold }: { label: string; valor: number; bold?: boolean }) {
  return (
    <Row style={{ justifyContent: "space-between" }}>
      <Muted>{label}</Muted>
      <T bold={bold}>{pesos(valor)}</T>
    </Row>
  );
}
