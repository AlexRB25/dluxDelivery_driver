import { Linking } from "react-native";

const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
export const pesos = (v: number | string | null | undefined) => mxn.format(Number(v ?? 0));
export const hora = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : "—";
export const fecha = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" }) : "—";
export const km = (m: number | null | undefined) => (m == null ? "" : `${(m / 1000).toFixed(1)} km`);
export const minutos = (s: number | null | undefined) => (s == null ? "" : `${Math.max(1, Math.round(s / 60))} min`);

export const TIPO: Record<string, string> = {
  food: "Comida",
  grocery: "Súper",
  pharmacy: "Farmacia",
  parcel: "Paquete",
  ride: "Viaje",
  business: "Envío de comercio",
};

export const ESTADO: Record<string, string> = {
  scheduled: "Agendado",
  searching: "Buscando conductor",
  assigned: "Asignado",
  arriving: "Vas a recoger",
  in_progress: "En camino",
  completed: "Terminado",
  canceled: "Cancelado",
};

export const VEHICULO: Record<string, string> = { bike: "Bici", moto: "Moto", car: "Carro", van: "Camioneta", truck: "Camión" };

export const DOCUMENTO: Record<string, string> = {
  license: "Licencia de manejo",
  id: "Identificación (INE)",
  proof_address: "Comprobante de domicilio",
  background_check: "Carta de no antecedentes",
  other: "Otro",
};

export const MOVIMIENTO: Record<string, string> = {
  fare: "Tarifa",
  tip: "Propina",
  no_show_fee: "Pasajero no se presentó",
  wait_compensation: "Compensación por espera",
  wait_penalty: "Penalización por espera",
  owner_share: "Parte del dueño del vehículo",
  isr_withholding: "Retención de ISR",
  iva_withholding: "Retención de IVA",
  cash_collected: "Efectivo que cobraste",
  cash_paid_to_store: "Efectivo que pagaste al comercio",
  payout: "Pago a tu cuenta",
  adjustment: "Ajuste de Dlux",
  subscription: "Membresía",
};

/** Abre la navegación a un punto (Google Maps o Waze). */
export function navegar(lat: number, lng: number, app: "maps" | "waze" = "maps") {
  const url =
    app === "waze"
      ? `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
      : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  return Linking.openURL(url);
}

export const llamar = (tel: string) => Linking.openURL(`tel:${tel.replace(/\D/g, "")}`);
export const whatsapp = (tel: string, texto = "") =>
  Linking.openURL(`https://wa.me/52${tel.replace(/\D/g, "").slice(-10)}?text=${encodeURIComponent(texto)}`);
