import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useState } from "react";

import { Mapa, type PuntoMapa } from "@/components/Mapa";
import { Button, Card, Field, H2, Loading, Muted, Notice, Screen } from "@/components/ui";
import { useDriver } from "@/lib/driver";
import { rpc } from "@/lib/supabase";

/**
 * "Voy a mi destino": al terminar el día, solo le llegan viajes que lo acercan a su casa (o a donde vaya).
 * Se puede usar pocas veces al día (destination_uses_per_day en la configuración de Dlux).
 */
export default function Destino() {
  const router = useRouter();
  const { status, position, refresh } = useDriver();
  const [punto, setPunto] = useState<{ lat: number; lng: number } | null>(null);
  const [buscar, setBuscar] = useState("");
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);

  if (!status?.registered) return <Loading />;
  const actual = status.destination_point;
  const quedan = status.destination_uses_left;

  const buscarDireccion = async () => {
    setError("");
    try {
      const r = await Location.geocodeAsync(buscar);
      if (!r.length) throw new Error("No encontramos esa dirección. Prueba con calle, número y colonia, o toca el mapa.");
      setPunto({ lat: r[0].latitude, lng: r[0].longitude });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const hacer = (fn: () => Promise<unknown>) => async () => {
    setError("");
    setOcupado(true);
    try {
      await fn();
      await refresh();
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  };

  const puntos: PuntoMapa[] = [];
  if (punto) puntos.push({ ...punto, tipo: "destino", titulo: "Tu destino" });
  else if (actual) puntos.push({ ...actual, tipo: "destino", titulo: "Tu destino actual" });

  return (
    <Screen>
      {actual ? (
        <Notice tone="navy" icon="home">Vas rumbo a tu destino: solo te llegan viajes que te acercan a él.</Notice>
      ) : (
        <Muted>Elige a dónde vas y solo te llegarán viajes que te acerquen. Útil para regresar a casa al terminar el día.</Muted>
      )}

      <Card>
        <H2>¿A dónde vas?</H2>
        <Field label="Dirección" value={buscar} onChangeText={setBuscar} placeholder="Calle, número, colonia" onSubmitEditing={buscarDireccion} returnKeyType="search" />
        <Button small variant="outline" icon="search" title="Buscar" disabled={buscar.trim().length < 4} onPress={buscarDireccion} />
        <Muted>…o toca el mapa en el punto exacto.</Muted>
      </Card>

      <Mapa style={{ height: 300 }} puntos={puntos} yo={position} alTocar={setPunto} />

      {error ? <Notice tone="danger" icon="alert-circle">{error}</Notice> : null}

      <Button
        big
        variant="yellow"
        icon="navigate"
        title={actual ? "Cambiar a este destino" : "Ir a este destino"}
        disabled={!punto || quedan <= 0 || ocupado}
        onPress={hacer(() => rpc("set_destination", { p_lat: punto!.lat, p_lng: punto!.lng }))}
      />
      <Muted>{quedan > 0 ? `Te ${quedan === 1 ? "queda 1 uso" : `quedan ${quedan} usos`} hoy.` : "Ya usaste tus destinos de hoy."}</Muted>
      {actual && <Button variant="outline" icon="close-circle" title="Quitar destino" disabled={ocupado} onPress={hacer(() => rpc("clear_destination"))} />}
    </Screen>
  );
}
