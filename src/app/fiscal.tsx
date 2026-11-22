import { useEffect, useState } from "react";

import { Button, Card, Field, Loading, Muted, Notice, Screen } from "@/components/ui";
import { useDriver } from "@/lib/driver";
import { supabase } from "@/lib/supabase";

/** RFC, CURP y demás: Dlux retiene ISR e IVA de plataformas y te da tu constancia de retenciones. */
export default function Fiscal() {
  const { session, refresh } = useDriver();
  const uid = session!.user.id;
  const [listo, setListo] = useState(false);
  const [validado, setValidado] = useState(false);
  const [rfc, setRfc] = useState("");
  const [curp, setCurp] = useState("");
  const [nombre, setNombre] = useState("");
  const [cp, setCp] = useState("");
  const [nss, setNss] = useState("");
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    void supabase()
      .from("tax_profiles")
      .select("*")
      .eq("owner_kind", "driver")
      .eq("owner_id", uid)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setRfc(data.rfc ?? "");
          setCurp(data.curp ?? "");
          setNombre(data.legal_name ?? "");
          setCp(data.zip_code ?? "");
          setNss(data.nss ?? "");
          setValidado(!!data.rfc_validated);
        }
        setListo(true);
      });
  }, [uid]);

  if (!listo) return <Loading />;
  return (
    <Screen>
      <Notice tone="navy" icon="information-circle">
        Por ley, Dlux te retiene ISR e IVA de lo que ganas en la plataforma y cada mes te da tu constancia de retenciones. Si no das tu RFC, la retención es mayor.
      </Notice>
      {validado && <Notice tone="ok" icon="checkmark-circle">Dlux ya validó tu RFC. Para cambiarlo escríbele a Dlux.</Notice>}
      <Card>
        <Field label="RFC" value={rfc} onChangeText={(x) => setRfc(x.toUpperCase().trim())} autoCapitalize="characters" maxLength={13} editable={!validado} />
        <Field label="CURP" value={curp} onChangeText={(x) => setCurp(x.toUpperCase().trim())} autoCapitalize="characters" maxLength={18} />
        <Field label="Nombre como aparece en tu constancia del SAT" value={nombre} onChangeText={setNombre} />
        <Field label="Código postal fiscal" value={cp} onChangeText={setCp} keyboardType="number-pad" maxLength={5} />
        <Field label="Número de seguridad social (opcional)" value={nss} onChangeText={setNss} keyboardType="number-pad" maxLength={11} />
        <Muted>Régimen: Plataformas tecnológicas (625).</Muted>
        {guardado && <Notice tone="ok">Guardado.</Notice>}
        <Button
          title="Guardar"
          disabled={rfc.length < 12 || curp.length !== 18}
          onPress={async () => {
            setGuardado(false);
            const fila = {
              owner_kind: "driver",
              owner_id: uid,
              rfc: rfc || null,
              curp: curp || null,
              legal_name: nombre.trim() || null,
              zip_code: cp || null,
              nss: nss || null,
              tax_regime: "625",
              updated_at: new Date().toISOString(),
            };
            const { error } = await supabase().from("tax_profiles").upsert(fila);
            if (error) throw new Error(error.message);
            setGuardado(true);
            await refresh();
          }}
        />
      </Card>
    </Screen>
  );
}
