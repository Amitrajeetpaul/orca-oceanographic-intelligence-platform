import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, WMSTileLayer, Marker, Popup, AttributionControl, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapLayer } from '../types';

const WMS_URL = 'https://incois.gov.in/geoserver/PFZ-TUNA-SST-CHL/wms';
const WORKSPACE = 'PFZ-TUNA-SST-CHL';

export interface ProbeResult {
  lat: number;
  lon: number;
  sst: { value: number | null; degraded: boolean };
  chl: { value: number | null; degraded: boolean };
  pfzPotential: 'High' | 'Moderate' | 'Low';
}

async function fetchProbe(lat: number, lon: number): Promise<ProbeResult | null> {
  try {
    const res = await fetch(`/api/probe?lat=${lat}&lon=${lon}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function regionIcon() {
  return L.divIcon({
    className: '',
    html: `<div class="relative flex items-center justify-center">
      <div class="w-8 h-8 rounded-full border-2 border-[#2e7d32] border-dashed animate-spin flex items-center justify-center bg-[#2e7d32]/20" style="animation-duration:8s"></div>
      <div class="absolute w-3 h-3 rounded-full bg-[#2e7d32] border-2 border-white shadow"></div>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function probeIcon() {
  return L.divIcon({
    className: '',
    html: `<div class="relative flex items-center justify-center">
      <div class="w-8 h-8 rounded-full bg-[#38bdf8]/30 border border-[#38bdf8] animate-ping" style="animation-duration:2.5s"></div>
      <div class="absolute w-4 h-4 rounded-full bg-[#0284c7] border-2 border-white shadow-md"></div>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function fmt(value: number | null, unit: string, digits = 1) {
  return value === null ? 'Unavailable' : `${value.toFixed(digits)}${unit}`;
}

// MapContainer only uses center/zoom for the *initial* view — react-leaflet
// doesn't re-center on prop changes, so this imperatively flies to a new
// center whenever it changes (e.g. the chat resolves a different place).
function RecenterOnChange({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lon], map.getZoom(), { duration: 0.8 });
  }, [lat, lon]);
  return null;
}

function ClickProbeHandler({ onResult }: { onResult: (lat: number, lon: number, result: ProbeResult | null) => void }) {
  useMapEvents({
    async click(e) {
      const { lat, lng } = e.latlng;
      const result = await fetchProbe(lat, lng);
      onResult(lat, lng, result);
    },
  });
  return null;
}

export interface OceanMapProps {
  center: { lat: number; lon: number };
  zoom?: number;
  activeLayer: MapLayer;
  height: number | string;
  onProbe?: (lat: number, lon: number, result: ProbeResult | null) => void;
  children?: React.ReactNode;
}

export const OceanMap: React.FC<OceanMapProps> = ({ center, zoom = 9, activeLayer, height, onProbe, children }) => {
  const [regionProbe, setRegionProbe] = useState<ProbeResult | null>(null);
  const [probedPoint, setProbedPoint] = useState<{ lat: number; lon: number; result: ProbeResult | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRegionProbe(null);
    fetchProbe(center.lat, center.lon).then((result) => {
      if (!cancelled) setRegionProbe(result);
    });
    return () => {
      cancelled = true;
    };
  }, [center.lat, center.lon]);

  const wmsLayer = activeLayer === 'Chlorophyll' ? 'chl' : 'sst';

  return (
    <div className="relative w-full" style={{ height }}>
      <MapContainer
        center={[center.lat, center.lon]}
        zoom={zoom}
        scrollWheelZoom
        className="w-full h-full"
        style={{ background: '#0d2c4d' }}
        attributionControl={false}
      >
        {/* Compact attribution (no "Leaflet |" branding prefix) tucked in the
            free bottom-left corner so it doesn't collide with the centered
            layer-toggle pills — still fulfils OSM's required credit. */}
        <AttributionControl position="bottomleft" prefix={false} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <WMSTileLayer
          key={wmsLayer}
          url={WMS_URL}
          layers={`${WORKSPACE}:${wmsLayer}`}
          format="image/png"
          transparent
          version="1.1.1"
          opacity={activeLayer === 'PFZ' ? 0.45 : 0.8}
        />

        <RecenterOnChange lat={center.lat} lon={center.lon} />

        <ClickProbeHandler
          onResult={(lat, lon, result) => {
            setProbedPoint({ lat, lon, result });
            onProbe?.(lat, lon, result);
          }}
        />

        <Marker position={[center.lat, center.lon]} icon={regionIcon()}>
          <Popup>
            <div className="text-xs font-sans">
              <strong>Selected region</strong>
              <br />
              SST: {regionProbe ? fmt(regionProbe.sst.value, '°C') : 'Loading…'}
              <br />
              Chlorophyll: {regionProbe ? fmt(regionProbe.chl.value, ' mg/m³', 2) : 'Loading…'}
              <br />
              PFZ potential: {regionProbe?.pfzPotential ?? '—'}
              <div className="text-[9px] text-[#6b6b80] mt-1">Live-data-derived, not the official INCOIS advisory line.</div>
            </div>
          </Popup>
        </Marker>

        {probedPoint && (
          <Marker position={[probedPoint.lat, probedPoint.lon]} icon={probeIcon()}>
            <Popup>
              <div className="text-xs font-sans">
                <strong>Probed point</strong>
                <br />
                SST: {fmt(probedPoint.result?.sst.value ?? null, '°C')}
                <br />
                Chlorophyll: {fmt(probedPoint.result?.chl.value ?? null, ' mg/m³', 2)}
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {children}
    </div>
  );
};
