# Dlux Driver

App de conductores de Dlux (Expo SDK 57 + expo-router + Supabase). Una sola app para repartir comida, compras del súper y paquetes, y para los viajes de Dlux Go. Usa el esquema `../admin/supabase/002_plataforma.sql`.

## Correr

```bash
cp .env.example .env    # URL y llave publicable de Supabase de Dlux
npm install
npx expo start          # abrir con Expo Go en el celular
npm run typecheck && npm run lint
```

## Qué hace

- **Entrar / crear cuenta**: la misma cuenta de Dlux Delivery y Dlux Go.
- **Inicio**: conectarse/desconectarse (`go_online` revisa aprobación, membresía y vehículo), lo que falta para trabajar, viajes en curso, ganado hoy, saldo con Dlux e invitaciones de comercios para ser su repartidor.
- **Ofertas**: con la app conectada manda su ubicación cada 5 s (`driver_ping`) y recibe su estado; si trae oferta, vibra y abre la pantalla de oferta con cuenta regresiva (aceptar = `accept_trip`, rechazar = `reject_offer`).
- **Viaje**: ir a recoger → llegué (espera gratis y "no se presentó" con cobro) → recogí/subió → llegué a cada parada → terminar. Pedidos con productos y compra en tienda con foto del ticket (`finish_purchase`), efectivo (`report_cash`: cambio como saldo a favor, faltantes), cambios de destino/parada que pide el pasajero, paradas cobradas por minuto. Navegar con Google Maps o Waze, llamar o WhatsApp.
- **Ganancias**: hoy, 7 y 30 días; retenciones, parte del dueño del vehículo, efectivo cobrado, saldo y movimientos (`driver_earnings`).
- **Cuenta**: datos, documentos (fotos privadas en el bucket `documentos`), vehículos (alta, documentos, con cuál trabaja y qué servicios puede hacer), datos fiscales (RFC/CURP) y membresía.

El reparto lo hace la base sola cada 10 s (`dispatch_tick` con pg_cron).

## Falta (siguientes fases)

- **Segundo plano**: hoy la app debe estar abierta y con la pantalla encendida (se mantiene encendida sola mientras estás conectado). Falta ubicación en segundo plano (expo-task-manager), notificaciones push de ofertas y la burbuja flotante de Android (requiere build nativo).
- Mapa dentro de la app (hoy se navega con Maps/Waze).
- Pago de la membresía dentro de la app (hoy por WhatsApp con Dlux).
- "Voy a mi destino" y aceptar préstamos de vehículos desde la app.
- El panel de Dlux debe mostrar los documentos del bucket privado con enlaces firmados.
