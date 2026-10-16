'use client';
// Xarita servisi: OpenStreetMap plitkalari (Leaflet). Narx belgilari – dizayndagi "pin" uslubida.
import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

export type Pin = { id: string; lat: number; lng: number; label: string; dot?: string; on?: boolean; icon?: 'stadium' };

function Fit({ pins, center }: { pins: Pin[]; center?: [number, number] }) {
  const map = useMap();
  const key = pins.map((p) => p.id).join(',');
  useEffect(() => {
    if (center) map.setView(center, 15);
    else if (pins.length > 1) map.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lng])), { padding: [48, 48], maxZoom: 14 });
    else if (pins.length === 1) map.setView([pins[0].lat, pins[0].lng], 14);
  }, [key]);
  return null;
}

function Moves({ onMove }: { onMove?: (c: { lat: number; lng: number }) => void }) {
  useMapEvents({ moveend: (e) => onMove?.(e.target.getCenter()) });
  return null;
}

export default function MapView({ pins, center, me, onPin, onMove, onHover, zoomControl = true }: { pins: Pin[]; center?: [number, number]; me?: { lat: number; lng: number } | null; onPin?: (id: string) => void; onMove?: (c: { lat: number; lng: number }) => void; onHover?: (id: string | null) => void; zoomControl?: boolean }) {
  const icons = useMemo(() => new Map(pins.map((p) => [p.id, L.divIcon({
    className: '',
    html: p.icon === 'stadium'
      ? `<span style="display:flex;width:44px;height:44px;border-radius:50% 50% 50% 0;transform:translate(-50%,-100%) rotate(-45deg);background:var(--primary);align-items:center;justify-content:center;box-shadow:0 8px 20px rgba(0,0,0,.35)"><span class="ms fill" style="transform:rotate(45deg);color:var(--on-primary);font-size:24px">stadium</span></span>`
      : `<span class="map-pin ${p.on ? 'on' : ''}"><i style="background:${p.dot ?? 'var(--success)'}"></i>${p.label}</span>`,
  })])), [pins]);
  const meIcon = useMemo(() => L.divIcon({ className: '', html: '<span style="display:block;width:18px;height:18px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 6px color-mix(in oklch,var(--accent) 30%,transparent),inset 0 0 0 3px #fff;transform:translate(-50%,-50%)"></span>' }), []);
  return (
    <MapContainer center={center ?? [41.3111, 69.2797]} zoom={12} style={{ width: '100%', height: '100%' }} zoomControl={zoomControl} scrollWheelZoom attributionControl>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
      <Fit pins={pins} center={center} />
      <Moves onMove={onMove} />
      {me && <Marker position={[me.lat, me.lng]} icon={meIcon} interactive={false} />}
      {pins.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lng]} icon={icons.get(p.id)!} zIndexOffset={p.on ? 1000 : 0}
          eventHandlers={{ click: () => onPin?.(p.id), mouseover: () => onHover?.(p.id), mouseout: () => onHover?.(null) }} />
      ))}
    </MapContainer>
  );
}
