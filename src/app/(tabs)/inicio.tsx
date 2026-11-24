import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Linking, Switch, View } from "react-native";

import { Badge, Button, C, Card, H2, Item, Loading, Money, Muted, Notice, Row, Screen, T } from "@/components/ui";
import { abrirPermisoBurbuja, burbujaDisponible, permisoBurbuja } from "@/lib/burbuja";
import { useDriver } from "@/lib/driver";
import { DOCUMENTO, ESTADO, TIPO, VEHICULO, pesos } from "@/lib/format";
import { rpc, soporteWhatsapp, supabase } from "@/lib/supabase";
import type { Registered, TripDetail } from "@/lib/types";

export default function Inicio() {
  const { status, refresh, session, locationDenied } = useDriver();

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  if (!status) return <Loading />;
  if (!status.registered) return <Registrarme userId={session!.user.id} onDone={refresh} />;
  return <Panel s={status} locationDenied={locationDenied} />;
}

function Registrarme({ userId, onDone }: { userId: string; onDone: () => Promise<void> }) {
  return (
    <Screen>
      <Card>
        <H2>Maneja con Dlux</H2>
        <Muted>Con una sola cuenta repartes comida, compras del súper y paquetes, y haces viajes de Dlux Go. Lo que puedes hacer depende de tu vehículo.</Muted>
        <T bold>Vas a necesitar:</T>
        <Muted>• Licencia de manejo e identificación (INE){"\n"}• Tu vehículo con placas, tarjeta de circulación y seguro{"\n"}• RFC y CURP (Dlux retiene los impuestos de plataformas por ley){"\n"}• Membresía de conductor al día</Muted>
        <Button
          title="Quiero ser conductor"
          icon="car-sport"
          onPress={async () => {
            const { error } = await supabase().from("drivers").insert({ user_id: userId });
            if (error && !/duplicate/i.test(error.message)) throw new Error(error.message);
            await onDone();
          }}
        />
      </Card>
    </Screen>
  );
}

function Panel({ s, locationDenied }: { s: Registered; locationDenied: boolean }) {
  const router = useRouter();
  const { goOnline, goOffline, refresh, background } = useDriver();
  // el permiso de la burbuja se da en Ajustes: se vuelve a revisar al regresar a esta pantalla
  const [burbujaOk, setBurbujaOk] = useState(permisoBurbuja);
  useFocusEffect(useCallback(() => setBurbujaOk(permisoBurbuja()), []));
  const [cambiando, setCambiando] = useState(false);
  const [error, setError] = useState("");
  const interno = s.internal_brands.length > 0;

  const pendientes: { icon: "document-text" | "car" | "card" | "receipt" | "time" | "close-circle"; titulo: string; sub?: string; ir?: () => void; bloquea: boolean }[] = [];
  if (s.status === "suspended") pendientes.push({ icon: "close-circle", titulo: "Tu cuenta está suspendida", sub: "Escríbele a Dlux para saber por qué", bloquea: true });
  if (s.missing_docs.length)
    pendientes.push({ icon: "document-text", titulo: "Sube tus documentos", sub: s.missing_docs.map((k) => DOCUMENTO[k] ?? k).join(", "), ir: () => router.push("/documentos"), bloquea: true });
  if (s.rejected_docs.length)
    pendientes.push({ icon: "document-text", titulo: "Dlux rechazó un documento", sub: `Vuelve a subir: ${s.rejected_docs.map((k) => DOCUMENTO[k] ?? k).join(", ")}`, ir: () => router.push("/documentos"), bloquea: true });
  if (!s.vehicle?.usable)
    pendientes.push({
      icon: "car",
      titulo: s.vehicle ? "Tu vehículo todavía no está aprobado" : "Registra tu vehículo",
      sub: s.vehicle ? "Dlux lo está revisando" : "Con él se decide qué servicios puedes hacer",
      ir: () => router.push("/vehiculos"),
      bloquea: true,
    });
  if (!s.tax_ok) pendientes.push({ icon: "receipt", titulo: "Completa tus datos fiscales", sub: "RFC y CURP para tus retenciones", ir: () => router.push("/fiscal"), bloquea: false });
  if (!s.subscription_ok && !interno)
    pendientes.push({ icon: "card", titulo: "Paga tu membresía", sub: "Sin membresía al día no te llegan viajes", ir: () => router.push("/membresia"), bloquea: true });
  if (s.status === "pending" && !s.missing_docs.length) pendientes.push({ icon: "time", titulo: "Dlux está revisando tu cuenta", sub: "Te avisamos en cuanto quedes aprobado", bloquea: true });

  const cambiar = async (on: boolean) => {
    setError("");
    setCambiando(true);
    try {
      await (on ? goOnline() : goOffline());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCambiando(false);
    }
  };

  return (
    <Screen>
      <Card style={{ backgroundColor: s.online ? C.navy : C.surface, borderColor: s.online ? C.navy : C.border }}>
        <Row style={{ justifyContent: "space-between" }}>
          <View style={{ flex: 1 }}>
            <T bold style={{ fontSize: 20, color: s.online ? "#fff" : C.text }}>{s.online ? "Estás conectado" : "Estás desconectado"}</T>
            <Muted style={{ color: s.online ? C.gray : C.muted }}>
              {s.online
                ? background === "ok"
                  ? "Te avisamos cuando llegue un viaje, aunque uses otra app o apagues la pantalla."
                  : "Te avisamos con vibración cuando llegue un viaje. Deja la app abierta."
                : "Conéctate para empezar a recibir viajes."}
            </Muted>
          </View>
          <Switch
            value={s.online}
            disabled={cambiando}
            onValueChange={cambiar}
            trackColor={{ true: C.yellow, false: C.gray }}
            thumbColor={s.online ? C.navy : "#fff"}
          />
        </Row>
        {error ? <Notice tone="danger" icon="alert-circle">{error}</Notice> : null}
        {s.online && s.vehicle && (
          <Muted style={{ color: C.gray }}>
            Trabajas con: {VEHICULO[s.vehicle.kind] ?? s.vehicle.kind} {s.vehicle.plate ?? ""}
            {interno ? ` · Repartidor de ${s.internal_brands.join(", ")}` : ""}
          </Muted>
        )}
      </Card>

      {locationDenied && <Notice tone="danger" icon="location">Activa el permiso de ubicación para Dlux Driver: sin él no te llegan viajes.</Notice>}
      {background === "sin-permiso" && (
        <Item
          icon="location"
          title="Permite la ubicación «todo el tiempo»"
          subtitle="Así te llegan viajes con la pantalla apagada o usando otra app"
          onPress={() => Linking.openSettings()}
        />
      )}
      {s.online && burbujaDisponible && !burbujaOk && (
        <Item
          icon="ellipse"
          title="Activa la burbuja de Dlux"
          subtitle="Te avisa de los viajes encima de otras apps (Waze, Maps…)"
          onPress={abrirPermisoBurbuja}
        />
      )}

      {s.active_trips.length > 0 && (
        <View style={{ gap: 8 }}>
          <H2>Tus viajes en curso</H2>
          {s.active_trips.map((id) => (
            <ViajeActivo key={id} id={id} />
          ))}
        </View>
      )}

      {pendientes.length > 0 && (
        <View style={{ gap: 8 }}>
          <H2>Para recibir viajes</H2>
          {pendientes.map((p) => (
            <Item key={p.titulo} icon={p.icon} title={p.titulo} subtitle={p.sub} onPress={p.ir} right={p.bloquea ? undefined : <Badge>opcional</Badge>} />
          ))}
        </View>
      )}

      {s.status === "approved" && (s.online || s.destination) && (
        <Item
          icon={s.destination ? "home" : "navigate"}
          title={s.destination ? "Vas rumbo a tu destino" : "Voy a mi destino"}
          subtitle={s.destination ? "Solo te llegan viajes que te acercan · cambiar o quitar" : `Solo viajes que te acerquen a casa · ${s.destination_uses_left} ${s.destination_uses_left === 1 ? "uso" : "usos"} hoy`}
          onPress={() => router.push("/destino")}
          right={s.destination ? <Badge tone="navy">activo</Badge> : undefined}
        />
      )}

      <Card>
        <Row style={{ justifyContent: "space-between" }}>
          <View>
            <Muted>Hoy</Muted>
            <Money>{pesos(s.today.earned)}</Money>
            <Muted>{s.today.trips} {s.today.trips === 1 ? "viaje" : "viajes"}</Muted>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Muted>Tu saldo con Dlux</Muted>
            <T bold style={{ fontSize: 18, color: Number(s.balance) < 0 ? C.danger : C.ok }}>{pesos(s.balance)}</T>
            <Muted>{Number(s.balance) < 0 ? "se descuenta de tu próximo pago" : "por transferirte"}</Muted>
          </View>
        </Row>
      </Card>

      {s.invites.map((inv) => (
        <Card key={inv.id}>
          <T bold>{inv.brand} te invita a ser su repartidor</T>
          <Muted>{inv.branch ? `Sucursal ${inv.branch}. ` : ""}Te asignan sus envíos directo, sin membresía de Dlux.</Muted>
          <Row>
            <View style={{ flex: 1 }}>
              <Button small title="Aceptar" variant="ok" onPress={async () => { await rpc("respond_internal_invite", { p_invite: inv.id, p_accept: true }); await refresh(); }} />
            </View>
            <View style={{ flex: 1 }}>
              <Button small title="No, gracias" variant="outline" onPress={async () => { await rpc("respond_internal_invite", { p_invite: inv.id, p_accept: false }); await refresh(); }} />
            </View>
          </Row>
        </Card>
      ))}

      {soporteWhatsapp ? (
        <Button variant="outline" small icon="help-circle" title="Ayuda de Dlux" onPress={() => Linking.openURL(`https://wa.me/52${soporteWhatsapp}`)} />
      ) : null}
    </Screen>
  );
}

function ViajeActivo({ id }: { id: string }) {
  const router = useRouter();
  const [t, setT] = useState<TripDetail | null>(null);
  useEffect(() => {
    rpc<TripDetail>("trip_for_driver", { p_trip: id }).then(setT).catch(() => {});
  }, [id]);
  const destino = t?.stops[t.stops.length - 1];
  return (
    <Item
      icon={t?.kind === "ride" ? "person" : t?.kind === "parcel" ? "cube" : "bag-handle"}
      title={t ? `${TIPO[t.kind] ?? t.kind} · ${ESTADO[t.status]}` : "Cargando…"}
      subtitle={t ? (t.order ? `${t.order.brand} → ${destino?.address ?? ""}` : destino?.address) : undefined}
      onPress={() => router.push({ pathname: "/viaje/[id]", params: { id } })}
    />
  );
}
