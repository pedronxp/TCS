import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { CustomerMapPoint } from '@/types/domain';

export function CustomerMap({ points }: { points: CustomerMapPoint[] }) {
  const node = useRef<HTMLDivElement>(null);
  useEffect(()=>{if(!node.current)return;const located=points.filter(point=>point.latitude!==null&&point.longitude!==null);if(!located.length)return;const map=new maplibregl.Map({container:node.current,style:'https://demotiles.maplibre.org/style.json',center:[located[0].longitude!,located[0].latitude!],zoom:11});map.addControl(new maplibregl.NavigationControl(),'top-right');map.on('load',()=>{const bounds=new maplibregl.LngLatBounds();for(const point of located){const position:[number,number]=[point.longitude!,point.latitude!];bounds.extend(position);new maplibregl.Marker({color:riskColor(point.risk)}).setLngLat(position).setPopup(new maplibregl.Popup().setText(`${point.protocol||'Vistoria'} · ${point.risk||'sem risco'}`)).addTo(map);}if(located.length>1)map.fitBounds(bounds,{padding:50,maxZoom:14});});return()=>map.remove();},[points]);
  return <div ref={node} className="h-[460px] overflow-hidden rounded-xl border bg-slate-100" aria-label="Mapa das vistorias do cliente"/>;
}
function riskColor(risk:string|null){if(risk==='r4'||risk==='critico')return'#7c3aed';if(risk==='r3'||risk==='alto')return'#ef4444';if(risk==='r2'||risk==='medio')return'#f59e0b';return'#10b981';}
