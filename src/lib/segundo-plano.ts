import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { AppState } from "react-native";

import Bubble from "../../modules/dlux-bubble";
import { TIPO, km, pesos } from "./format";
import { rpc, supabase } from "./supabase";
import type { DriverStatus, TripDetail } from "./types";

/**
 * Trabajo con la app en segundo plano o la pantalla apagada (Android con servicio en primer plano, iPhone con
 * ubicación "Siempre"): manda la ubicación al servidor y avisa de las ofertas con la burbuja y una notificación.
 * Con la app abierta no hace nada: ahí manda la ubicación DriverProvider.
 */
export const TAREA_UBICACION = "dlux-ubicacion";

const ULTIMA_OFERTA = "dlux-ultima-oferta";
export const CON_PUSH = "dlux-push-token";

/** Avisa una sola vez de cada oferta (sirve igual para la app abierta y para el segundo plano). */
export async function ofertaNueva(tripId: string): Promise<boolean> {
  const ultima = await AsyncStorage.getItem(ULTIMA_OFERTA).catch(() => null);
  if (ultima === tripId) return false;
  await AsyncStorage.setItem(ULTIMA_OFERTA, tripId).catch(() => {});
  return true;
}

async function avisarOferta(s: Extract<DriverStatus, { registered: true }>) {
  const offer = s.offer;
  if (!offer || !(await ofertaNueva(offer.trip_id))) return;
  let titulo = "Nuevo viaje";
  let detalle = "Toca para verlo";
  try {
    const t = await rpc<TripDetail>("trip_for_driver", { p_trip: offer.trip_id });
    titulo = `Nuevo ${(TIPO[t.kind] ?? "viaje").toLowerCase()} · ${pesos(t.fare)}`;
    detalle = [t.service, km(t.distance_m), t.stops[0]?.address].filter(Boolean).join(" · ");
  } catch {
    // sin detalle: el aviso sale igual
  }
  const url = `dluxdriver://oferta/${offer.trip_id}`;
  Bubble?.alert(titulo, detalle, url, offer.expires_in);
  // si ya hay notificaciones push, el servidor manda el aviso: no duplicarlo
  if (!(await AsyncStorage.getItem(CON_PUSH).catch(() => null))) {
    await Notifications.scheduleNotificationAsync({
      content: { title: titulo, body: detalle, data: { type: "offer", trip_id: offer.trip_id }, sound: "default" },
      trigger: { channelId: "ofertas" },
    }).catch(() => {});
  }
}

if (!TaskManager.isTaskDefined(TAREA_UBICACION)) {
  TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(TAREA_UBICACION, async ({ data, error }) => {
    if (error || AppState.currentState === "active") return;
    const l = data?.locations?.[data.locations.length - 1];
    if (!l) return;
    try {
      // la sesión se renueva aquí si ya venció (con la app cerrada no corre la renovación automática)
      const { data: auth } = await supabase().auth.getSession();
      if (!auth.session) {
        await detenerSegundoPlano();
        return;
      }
      const s = await rpc<DriverStatus>("driver_ping", { p_lat: l.coords.latitude, p_lng: l.coords.longitude });
      if (!s.registered) return;
      if (!s.online && s.active_trips.length === 0) {
        await detenerSegundoPlano();
        Bubble?.hide();
        return;
      }
      await avisarOferta(s);
    } catch {
      // sin internet: se reintenta con la siguiente ubicación
    }
  });
}

export type PermisoSegundoPlano = "ok" | "sin-permiso" | "no-disponible";

/** Arranca el envío de ubicación en segundo plano. Pide "Permitir todo el tiempo" si hace falta. */
export async function iniciarSegundoPlano(): Promise<PermisoSegundoPlano> {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TAREA_UBICACION)) return "ok";
    let perm = await Location.getBackgroundPermissionsAsync();
    if (!perm.granted && perm.canAskAgain) perm = await Location.requestBackgroundPermissionsAsync();
    if (!perm.granted) return "sin-permiso";
    await Location.startLocationUpdatesAsync(TAREA_UBICACION, {
      accuracy: Location.Accuracy.High,
      timeInterval: 5_000,
      distanceInterval: 0,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.AutomotiveNavigation,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "Dlux Driver está conectado",
        notificationBody: "Te avisamos cuando llegue un viaje. Desconéctate desde la app.",
        notificationColor: "#001F3F",
        killServiceOnDestroy: false,
      },
    });
    return "ok";
  } catch {
    // Expo Go o un teléfono sin el servicio: la app funciona solo con la pantalla abierta
    return "no-disponible";
  }
}

export async function detenerSegundoPlano() {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TAREA_UBICACION)) await Location.stopLocationUpdatesAsync(TAREA_UBICACION);
  } catch {
    // ya estaba detenido
  }
}
