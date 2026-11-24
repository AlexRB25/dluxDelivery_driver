import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import { Pressable, Text } from "react-native";

import { Badge, Button, C, Card, H2, Item, Loading, Money, Muted, Notice, Row, Screen, T } from "@/components/ui";
import { useDriver } from "@/lib/driver";
import { fecha, pesos, whatsapp } from "@/lib/format";
import { apiUrl, rpc, soporteWhatsapp, supabase } from "@/lib/supabase";
import type { Membership } from "@/lib/types";

const MESES = [1, 3, 6, 12];

/** Membresía de conductor: Dlux cobra una cuota fija al mes en vez de comisión por viaje. */
export default function Membresia() {
  const { refresh } = useDriver();
  const [m, setM] = useState<Membership | null>(null);
  const [meses, setMeses] = useState(1);
  const [error, setError] = useState("");
  const [pagando, setPagando] = useState(false);

  const leer = useCallback(() => rpc<Membership>("driver_membership"), []);
  useEffect(() => {
    leer().then(setM, (e: Error) => setError(e.message));
  }, [leer]);

  const pagar = async () => {
    setError("");
    setPagando(true);
    try {
      const { data } = await supabase().auth.getSession();
      const res = await fetch(`${apiUrl}/api/driver/membresia`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body: JSON.stringify({ months: meses }),
      });
      const r = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !r.url) throw new Error(r.error ?? "No se pudo abrir el pago. Intenta de nuevo.");
      await WebBrowser.openBrowserAsync(r.url, { toolbarColor: C.navy, controlsColor: C.yellow });
      // al regresar del pago: volver a leer (el pago con tarjeta ya quedó; OXXO llega después)
      setM(await leer());
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPagando(false);
    }
  };

  if (!m) return error ? <Screen><Notice tone="danger">{error}</Notice></Screen> : <Loading />;
  const precio = Number(m.plan?.price_month ?? 0);

  return (
    <Screen>
      <Card>
        <Row style={{ justifyContent: "space-between" }}>
          <H2>{m.plan?.name ?? "Membresía Dlux Driver"}</H2>
          <Badge tone={m.ok ? "ok" : "danger"}>{m.ok ? "al día" : "pendiente"}</Badge>
        </Row>
        {m.plan && <Money>{pesos(precio)}<Text style={{ fontSize: 16, color: C.muted }}> / mes</Text></Money>}
        <Muted>
          {m.ok
            ? `Vale hasta el ${fecha(m.until)}. Si pagas antes, los meses se suman a partir de esa fecha.`
            : m.until
              ? `Se venció el ${fecha(m.until)}. Págala para volver a recibir viajes.`
              : "Dlux no te cobra comisión por viaje: pagas una cuota fija al mes y todo lo que cobras es tuyo."}
        </Muted>
        {m.plan && m.plan.grace_days > 0 && <Muted>Tienes {m.plan.grace_days} días de gracia después de que vence.</Muted>}
      </Card>

      {m.internal && <Notice tone="navy" icon="storefront">Como repartidor interno de un comercio no necesitas membresía para sus envíos. La necesitas para recibir viajes de Dlux.</Notice>}

      {!m.plan ? (
        <Notice tone="warn">Dlux todavía no publica el precio de la membresía.</Notice>
      ) : apiUrl ? (
        <Card>
          <T bold>¿Cuántos meses pagas?</T>
          <Row style={{ flexWrap: "wrap" }}>
            {MESES.map((n) => (
              <Pressable
                key={n}
                onPress={() => setMeses(n)}
                style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5, borderColor: C.navy, backgroundColor: meses === n ? C.navy : "transparent" }}
              >
                <Text style={{ color: meses === n ? "#fff" : C.navy, fontWeight: "700" }}>{n} {n === 1 ? "mes" : "meses"}</Text>
              </Pressable>
            ))}
          </Row>
          <Row style={{ justifyContent: "space-between" }}>
            <Muted>Total</Muted>
            <T bold style={{ fontSize: 18 }}>{pesos(precio * meses)}</T>
          </Row>
          {error ? <Notice tone="danger" icon="alert-circle">{error}</Notice> : null}
          <Button big variant="yellow" icon="card" title={pagando ? "Abriendo el pago…" : "Pagar con tarjeta u OXXO"} disabled={pagando} onPress={pagar} />
          <Muted>El pago es con Stripe. Con OXXO te dan una referencia y tu membresía se activa cuando pagas en tienda.</Muted>
        </Card>
      ) : null}

      {soporteWhatsapp ? (
        <Button
          variant="outline"
          icon="logo-whatsapp"
          title={apiUrl ? "Pagar en efectivo o transferencia" : "Pagar membresía con Dlux"}
          onPress={() => whatsapp(soporteWhatsapp, "Hola, quiero pagar mi membresía de Dlux Driver")}
        />
      ) : null}

      {m.payments.length > 0 && (
        <>
          <H2>Tus pagos</H2>
          {m.payments.map((p) => (
            <Item
              key={p.at}
              icon={p.method === "online" ? "card" : "cash"}
              title={`Pagado el ${fecha(p.at)}`}
              subtitle={`${p.method === "online" ? "En línea" : "Con Dlux"} · vale hasta el ${fecha(p.until)}`}
            />
          ))}
        </>
      )}
    </Screen>
  );
}
