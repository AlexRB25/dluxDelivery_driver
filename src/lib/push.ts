import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { CON_PUSH } from "./segundo-plano";
import { rpc } from "./supabase";

// Con la app abierta también se muestran (la oferta además abre su pantalla sola)
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

/** Canales de Android: las ofertas suenan y vibran fuerte; los avisos, normal. */
export async function prepararCanales() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("ofertas", {
    name: "Ofertas de viaje",
    description: "Viajes y envíos que te llegan para aceptar",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 600, 300, 600, 300, 600],
    sound: "default",
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
  await Notifications.setNotificationChannelAsync("avisos", {
    name: "Avisos de Dlux",
    description: "Cancelaciones, documentos, membresía",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
  });
}

/** Pide permiso de notificaciones. Devuelve si quedó concedido. */
export async function pedirPermisoNotificaciones(): Promise<boolean> {
  await prepararCanales();
  let perm = await Notifications.getPermissionsAsync();
  if (!perm.granted && perm.canAskAgain) perm = await Notifications.requestPermissionsAsync();
  return perm.granted;
}

/**
 * Registra este teléfono para recibir push de Dlux (ofertas aunque la app esté cerrada).
 * Necesita el projectId de EAS (eas init) y, en Android, las credenciales de FCM en EAS. Sin eso
 * devuelve null y la app sigue avisando con notificaciones locales mientras está conectada.
 */
export async function registrarPush(): Promise<string | null> {
  try {
    if (!Device.isDevice || !(await pedirPermisoNotificaciones())) return null;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return null;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await rpc("register_push_token", { p_token: token, p_app: "driver", p_platform: Platform.OS });
    await AsyncStorage.setItem(CON_PUSH, token);
    return token;
  } catch {
    return null;
  }
}

/** Al cerrar sesión: que a este teléfono ya no le lleguen avisos de esa cuenta. */
export async function olvidarPush() {
  const token = await AsyncStorage.getItem(CON_PUSH).catch(() => null);
  if (!token) return;
  await rpc("unregister_push_token", { p_token: token }).catch(() => {});
  await AsyncStorage.removeItem(CON_PUSH).catch(() => {});
}

/** A qué pantalla lleva cada aviso al tocarlo (los datos los manda el servidor: queue_push en el SQL). */
export function rutaDeAviso(data: Record<string, unknown> | undefined): string | null {
  const id = typeof data?.trip_id === "string" ? data.trip_id : null;
  switch (data?.type) {
    case "offer":
      return id ? `/oferta/${id}` : null;
    case "trip":
      return id ? `/viaje/${id}` : null;
    case "docs":
      return "/documentos";
    case "membership":
      return "/membresia";
    case "home":
      return "/inicio";
    default:
      return null;
  }
}
