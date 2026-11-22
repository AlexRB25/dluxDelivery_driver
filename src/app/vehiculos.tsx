import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Badge, Button, C, Card, Field, H2, Loading, Muted, Notice, Row, Screen, T } from "@/components/ui";
import { useDriver } from "@/lib/driver";
import { VEHICULO } from "@/lib/format";
import { supabase, uploadPrivate } from "@/lib/supabase";

type Vehiculo = {
  id: string; owner_id: string; kind: string; make: string | null; model: string | null; year: number | null;
  plate: string | null; color: string | null; status: "pending" | "approved" | "suspended";
  vehicle_documents: { kind: string; status: string }[];
};
type Servicio = { name: string; category: string; vehicle_kinds: string[] };

const DOCS_VEHICULO: [string, string][] = [
  ["registration", "Tarjeta de circulación"],
  ["insurance", "Póliza de seguro"],
  ["photo", "Foto del vehículo con placas"],
];

/** Vehículos propios o prestados (ligados por su dueño) y con cuál trabaja hoy. */
export default function Vehiculos() {
  const { session, status, refresh } = useDriver();
  const uid = session!.user.id;
  const actual = status?.registered ? status.vehicle?.id : null;
  const [lista, setLista] = useState<Vehiculo[] | null>(null);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [nuevo, setNuevo] = useState(false);

  const leer = useCallback(async () => {
    const [v, s] = await Promise.all([
      supabase().from("vehicles").select("*, vehicle_documents(kind, status)").order("created_at"),
      supabase().from("service_types").select("name, category, vehicle_kinds").eq("is_active", true).order("sort"),
    ]);
    return { vehiculos: (v.data ?? []) as Vehiculo[], servicios: (s.data ?? []) as Servicio[] };
  }, []);
  const poner = (x: { vehiculos: Vehiculo[]; servicios: Servicio[] }) => {
    setLista(x.vehiculos);
    setServicios(x.servicios);
  };
  const cargar = async () => poner(await leer());
  useEffect(() => {
    leer().then(poner);
  }, [leer]);

  const subirDoc = (vehiculo: string, kind: string) => async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    const r = perm.granted
      ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ["images"] });
    if (r.canceled) return;
    const path = await uploadPrivate(uid, "vehiculos", r.assets[0].uri, r.assets[0].mimeType ?? "image/jpeg");
    const { error } = await supabase().from("vehicle_documents").insert({ vehicle_id: vehiculo, kind, url: path });
    if (error) throw new Error(error.message);
    await cargar();
  };

  if (!lista) return <Loading />;
  return (
    <Screen>
      {lista.length === 0 && !nuevo && <Notice tone="navy" icon="car">Registra el vehículo con el que vas a trabajar. Dlux lo revisa y te avisa.</Notice>}
      {lista.map((v) => {
        const mio = v.owner_id === uid;
        const puede = servicios.filter((s) => s.vehicle_kinds.includes(v.kind)).map((s) => s.name);
        return (
          <Card key={v.id} style={actual === v.id ? { borderColor: C.navy, borderWidth: 2 } : undefined}>
            <Row style={{ justifyContent: "space-between" }}>
              <View style={{ flex: 1 }}>
                <T bold>{VEHICULO[v.kind] ?? v.kind} {[v.make, v.model, v.year].filter(Boolean).join(" ")}</T>
                <Muted>{[v.plate, v.color].filter(Boolean).join(" · ") || "Sin placas"}{mio ? "" : " · prestado por su dueño"}</Muted>
              </View>
              <Badge tone={v.status === "approved" ? "ok" : v.status === "suspended" ? "danger" : "warn"}>
                {v.status === "approved" ? "Aprobado" : v.status === "suspended" ? "Suspendido" : "En revisión"}
              </Badge>
            </Row>
            {puede.length > 0 && <Muted>Puedes hacer: {puede.join(", ")}</Muted>}
            {mio &&
              DOCS_VEHICULO.map(([k, label]) => {
                const d = v.vehicle_documents.find((x) => x.kind === k);
                return (
                  <Row key={k} style={{ justifyContent: "space-between" }}>
                    <Muted style={{ flex: 1 }}>{label}</Muted>
                    {d ? (
                      <Badge tone={d.status === "approved" ? "ok" : d.status === "rejected" ? "danger" : "warn"}>
                        {d.status === "approved" ? "Aprobado" : d.status === "rejected" ? "Rechazado" : "En revisión"}
                      </Badge>
                    ) : null}
                    {(!d || d.status === "rejected") && <Button small variant="outline" icon="camera" title="Subir" onPress={subirDoc(v.id, k)} />}
                  </Row>
                );
              })}
            {actual === v.id ? (
              <Badge tone="navy">Trabajas con este</Badge>
            ) : (
              <Button
                small
                title="Trabajar con este"
                disabled={v.status !== "approved"}
                onPress={async () => {
                  const { error } = await supabase().from("drivers").update({ current_vehicle_id: v.id }).eq("user_id", uid);
                  if (error) throw new Error(error.message);
                  await refresh();
                }}
              />
            )}
          </Card>
        );
      })}
      {nuevo ? (
        <NuevoVehiculo
          onDone={async () => {
            setNuevo(false);
            await cargar();
          }}
        />
      ) : (
        <Button variant="outline" icon="add-circle" title="Agregar vehículo" onPress={() => setNuevo(true)} />
      )}
      <Muted>¿Manejas el carro de alguien más? Su dueño te liga a su vehículo desde su cuenta y aquí te aparece.</Muted>
    </Screen>
  );
}

function NuevoVehiculo({ onDone }: { onDone: () => Promise<void> }) {
  const [kind, setKind] = useState("moto");
  const [plate, setPlate] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [color, setColor] = useState("");
  return (
    <Card>
      <H2>Nuevo vehículo</H2>
      <Row style={{ flexWrap: "wrap" }}>
        {Object.entries(VEHICULO).map(([k, label]) => (
          <Pressable
            key={k}
            onPress={() => setKind(k)}
            style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5, borderColor: C.navy, backgroundColor: kind === k ? C.navy : "transparent" }}
          >
            <Text style={{ color: kind === k ? "#fff" : C.navy, fontWeight: "700" }}>{label}</Text>
          </Pressable>
        ))}
      </Row>
      {kind !== "bike" && <Field label="Placas" value={plate} onChangeText={(x) => setPlate(x.toUpperCase())} autoCapitalize="characters" />}
      <Field label="Marca" value={make} onChangeText={setMake} placeholder="Italika, Nissan…" />
      <Field label="Modelo" value={model} onChangeText={setModel} />
      <Row>
        <View style={{ flex: 1 }}><Field label="Año" value={year} onChangeText={setYear} keyboardType="number-pad" maxLength={4} /></View>
        <View style={{ flex: 1 }}><Field label="Color" value={color} onChangeText={setColor} /></View>
      </Row>
      <Button
        title="Guardar"
        disabled={kind !== "bike" && plate.trim().length < 5}
        onPress={async () => {
          const { error } = await supabase().from("vehicles").insert({
            kind,
            plate: plate.trim() || null,
            make: make.trim() || null,
            model: model.trim() || null,
            year: year ? Number(year) : null,
            color: color.trim() || null,
          });
          if (error) throw new Error(/vehicles_plate_idx|duplicate/.test(error.message) ? "Esas placas ya están registradas" : error.message);
          await onDone();
        }}
      />
    </Card>
  );
}
