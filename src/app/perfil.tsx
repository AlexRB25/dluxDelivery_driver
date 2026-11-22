import { useEffect, useState } from "react";

import { Button, Card, Field, Loading, Notice, Screen } from "@/components/ui";
import { useDriver } from "@/lib/driver";
import { supabase } from "@/lib/supabase";

export default function Perfil() {
  const { session } = useDriver();
  const uid = session!.user.id;
  const [listo, setListo] = useState(false);
  const [nombre, setNombre] = useState("");
  const [tel, setTel] = useState("");
  const [ok, setOk] = useState(false);

  useEffect(() => {
    void supabase()
      .from("profiles")
      .select("full_name, phone")
      .eq("id", uid)
      .maybeSingle()
      .then(({ data }) => {
        setNombre(data?.full_name ?? "");
        setTel(data?.phone ?? "");
        setListo(true);
      });
  }, [uid]);

  if (!listo) return <Loading />;
  return (
    <Screen>
      <Card>
        <Field label="Nombre completo" value={nombre} onChangeText={setNombre} />
        <Field label="Celular" value={tel} onChangeText={setTel} keyboardType="phone-pad" hint="Lo ve el cliente mientras llevas su viaje" />
        {ok && <Notice tone="ok">Guardado.</Notice>}
        <Button
          title="Guardar"
          disabled={nombre.trim().length < 3 || tel.replace(/\D/g, "").length !== 10}
          onPress={async () => {
            setOk(false);
            const { error } = await supabase().from("profiles").update({ full_name: nombre.trim(), phone: tel.replace(/\D/g, "") }).eq("id", uid);
            if (error) throw new Error(error.message);
            setOk(true);
          }}
        />
      </Card>
    </Screen>
  );
}
