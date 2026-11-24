import type { Session } from "@supabase/supabase-js";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { usePathname, useRouter, type Href } from "expo-router";
import { createContext, use, useCallback, useEffect, useRef, useState, type PropsWithChildren } from "react";
import { AppState, Vibration } from "react-native";

import { burbujaAlSalir, quitarBurbuja } from "./burbuja";
import { prepararCanales, registrarPush, rutaDeAviso } from "./push";
import { detenerSegundoPlano, iniciarSegundoPlano, ofertaNueva, type PermisoSegundoPlano } from "./segundo-plano";
import { rpc, supabase } from "./supabase";
import type { DriverStatus } from "./types";

type Punto = { lat: number; lng: number };

type DriverState = {
  session: Session | null;
  loading: boolean;
  status: DriverStatus | null;
  /** Última ubicación conocida del teléfono. */
  position: Punto | null;
  locationDenied: boolean;
  /** Cómo quedó el envío de ubicación con la app cerrada (null = no está trabajando). */
  background: PermisoSegundoPlano | null;
  refresh: () => Promise<void>;
  goOnline: () => Promise<void>;
  goOffline: () => Promise<void>;
};

const Ctx = createContext<DriverState | null>(null);

export function useDriver(): DriverState {
  const value = use(Ctx);
  if (!value) throw new Error("useDriver debe usarse dentro de <DriverProvider>");
  return value;
}

const PING_MS = 5_000;       // conectado o con viaje: ubicación + estado
const IDLE_MS = 30_000;      // desconectado: solo revisar si ya lo aprobaron, invitaciones, etc.

async function pedirUbicacion(): Promise<Punto | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return null;
  const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { lat: p.coords.latitude, lng: p.coords.longitude };
}

export function DriverProvider({ children }: PropsWithChildren) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<DriverStatus | null>(null);
  const [position, setPosition] = useState<Punto | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [background, setBackground] = useState<PermisoSegundoPlano | null>(null);
  const pos = useRef<Punto | null>(null);
  const lastOffer = useRef<string | null>(null);
  const ruta = useRef(pathname);
  useEffect(() => {
    ruta.current = pathname;
  }, [pathname]);

  const aplicar = useCallback(
    (s: DriverStatus) => {
      setStatus(s);
      // oferta nueva: vibrar y abrirla encima de todo (si no la abrió ya la burbuja o la notificación)
      const offer = s.registered ? s.offer : null;
      if (offer && offer.trip_id !== lastOffer.current) {
        lastOffer.current = offer.trip_id;
        void ofertaNueva(offer.trip_id);
        if (ruta.current !== `/oferta/${offer.trip_id}`) {
          Vibration.vibrate([0, 600, 300, 600, 300, 600]);
          router.push({ pathname: "/oferta/[id]", params: { id: offer.trip_id } });
        }
      }
      if (!offer) lastOffer.current = null;
    },
    [router],
  );

  const refresh = useCallback(async () => {
    if (!session) return;
    try {
      const p = pos.current;
      aplicar(await rpc<DriverStatus>(p ? "driver_ping" : "driver_status", p ? { p_lat: p.lat, p_lng: p.lng } : undefined));
    } catch {
      // sin conexión: se reintenta en el siguiente ciclo
    }
  }, [session, aplicar]);

  // sesión
  useEffect(() => {
    const { data } = supabase().auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) setStatus(null);
      setTimeout(() => setLoading(false), 0);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) void refresh();
  }, [session, refresh]);

  // notificaciones: canales, token push y abrir la pantalla del aviso al tocarlo
  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return;
    void prepararCanales();
    void registrarPush();
  }, [userId]);

  useEffect(() => {
    const abrir = (r: Notifications.NotificationResponse | null) => {
      const destino = rutaDeAviso(r?.notification.request.content.data);
      if (destino && ruta.current !== destino) router.push(destino as Href);
    };
    // la app se abrió tocando un aviso
    void Notifications.getLastNotificationResponseAsync().then((r) => {
      abrir(r);
      if (r) void Notifications.clearLastNotificationResponseAsync();
    });
    const sub = Notifications.addNotificationResponseReceivedListener(abrir);
    return () => sub.remove();
  }, [router]);

  const trabajando = !!status?.registered && (status.online || status.active_trips.length > 0);

  // seguir la ubicación mientras trabaja: en pantalla y también con la app cerrada (servicio en segundo plano)
  useEffect(() => {
    if (!trabajando) {
      void detenerSegundoPlano();
      quitarBurbuja();
      return;
    }
    let sub: Location.LocationSubscription | null = null;
    let vivo = true;
    void (async () => {
      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      setLocationDenied(perm !== "granted");
      if (perm !== "granted" || !vivo) return;
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 4_000, distanceInterval: 15 },
        (p) => {
          pos.current = { lat: p.coords.latitude, lng: p.coords.longitude };
          setPosition(pos.current);
        },
      );
      const bg = await iniciarSegundoPlano();
      if (vivo) setBackground(bg);
    })();
    void activateKeepAwakeAsync("dlux-trabajando");
    return () => {
      vivo = false;
      sub?.remove();
      setBackground(null);
      deactivateKeepAwake("dlux-trabajando");
    };
  }, [trabajando]);

  // ciclo de estado: rápido trabajando, lento sin trabajar. En segundo plano lo hace la tarea de ubicación.
  // Al salir de la app aparece la burbuja; al volver se quita.
  useEffect(() => {
    if (!session) return;
    const t = setInterval(() => {
      if (AppState.currentState === "active") void refresh();
    }, trabajando ? PING_MS : IDLE_MS);
    const s = AppState.addEventListener("change", (st) => {
      if (st === "active") {
        quitarBurbuja();
        void refresh();
      } else if (st === "background") {
        void burbujaAlSalir(trabajando);
      }
    });
    return () => {
      clearInterval(t);
      s.remove();
    };
  }, [session, trabajando, refresh]);

  const goOnline = useCallback(async () => {
    const p = await pedirUbicacion();
    if (!p) {
      setLocationDenied(true);
      throw new Error("Activa el permiso de ubicación para recibir viajes");
    }
    pos.current = p;
    setPosition(p);
    aplicar(await rpc<DriverStatus>("go_online", { p_lat: p.lat, p_lng: p.lng }));
  }, [aplicar]);

  const goOffline = useCallback(async () => {
    aplicar(await rpc<DriverStatus>("go_offline"));
  }, [aplicar]);

  return (
    <Ctx value={{ session, loading, status, position, locationDenied, background, refresh, goOnline, goOffline }}>{children}</Ctx>
  );
}
