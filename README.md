# Dlux Driver

App de conductores de Dlux (Expo SDK 57 + expo-router + Supabase). Una sola app para repartir comida, compras del súper y paquetes, y para los viajes de Dlux Go. Usa el esquema `../admin/supabase/002_plataforma.sql`.

## Correr

```bash
cp .env.example .env    # URL y llave publicable de Supabase de Dlux + EXPO_PUBLIC_API_URL (el panel)
npm install
npx expo start          # Expo Go sirve para lo básico
npm run typecheck && npm run lint
```

**Segundo plano, push y burbuja no funcionan en Expo Go**: se necesita un build propio (`npx expo run:android` o EAS). Para push:

1. `eas init` (pone `extra.eas.projectId` en `app.json`; sin él la app no registra token y solo usa avisos locales).
2. Proyecto de Firebase para FCM: bajar `google-services.json` a la raíz y poner `"googleServicesFile": "./google-services.json"` en `android`; subir la llave de cuenta de servicio de FCM a EAS (`eas credentials`).
3. En Supabase, extensión `pg_net` activa (la usa `send_pushes()` para hablar con Expo).

## Qué hace

- **Entrar / crear cuenta**: la misma cuenta de Dlux Delivery y Dlux Go.
- **Inicio**: conectarse/desconectarse (`go_online` revisa aprobación, membresía y vehículo), lo que falta para trabajar, viajes en curso, ganado hoy, saldo con Dlux e invitaciones de comercios para ser su repartidor.
- **Ofertas**: con la app conectada manda su ubicación cada 5 s (`driver_ping`) y recibe su estado; si trae oferta, vibra y abre la pantalla de oferta con cuenta regresiva (aceptar = `accept_trip`, rechazar = `reject_offer`).
- **Viaje**: ir a recoger → llegué (espera gratis y "no se presentó" con cobro) → recogí/subió → llegué a cada parada → terminar. Pedidos con productos y compra en tienda con foto del ticket (`finish_purchase`), efectivo (`report_cash`: cambio como saldo a favor, faltantes), cambios de destino/parada que pide el pasajero, paradas cobradas por minuto. Navegar con Google Maps o Waze, llamar o WhatsApp.
- **Ganancias**: hoy, 7 y 30 días; retenciones, parte del dueño del vehículo, efectivo cobrado, saldo y movimientos (`driver_earnings`).
- **Cuenta**: datos, documentos (fotos privadas en el bucket `documentos`), vehículos (alta, documentos, con cuál trabaja y qué servicios puede hacer), datos fiscales (RFC/CURP), membresía, burbuja y permisos.
- **Segundo plano**: mientras trabaja, servicio de ubicación de Android (expo-task-manager) que sigue mandando `driver_ping` con la app cerrada y avisa de ofertas.
- **Push**: la base manda avisos por Expo (`push_outbox` → `send_pushes()`): oferta nueva (canal `ofertas`, máxima prioridad), asignación interna, viaje cancelado, cuenta aprobada/suspendida, documento rechazado y membresía pagada. Tocar el aviso abre la pantalla correcta.
- **Burbuja flotante** (Android, módulo nativo `modules/dlux-bubble`): al salir de la app estando conectado aparece la "D" de Dlux; con oferta parpadea y muestra la tarifa; tocarla abre la oferta. Se puede mover y apagar en Cuenta.
- **Mapa** dentro de la app (Leaflet + OpenStreetMap en WebView): en el viaje (paradas que faltan y tu ubicación), en la oferta y para elegir destino.
- **Membresía**: elegir 1, 3, 6 o 12 meses y pagar con tarjeta u OXXO por Stripe Checkout (el panel crea la sesión en `/api/driver/membresia` y el webhook la aplica con `extend_subscription`); también efectivo con Dlux, que el panel registra en Conductores. Historial de pagos.
- **Voy a mi destino**: buscar la dirección o tocar el mapa; solo llegan viajes que lo acercan. Usos por día según la configuración.

El reparto lo hace la base sola cada 10 s (`dispatch_tick` con pg_cron).

## Falta (siguientes fases)

- Aceptar préstamos de vehículos desde la app.
- El panel de Dlux debe mostrar los documentos del bucket privado con enlaces firmados.
- Probar en un teléfono real: servicio de ubicación, burbuja (Kotlin sin compilar todavía) y push con FCM.
- Para publicarla como actualización de la app de AppHive: el paquete de Android de esa ficha, un `versionCode` mayor y su keystore.
