import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Image, Switch, View } from "react-native";

import { Mapa, type PuntoMapa } from "@/components/Mapa";
import { Badge, Button, C, Card, Field, H2, Loading, Money, Muted, Notice, Row, Screen, T } from "@/components/ui";
import { useDriver } from "@/lib/driver";
import { ESTADO, TIPO, hora, km, llamar, minutos, navegar, pesos, whatsapp } from "@/lib/format";
import { rpc, uploadPrivate } from "@/lib/supabase";
import type { Stop, TripDetail } from "@/lib/types";

const FINAL = ["completed", "canceled"];

export default function Viaje() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { refresh: refreshDriver, position } = useDriver();
  const [t, setT] = useState<TripDetail | null>(null);
  const [error, setError] = useState("");
  const [ahora, setAhora] = useState(() => Date.now());

  const cargar = useCallback(
    () =>
      rpc<TripDetail>("trip_for_driver", { p_trip: id }).then(
        (x) => {
          setT(x);
          setError("");
        },
        (e: Error) => setError(e.message),
      ),
    [id],
  );

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // el pasajero puede pedir cambios o el comercio marcar listo: se revisa seguido
  useEffect(() => {
    if (t && FINAL.includes(t.status)) return;
    const timer = setInterval(() => {
      setAhora(Date.now());
      void cargar();
    }, 5_000);
    return () => clearInterval(timer);
  }, [t, cargar]);

  const hacer = (fn: () => Promise<unknown>) => async () => {
    await fn();
    await cargar();
    await refreshDriver();
  };
  const avanzar = (estado: string) => hacer(() => rpc("advance_trip", { p_trip: id, p_status: estado }));
  const llegue = (seq: number) => hacer(() => rpc("driver_at_stop", { p_trip: id, p_seq: seq }));

  if (!t) return error ? <Screen><Notice tone="danger">{error}</Notice></Screen> : <Loading />;
  if (!t.mine && !FINAL.includes(t.status)) {
    return <Screen><Notice tone="danger">Este viaje ya no es tuyo.</Notice><Button title="Volver al inicio" onPress={() => router.replace("/inicio")} /></Screen>;
  }

  const recoge = t.stops[0];
  const entregas = t.stops.slice(1);
  const siguiente = entregas.find((s) => !s.arrived_at);
  const esPasajero = t.kind === "ride" || t.kind === "parcel";
  const minEspera = recoge.arrived_at ? Math.floor((ahora - new Date(recoge.arrived_at).getTime()) / 60000) : 0;
  const compraPendiente = !!t.order?.requires_purchase && !["ready", "handed_over"].includes(t.order.purchase_status ?? "");
  const efectivoPendiente = esPasajero && t.payment_method === "cash" && !t.cash_status;

  return (
    <Screen>
      <Stack.Screen options={{ title: `${TIPO[t.kind] ?? t.kind} · ${ESTADO[t.status]}` }} />

      {!FINAL.includes(t.status) && <Mapa puntos={puntosDelViaje(t)} yo={position} ruta />}

      <Card>
        <Row style={{ justifyContent: "space-between" }}>
          <View>
            <Muted>{t.service}{t.distance_m ? ` · ${km(t.distance_m)} · ${minutos(t.duration_s)}` : ""}</Muted>
            <Money>{pesos(t.fare)}</Money>
            {Number(t.extra_charges) > 0 && <Muted>Incluye {pesos(t.extra_charges)} de esperas y paradas</Muted>}
          </View>
          <Badge tone={t.status === "completed" ? "ok" : t.status === "canceled" ? "danger" : "navy"}>{ESTADO[t.status]}</Badge>
        </Row>
        {t.internal && <Muted>Envío del comercio con su repartidor (sin costo de Dlux)</Muted>}
        {t.scheduled_for && <Muted>Agendado para las {hora(t.scheduled_for)}</Muted>}
        {t.batch.length > 0 && <Notice tone="navy" icon="layers">Llevas {t.batch.length + 1} pedidos juntos: revisa los demás en Inicio.</Notice>}
      </Card>

      {t.danger && <Notice tone="danger" icon="warning">La ruta pasa por una zona de riesgo. Ve con cuidado.</Notice>}
      {error ? <Notice tone="danger">{error}</Notice> : null}

      {t.status === "completed" && (
        <Card>
          <H2>¡Viaje terminado!</H2>
          <Muted>Se sumó a tus ganancias de hoy.</Muted>
          <Button title="Volver al inicio" onPress={() => router.replace("/inicio")} />
        </Card>
      )}
      {t.status === "canceled" && (
        <Card>
          <H2>El viaje se canceló</H2>
          <Button title="Volver al inicio" onPress={() => router.replace("/inicio")} />
        </Card>
      )}

      {t.pending_change && <CambioPedido t={t} onDone={cargar} />}

      {t.passenger && !FINAL.includes(t.status) && (
        <Card>
          <Row style={{ justifyContent: "space-between" }}>
            <View style={{ flex: 1 }}>
              <Muted>{t.kind === "ride" ? "Pasajero" : "Quien envía"}</Muted>
              <T bold>{t.passenger.name ?? "Cliente"}</T>
            </View>
            {t.passenger.phone && (
              <Row>
                <Button small variant="outline" icon="call" title="" onPress={() => llamar(t.passenger!.phone!)} />
                <Button small variant="outline" icon="logo-whatsapp" title="" onPress={() => whatsapp(t.passenger!.phone!, "Hola, soy tu conductor de Dlux")} />
              </Row>
            )}
          </Row>
        </Card>
      )}

      {t.order && <Pedido t={t} onDone={hacer(async () => {})} />}

      {(t.cash_to_collect != null || t.pay_store != null) && !FINAL.includes(t.status) && (
        <Card>
          <H2>Efectivo</H2>
          {t.pay_store != null && (
            <Row style={{ justifyContent: "space-between" }}>
              <Muted>Pagas al comercio al recoger</Muted>
              <T bold>{pesos(t.pay_store)}</T>
            </Row>
          )}
          {t.cash_to_collect != null && (
            <Row style={{ justifyContent: "space-between" }}>
              <Muted>Cobras al cliente</Muted>
              <T bold style={{ fontSize: 20 }}>{pesos(t.cash_to_collect)}</T>
            </Row>
          )}
          {Number(t.discount) > 0 && <Muted>Ya incluye una promoción de {pesos(t.discount)}: Dlux te la paga.</Muted>}
          {esPasajero && t.cash_status && <CashListo t={t} />}
          {efectivoPendiente && ["arriving", "in_progress"].includes(t.status) && <ReportarEfectivo t={t} onDone={hacer(async () => {})} />}
        </Card>
      )}

      {!FINAL.includes(t.status) && (
        <Card>
          <H2>Ruta</H2>
          <Parada s={recoge} titulo={t.order ? `Recoger en ${t.order.brand}` : "Recoger"} />
          {entregas.map((s, i) => (
            <Parada key={s.seq} s={s} titulo={i === entregas.length - 1 ? "Entregar" : `Parada ${i + 1}`} />
          ))}
        </Card>
      )}

      {t.status === "in_progress" && t.kind === "ride" && <Pausa t={t} onDone={cargar} />}

      {/* Acción principal según el paso del viaje */}
      {t.status === "assigned" && <Button big title="Voy en camino a recoger" icon="navigate" onPress={avanzar("arriving")} />}

      {t.status === "arriving" && !recoge.arrived_at && <Button big title="Ya llegué a recoger" icon="flag" onPress={llegue(1)} />}

      {t.status === "arriving" && recoge.arrived_at && (
        <>
          {esPasajero && (
            <Notice tone={minEspera >= t.free_wait_min ? "warn" : "navy"} icon="time">
              {`Esperando desde las ${hora(recoge.arrived_at)} (${minEspera} min). ${
                minEspera >= t.free_wait_min ? "La espera ya se cobra por minuto." : `Los primeros ${t.free_wait_min} min son gratis.`
              }`}
            </Notice>
          )}
          {compraPendiente && <Notice tone="warn" icon="cart">Termina la compra y sube el ticket para poder salir.</Notice>}
          <Button
            big
            disabled={compraPendiente}
            title={t.kind === "ride" ? "El pasajero ya subió" : t.order ? "Ya recogí el pedido" : "Ya recogí el paquete"}
            icon="play"
            onPress={avanzar("in_progress")}
          />
          {esPasajero && minEspera >= t.free_wait_min && (
            <Button
              variant="danger"
              title="No se presentó (cobrar)"
              onPress={() =>
                new Promise<void>((resolve, reject) =>
                  Alert.alert("¿El pasajero no salió?", "Se cancela el viaje y se le cobra la tarifa por no presentarse; tú la recibes.", [
                    { text: "Seguir esperando", style: "cancel", onPress: () => resolve() },
                    { text: "Sí, cancelar y cobrar", style: "destructive", onPress: () => hacer(() => rpc("no_show", { p_trip: id }))().then(resolve, reject) },
                  ]),
                )
              }
            />
          )}
        </>
      )}

      {t.status === "in_progress" && siguiente && (
        <Button big title={siguiente.seq === t.stops[t.stops.length - 1].seq ? "Ya llegué al destino" : "Ya llegué a la parada"} icon="flag" onPress={llegue(siguiente.seq)} />
      )}
      {t.status === "in_progress" && !siguiente && (
        <>
          {efectivoPendiente && <Notice tone="warn" icon="cash">Captura cuánto efectivo recibiste antes de terminar.</Notice>}
          <Button big variant="ok" title="Terminar viaje" icon="checkmark-done" disabled={efectivoPendiente || !!t.open_pause} onPress={avanzar("completed")} />
        </>
      )}
    </Screen>
  );
}

function Parada({ s, titulo }: { s: Stop; titulo: string }) {
  return (
    <View style={{ gap: 6, paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.border }}>
      <Row style={{ justifyContent: "space-between" }}>
        <T bold>{titulo}</T>
        {s.arrived_at ? <Badge tone="ok">{`llegaste ${hora(s.arrived_at)}`}</Badge> : null}
      </Row>
      <T>{s.address}</T>
      {s.contact_name || s.contact_phone ? <Muted>{[s.contact_name, s.contact_phone].filter(Boolean).join(" · ")}</Muted> : null}
      {s.notes ? <Muted>Nota: {s.notes}</Muted> : null}
      {!s.arrived_at && (
        <Row>
          <View style={{ flex: 1 }}>
            <Button small variant="outline" icon="map" title="Maps" onPress={() => navegar(s.lat, s.lng, "maps")} />
          </View>
          <View style={{ flex: 1 }}>
            <Button small variant="outline" icon="navigate" title="Waze" onPress={() => navegar(s.lat, s.lng, "waze")} />
          </View>
          {s.contact_phone ? (
            <Button small variant="outline" icon="call" title="" onPress={() => llamar(s.contact_phone!)} />
          ) : null}
        </Row>
      )}
    </View>
  );
}

function Pedido({ t, onDone }: { t: TripDetail; onDone: () => Promise<void> }) {
  const o = t.order!;
  return (
    <Card>
      <Row style={{ justifyContent: "space-between" }}>
        <H2>Pedido #{o.code}</H2>
        <Badge tone={o.status === "ready" ? "ok" : "warn"}>{o.status === "ready" ? "Listo" : o.status === "picked_up" ? "Recogido" : "En preparación"}</Badge>
      </Row>
      <Muted>{o.brand} · {o.branch}{o.customer ? ` · para ${o.customer}` : ""}</Muted>
      {o.ready_eta && o.status !== "ready" && <Muted>El comercio dijo que estaría listo a las {hora(o.ready_eta)}</Muted>}
      {o.items.map((i, k) => (
        <Row key={k} style={{ alignItems: "flex-start" }}>
          <T bold>{i.qty}×</T>
          <View style={{ flex: 1 }}>
            <T>{i.name}</T>
            {i.options?.length ? <Muted>{i.options.map((op) => op.name).filter(Boolean).join(", ")}</Muted> : null}
          </View>
        </Row>
      ))}
      {o.notes ? <Notice tone="navy" icon="chatbubble-ellipses">{o.notes}</Notice> : null}
      {o.requires_purchase && <Compra t={t} onDone={onDone} />}
    </Card>
  );
}

/** Compra en tienda: el conductor paga, fotografía el ticket y captura el total. */
function Compra({ t, onDone }: { t: TripDetail; onDone: () => Promise<void> }) {
  const { session } = useDriver();
  const o = t.order!;
  const [total, setTotal] = useState("");
  const [ref, setRef] = useState("");
  const [foto, setFoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  if (["ready", "handed_over"].includes(o.purchase_status ?? "")) return <Notice tone="ok" icon="checkmark-circle">Compra registrada con su ticket.</Notice>;
  return (
    <View style={{ gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border }}>
      <T bold>Compra en tienda</T>
      <Muted>Compra los productos (máximo {pesos(o.purchase_max)}). Si algo no hay o cambia de precio, avísale al cliente.</Muted>
      <Field label="Total del ticket" value={total} onChangeText={setTotal} keyboardType="decimal-pad" placeholder="0.00" />
      <Field label="Folio del ticket (opcional)" value={ref} onChangeText={setRef} />
      {foto && <Image source={{ uri: foto.uri }} style={{ width: "100%", height: 180, borderRadius: 10 }} resizeMode="cover" />}
      <Button
        variant="outline"
        icon="camera"
        title={foto ? "Tomar otra foto" : "Foto del ticket"}
        onPress={async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          const r = perm.granted
            ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
            : await ImagePicker.launchImageLibraryAsync({ quality: 0.6, mediaTypes: ["images"] });
          if (!r.canceled) setFoto(r.assets[0]);
        }}
      />
      <Button
        title="Registrar compra"
        disabled={!foto || !Number(total)}
        onPress={async () => {
          const path = await uploadPrivate(session!.user.id, "tickets", foto!.uri, foto!.mimeType ?? "image/jpeg");
          await rpc("finish_purchase", { p_order: o.id, p_spent: Number(total), p_receipt_url: path, p_ticket_ref: ref || null });
          await onDone();
        }}
      />
    </View>
  );
}

function ReportarEfectivo({ t, onDone }: { t: TripDetail; onDone: () => Promise<void> }) {
  const debe = Number(t.cash_to_collect ?? 0);
  const [recibido, setRecibido] = useState(debe.toFixed(2));
  const [credito, setCredito] = useState(true);
  const [noPudo, setNoPudo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const r = Number(recibido || 0);
  return (
    <View style={{ gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border }}>
      <Field label="¿Cuánto te dio?" value={recibido} onChangeText={setRecibido} keyboardType="decimal-pad" />
      {r > debe && (
        <Row style={{ justifyContent: "space-between" }}>
          <Muted style={{ flex: 1 }}>No traigo cambio: los {pesos(r - debe)} de más quedan como saldo a favor del cliente</Muted>
          <Switch value={credito} onValueChange={setCredito} />
        </Row>
      )}
      {r < debe && (
        <>
          <Notice tone="warn">{`Faltan ${pesos(debe - r)}. Le pediremos al cliente que lo confirme en su app y Dlux te lo repone.`}</Notice>
          <Row style={{ justifyContent: "space-between" }}>
            <Muted style={{ flex: 1 }}>El cliente no puede confirmar (se fue, sin teléfono…)</Muted>
            <Switch value={noPudo} onValueChange={setNoPudo} />
          </Row>
          {noPudo && <Field label="¿Qué pasó?" value={motivo} onChangeText={setMotivo} />}
        </>
      )}
      <Button
        title="Registrar efectivo"
        icon="cash"
        onPress={async () => {
          if (r > debe && !credito) {
            Alert.alert("Dale el cambio", `Captura ${pesos(debe)} y dale el cambio al cliente, o deja el excedente como saldo a favor.`);
            return;
          }
          await rpc("report_cash", { p_trip: t.id, p_received: r, p_excess_to_credit: credito, p_customer_unable: noPudo, p_reason: motivo || null });
          await onDone();
        }}
      />
    </View>
  );
}

function CashListo({ t }: { t: TripDetail }) {
  const texto: Record<string, string> = {
    ok: "Efectivo completo registrado.",
    overpaid_credit: "Registrado: el excedente quedó como saldo a favor del cliente.",
    underpaid_pending: "Esperando que el cliente confirme lo que faltó.",
    underpaid_confirmed: "El cliente confirmó que pagó de menos: Dlux te lo repone.",
    underpaid_unconfirmed: "Registrado sin confirmación del cliente: Dlux lo revisa.",
    disputed: "El cliente dice que sí pagó: Dlux lo está revisando.",
    resolved: "Dlux ya resolvió el efectivo de este viaje.",
  };
  return <Notice tone={t.cash_status === "ok" || t.cash_status === "overpaid_credit" ? "ok" : "warn"} icon="cash">{`Recibiste ${pesos(t.cash_received)}. ${texto[t.cash_status ?? ""] ?? ""}`}</Notice>;
}

function CambioPedido({ t, onDone }: { t: TripDetail; onDone: () => Promise<void> }) {
  const c = t.pending_change!;
  const responder = (ok: boolean) => async () => {
    await rpc("respond_trip_change", { p_change: c.id, p_approve: ok });
    await onDone();
  };
  return (
    <Card style={{ borderColor: C.yellow, borderWidth: 2 }}>
      <Row>
        <Ionicons name="swap-horizontal" size={22} color={C.navy} />
        <H2>{c.kind === "add_stop" ? "El pasajero quiere agregar una parada" : "El pasajero quiere cambiar el destino"}</H2>
      </Row>
      <T>{c.address}</T>
      <Muted>La tarifa se recalcula con la ruta nueva.</Muted>
      <Row>
        <View style={{ flex: 1 }}><Button small variant="ok" title="Aceptar" onPress={responder(true)} /></View>
        <View style={{ flex: 1 }}><Button small variant="outline" title="No puedo" onPress={responder(false)} /></View>
      </Row>
    </Card>
  );
}

/** Paradas durante el viaje (el pasajero baja a algo): 2 min gratis y luego por minuto, si el pasajero acepta. */
function Pausa({ t, onDone }: { t: TripDetail; onDone: () => Promise<void> }) {
  const p = t.open_pause;
  if (!p) {
    return <Button variant="outline" icon="pause-circle" title="El pasajero pidió una parada" onPress={async () => { await rpc("start_pause", { p_trip: t.id }); await onDone(); }} />;
  }
  return (
    <Card>
      <T bold>Parada desde las {hora(p.started_at)}</T>
      <Muted>
        {p.accepted == null ? "Esperando que el pasajero acepte el cobro por minuto…" : p.accepted ? "El pasajero aceptó: después de los minutos gratis se cobra por minuto." : "El pasajero no aceptó el cobro: la parada no se cobra."}
      </Muted>
      <Button
        icon="play-circle"
        title="Seguir el viaje"
        onPress={async () => {
          const cargo = await rpc<number>("end_pause", { p_trip: t.id });
          if (Number(cargo) > 0) Alert.alert("Parada cobrada", `Se sumaron ${pesos(cargo)} a la tarifa.`);
          await onDone();
        }}
      />
    </Card>
  );
}

/** Paradas que faltan, en orden: R = recoger, números = paradas intermedias, E = entrega final. */
function puntosDelViaje(t: TripDetail): PuntoMapa[] {
  const ultima = t.stops[t.stops.length - 1]?.seq;
  return t.stops
    .filter((s) => !s.done_at)
    .map((s) => ({
      lat: s.lat,
      lng: s.lng,
      tipo: s.kind === "pickup" ? "recoge" : s.seq === ultima ? "entrega" : "parada",
      titulo: s.address,
    }));
}
