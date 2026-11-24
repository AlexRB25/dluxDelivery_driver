import AsyncStorage from "@react-native-async-storage/async-storage";

import Bubble from "../../modules/dlux-bubble";

const CLAVE = "dlux-burbuja";

/** La burbuja existe en esta compilación (Android con el módulo nativo). */
export const burbujaDisponible = Bubble != null;

/** ¿El conductor la quiere? (sí por defecto) */
export async function burbujaActivada(): Promise<boolean> {
  const v = await AsyncStorage.getItem(CLAVE).catch(() => null);
  return v !== "0";
}

export async function activarBurbuja(si: boolean) {
  await AsyncStorage.setItem(CLAVE, si ? "1" : "0").catch(() => {});
  if (!si) Bubble?.hide();
}

export function permisoBurbuja(): boolean {
  try {
    return Bubble?.canDraw() ?? false;
  } catch {
    return false;
  }
}

export function abrirPermisoBurbuja() {
  Bubble?.openSettings();
}

/** Mostrar al salir de la app (si está conectado, la quiere y dio permiso); quitar al volver. */
export async function burbujaAlSalir(trabajando: boolean) {
  if (!Bubble || !trabajando || !permisoBurbuja() || !(await burbujaActivada())) return;
  Bubble.show();
}

export function quitarBurbuja() {
  Bubble?.hide();
}
