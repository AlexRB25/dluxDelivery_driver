import { useEffect, useRef, useState } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import { C } from "./ui";

export type PuntoMapa = { lat: number; lng: number; tipo: "recoge" | "entrega" | "parada" | "destino"; titulo?: string };

type Props = {
  puntos: PuntoMapa[];
  /** Dónde va el conductor (punto azul). */
  yo?: { lat: number; lng: number } | null;
  /** Modo elegir: al tocar el mapa devuelve el punto. */
  alTocar?: (p: { lat: number; lng: number }) => void;
  /** Dibujar la línea del recorrido (yo → paradas en orden). */
  ruta?: boolean;
  style?: StyleProp<ViewStyle>;
};

// Leaflet + OpenStreetMap, como el mapa en vivo del panel. Se pinta de nuevo con window.pintar(datos).
const HTML = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>html,body,#m{margin:0;height:100%;background:#DFDFDF}.pin{width:26px;height:26px;border-radius:50%;border:3px solid #fff;
box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;color:#fff;font:700 12px sans-serif}
.yo{width:18px;height:18px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 6px rgba(37,99,235,.25)}</style>
</head><body><div id="m"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>
var map=L.map('m',{zoomControl:false,attributionControl:true}).setView([20.6736,-103.344],13);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
var capa=L.layerGroup().addTo(map),primera=true,elegir=false;
var COLOR={recoge:'#16a34a',entrega:'#dc2626',parada:'#001F3F',destino:'#b45309'};
function pin(p,i){var t=p.tipo==='parada'?String(i):p.tipo==='recoge'?'R':p.tipo==='entrega'?'E':'D';
return L.marker([p.lat,p.lng],{icon:L.divIcon({className:'',html:'<div class="pin" style="background:'+COLOR[p.tipo]+'">'+t+'</div>',iconSize:[26,26],iconAnchor:[13,13]})});}
window.pintar=function(d){capa.clearLayers();elegir=!!d.elegir;var b=[];var linea=[];
if(d.yo){L.marker([d.yo.lat,d.yo.lng],{icon:L.divIcon({className:'',html:'<div class="yo"></div>',iconSize:[18,18],iconAnchor:[9,9]})}).addTo(capa);b.push([d.yo.lat,d.yo.lng]);linea.push([d.yo.lat,d.yo.lng]);}
d.puntos.forEach(function(p,i){var m=pin(p,i);if(p.titulo)m.bindPopup(p.titulo);m.addTo(capa);b.push([p.lat,p.lng]);linea.push([p.lat,p.lng]);});
if(d.ruta&&linea.length>1)L.polyline(linea,{color:'#001F3F',weight:4,opacity:.7,dashArray:'8 6'}).addTo(capa);
if(primera&&b.length){primera=false;if(b.length===1)map.setView(b[0],15);else map.fitBounds(b,{padding:[40,40]});}};
map.on('click',function(e){if(elegir&&window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify({lat:e.latlng.lat,lng:e.latlng.lng}));});
window.centrar=function(){var b=[];capa.eachLayer(function(l){if(l.getLatLng)b.push(l.getLatLng());});if(b.length>1)map.fitBounds(b,{padding:[40,40]});else if(b.length)map.setView(b[0],15);};
if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage('{"listo":true}');
</script></body></html>`;

export function Mapa({ puntos, yo, alTocar, ruta, style }: Props) {
  const web = useRef<WebView>(null);
  const [listo, setListo] = useState(false);
  const datos = JSON.stringify({ puntos, yo: yo ?? null, elegir: !!alTocar, ruta: !!ruta });

  useEffect(() => {
    if (listo) web.current?.injectJavaScript(`window.pintar(${datos});true;`);
  }, [listo, datos]);

  const mensaje = (e: WebViewMessageEvent) => {
    try {
      const m = JSON.parse(e.nativeEvent.data) as { listo?: boolean; lat?: number; lng?: number };
      if (m.listo) setListo(true);
      else if (typeof m.lat === "number" && typeof m.lng === "number") alTocar?.({ lat: m.lat, lng: m.lng });
    } catch {
      // mensaje ajeno
    }
  };

  return (
    <View style={[{ height: 220, borderRadius: 14, overflow: "hidden", backgroundColor: C.gray }, style]}>
      <WebView
        ref={web}
        source={{ html: HTML, baseUrl: "https://dlux.app" }}
        originWhitelist={["*"]}
        onMessage={mensaje}
        javaScriptEnabled
        setSupportMultipleWindows={false}
        style={{ backgroundColor: "transparent" }}
      />
    </View>
  );
}
