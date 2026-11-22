import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";

import { Badge, Button, Card, Loading, Muted, Notice, Row, Screen, T } from "@/components/ui";
import { useDriver } from "@/lib/driver";
import { DOCUMENTO, fecha } from "@/lib/format";
import { supabase, uploadPrivate } from "@/lib/supabase";

type Doc = { id: string; kind: string; status: "pending" | "approved" | "rejected"; created_at: string };

const KINDS = ["license", "id", "proof_address", "background_check"];

/** Fotos de licencia, INE y demás. Quedan privadas: solo Dlux las ve para aprobarte. */
export default function Documentos() {
  const { session, refresh } = useDriver();
  const [docs, setDocs] = useState<Doc[] | null>(null);

  const leer = useCallback(async () => {
    const { data } = await supabase().from("driver_documents").select("id, kind, status, created_at").order("created_at", { ascending: false });
    return (data ?? []) as Doc[];
  }, []);
  const cargar = async () => setDocs(await leer());
  useEffect(() => {
    leer().then(setDocs);
  }, [leer]);

  const subir = (kind: string) => async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    const r = perm.granted
      ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ["images"] });
    if (r.canceled) return;
    const a = r.assets[0];
    const uid = session!.user.id;
    const path = await uploadPrivate(uid, "documentos", a.uri, a.mimeType ?? "image/jpeg");
    const { error } = await supabase().from("driver_documents").insert({ driver_id: uid, kind, url: path });
    if (error) throw new Error(error.message);
    await cargar();
    await refresh();
  };

  if (!docs) return <Loading />;
  return (
    <Screen>
      <Notice tone="navy" icon="lock-closed">Tus documentos son privados: solo Dlux los ve para aprobar tu cuenta.</Notice>
      {KINDS.map((kind) => {
        const ultimo = docs.find((d) => d.kind === kind);
        const requerido = kind === "license" || kind === "id";
        return (
          <Card key={kind}>
            <Row style={{ justifyContent: "space-between" }}>
              <View style={{ flex: 1 }}>
                <T bold>{DOCUMENTO[kind]}</T>
                <Muted>{requerido ? "Obligatorio" : "Si Dlux te lo pide"}{ultimo ? ` · subido el ${fecha(ultimo.created_at)}` : ""}</Muted>
              </View>
              {ultimo ? (
                <Badge tone={ultimo.status === "approved" ? "ok" : ultimo.status === "rejected" ? "danger" : "warn"}>
                  {ultimo.status === "approved" ? "Aprobado" : ultimo.status === "rejected" ? "Rechazado" : "En revisión"}
                </Badge>
              ) : (
                <Badge tone={requerido ? "danger" : "muted"}>Falta</Badge>
              )}
            </Row>
            {ultimo?.status !== "approved" && (
              <Button small variant={ultimo ? "outline" : "primary"} icon="camera" title={ultimo ? "Subir otra vez" : "Tomar foto"} onPress={subir(kind)} />
            )}
          </Card>
        );
      })}
    </Screen>
  );
}
