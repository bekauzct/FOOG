'use client';
// Stadion joylashuvini xaritada belgilash (Leaflet + OpenStreetMap)
import { useMemo } from 'react';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

function Click({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(Math.round(e.latlng.lat * 1e6) / 1e6, Math.round(e.latlng.lng * 1e6) / 1e6) });
  return null;
}

export default function PickMap({ lat, lng, onPick }: { lat: number; lng: number; onPick: (lat: number, lng: number) => void }) {
  const icon = useMemo(() => L.divIcon({ className: '', html: '<span style="display:flex;width:40px;height:40px;border-radius:50% 50% 50% 0;transform:translate(-50%,-100%) rotate(-45deg);background:var(--primary);align-items:center;justify-content:center;box-shadow:0 8px 20px rgba(0,0,0,.35)"><span class="ms fill" style="transform:rotate(45deg);color:var(--on-primary);font-size:22px">stadium</span></span>' }), []);
  return (
    <MapContainer center={[lat, lng]} zoom={13} style={{ width: '100%', height: '100%' }} scrollWheelZoom={false}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
      <Click onPick={onPick} />
      <Marker position={[lat, lng]} icon={icon} draggable eventHandlers={{ dragend: (e) => { const p = (e.target as L.Marker).getLatLng(); onPick(Math.round(p.lat * 1e6) / 1e6, Math.round(p.lng * 1e6) / 1e6); } }} />
    </MapContainer>
  );
}
