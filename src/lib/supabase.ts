import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigured = Boolean(url && key);
/** WhatsApp de soporte de Dlux (10 dígitos), para "Escríbele a Dlux". */
export const soporteWhatsapp = process.env.EXPO_PUBLIC_SOPORTE_WHATSAPP ?? "";

const client = createClient(url || "https://sin-configurar.supabase.co", key || "sin-configurar", {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

// Renueva la sesión solo con la app abierta
AppState.addEventListener("change", (state) => {
  if (state === "active") client.auth.startAutoRefresh();
  else client.auth.stopAutoRefresh();
});

export const supabase = () => client;

/**
 * Sube una foto al bucket privado `documentos`, en la carpeta del usuario (<id>/<carpeta>/...), y devuelve la ruta.
 * Dlux la revisa desde su panel; nadie más la puede ver.
 */
export async function uploadPrivate(userId: string, folder: string, uri: string, mimeType = "image/jpeg") {
  const body = await (await fetch(uri)).arrayBuffer();
  const extension = mimeType.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
  const path = `${userId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const { error } = await client.storage.from("documentos").upload(path, body, { contentType: mimeType });
  if (error) throw new Error(dbError(error) || "No se pudo subir la foto");
  return path;
}

/** Mensaje de un error de Supabase para el conductor: los que lanza el SQL ya vienen en español. */
export function dbError(error: { message: string; code?: string } | null | undefined) {
  if (!error) return "";
  if (/row-level security|permission denied/i.test(error.message)) return "No tienes permiso para hacer esto.";
  if (/fetch|network/i.test(error.message)) return "No se pudo conectar con el servidor. Revisa tu conexión.";
  return error.message;
}

/** Llama una función de la base y lanza el error ya en español. */
export async function rpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(dbError(error));
  return data as T;
}

export function authErrorMessage(error: { code?: string; message: string }): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Correo o contraseña incorrectos.";
    case "user_already_exists":
    case "email_exists":
      return "Ya existe una cuenta con ese correo.";
    case "weak_password":
      return "La contraseña es muy débil. Usa al menos 8 caracteres.";
    case "email_not_confirmed":
      return "Confirma tu correo con el enlace que te enviamos antes de entrar.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Demasiados intentos. Espera un momento y vuelve a probar.";
    case "email_address_invalid":
      return "Ese correo no parece válido.";
    default:
      if (/fetch|network/i.test(error.message)) return "No se pudo conectar con el servidor. Revisa tu conexión.";
      return `Algo salió mal: ${error.message}`;
  }
}
