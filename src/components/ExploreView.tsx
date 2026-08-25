import React, { useState, useEffect } from 'react';
import { REGIONAL_METRICS } from '../data/mockData';
import { resolveRegionCoords } from '../data/regionCoords';
import {
  TrendingUp,
  MapPin,
  Leaf,
  Activity,
  ArrowRightLeft,
  Compass,
  MoreHorizontal,
} from 'lucide-react';
import { MapLayer } from '../types';
import { OceanMap, ProbeResult } from './OceanMap';

interface ExploreViewProps {
  selectedRegion: string;
  onRegionChange: (region: string) => void;
}

interface ProbeCoords {
  lat: string;
  lng: string;
  sst: string;
  chl: string;
}

interface DailyValue {
  date: string;
  value: number;
}

interface RegionConditions {
  salinityPsu: number | null;
  windKts: number | null;
  waveHeightM: number | null;
}

function seriesRange(history: DailyValue[] | null): [number, number] {
  if (!history || history.length === 0) return [0, 1];
  const values = history.map((d) => d.value);
  return [Math.min(...values), Math.max(...values)];
}

function barHeightPct(value: number, min: number, max: number): number {
  if (max === min) return 60;
  return Math.max(15, Math.min(95, ((value - min) / (max - min)) * 80 + 15));
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

// Real daily points connected with straight segments (no invented curve
// smoothing) — normalized into the SVG's 0-100 x / 0-50 y viewBox.
function buildLinePoints(history: DailyValue[], min: number, max: number): string {
  if (history.length === 0) return '';
  const stepX = history.length > 1 ? 100 / (history.length - 1) : 0;
  return history
    .map((d, i) => {
      const x = i * stepX;
      const norm = max === min ? 0.5 : (d.value - min) / (max - min);
      const y = 45 - norm * 40; // 5px padding top/bottom within the 0-50 viewBox
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' L');
}

export const ExploreView: React.FC<ExploreViewProps> = ({
  selectedRegion,
  onRegionChange,
}) => {
  // Sub-tabs: 'heatmap' or 'research'
  const [subTab, setSubTab] = useState<'heatmap' | 'research'>('heatmap');
  const [activeLayer, setActiveLayer] = useState<MapLayer>('Temp');
  const [probeCoords, setProbeCoords] = useState<ProbeCoords | null>(null);

  // Research comparison state
  const [regionA, setRegionA] = useState<string>('Vizhinjam');
  const [regionB, setRegionB] = useState<string>('Kochi');
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);
  const [sstHistory, setSstHistory] = useState<DailyValue[] | null>(null);
  const [chlHistory, setChlHistory] = useState<DailyValue[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [conditionsA, setConditionsA] = useState<RegionConditions | null>(null);
  const [conditionsB, setConditionsB] = useState<RegionConditions | null>(null);

  const metricA = REGIONAL_METRICS[regionA] || REGIONAL_METRICS.Vizhinjam;
  const metricB = REGIONAL_METRICS[regionB] || REGIONAL_METRICS.Kochi;
  const regionCoords = resolveRegionCoords(selectedRegion);

  // Real 30-day SST/chlorophyll history, pulled from Copernicus's own
  // archive — fetched lazily once the Research tab is actually opened.
  useEffect(() => {
    if (subTab !== 'research') return;
    let cancelled = false;
    setHistoryLoading(true);
    fetch(`/api/history?region=${encodeURIComponent(selectedRegion)}&days=30`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setSstHistory(data.sst || []);
        setChlHistory(data.chl || []);
      })
      .catch(() => {
        if (!cancelled) {
          setSstHistory([]);
          setChlHistory([]);
        }
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [subTab, selectedRegion]);

  // Real surface salinity (Copernicus Marine) + wind/wave (Open-Meteo) for
  // the two regions being compared — replaces the old fully-mock buoy card.
  useEffect(() => {
    if (subTab !== 'research') return;
    let cancelled = false;

    const fetchConditions = (regionName: string, setter: (c: RegionConditions | null) => void) => {
      fetch(`/api/conditions?region=${encodeURIComponent(regionName)}`)
        .then((res) => res.json())
        .then((data) => {
          if (!cancelled) setter({ salinityPsu: data.salinityPsu, windKts: data.windKts, waveHeightM: data.waveHeightM });
        })
        .catch(() => {
          if (!cancelled) setter(null);
        });
    };

    fetchConditions(metricA.regionName, setConditionsA);
    fetchConditions(metricB.regionName, setConditionsB);

    return () => {
      cancelled = true;
    };
  }, [subTab, regionA, regionB]);

  const handleProbe = (lat: number, lon: number, result: ProbeResult | null) => {
    if (!result) {
      setProbeCoords(null);
      return;
    }
    setProbeCoords({
      lat: `${lat.toFixed(3)}° N`,
      lng: `${lon.toFixed(3)}° E`,
      sst: result.sst.value !== null ? `${result.sst.value.toFixed(1)}°C` : 'Unavailable',
      chl: result.chl.value !== null ? `${result.chl.value.toFixed(2)} mg/m³` : 'Unavailable',
    });
  };

  const [sstMin, sstMax] = seriesRange(sstHistory);
  const [chlMin, chlMax] = seriesRange(chlHistory);
  const sstWeeklyDelta =
    sstHistory && sstHistory.length >= 8
      ? sstHistory[sstHistory.length - 1].value - sstHistory[sstHistory.length - 8].value
      : null;
  const chlLinePoints = chlHistory ? buildLinePoints(chlHistory, chlMin, chlMax) : '';

  return (
    <main className="w-full px-4 -mt-36 z-10 flex-1 flex flex-col gap-3.5 pb-24">
      {/* Sub-Tab Navigation Header */}
      <div className="bg-[#ffffff] rounded-2xl p-1 flex gap-1 border border-[#c2c6d1]/35 shadow-sm">
        <button
          onClick={() => setSubTab('heatmap')}
          className={`flex-1 py-2 rounded-xl text-xs font-heading font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            subTab === 'heatmap'
              ? 'btn-primary-gradient text-white'
              : 'text-[#6b6b80] hover:text-[#22223b]'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Heatmap Explorer</span>
        </button>
        <button
          onClick={() => setSubTab('research')}
          className={`flex-1 py-2 rounded-xl text-xs font-heading font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            subTab === 'research'
              ? 'btn-primary-gradient text-white'
              : 'text-[#6b6b80] hover:text-[#22223b]'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Research &amp; Trends</span>
        </button>
      </div>

      {/* Sub-Tab 1: Dedicated Heatmap Explorer */}
      {subTab === 'heatmap' && (
        <div className="flex flex-col gap-3">
          {/* Main Map Container */}
          <div className="bg-[#ffffff] rounded-2xl p-3 border border-[#c2c6d1]/35 floating-card-shadow flex flex-col gap-2.5">
            <div className="flex justify-between items-center px-1">
              <div>
                <h3 className="font-heading text-xs font-bold text-[#1a5490]">
                  Satellite Ocean Color &amp; SST Grid
                </h3>
                <p className="text-[10px] text-[#6b6b80]">
                  Click anywhere on the map to probe live telemetry
                </p>
              </div>

              {/* Layer switch buttons */}
              <div className="flex bg-[#fafaf7] p-0.5 rounded-lg border border-[#c2c6d1]/40 text-[10px]">
                <button
                  onClick={() => setActiveLayer('Temp')}
                  className={`px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${
                    activeLayer === 'Temp' ? 'bg-[#1a5490] text-white shadow-2xs' : 'text-[#6b6b80]'
                  }`}
                >
                  SST
                </button>
                <button
                  onClick={() => setActiveLayer('Chlorophyll')}
                  className={`px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${
                    activeLayer === 'Chlorophyll' ? 'bg-[#1a5490] text-white shadow-2xs' : 'text-[#6b6b80]'
                  }`}
                >
                  Chlorophyll
                </button>
                <button
                  onClick={() => setActiveLayer('PFZ')}
                  className={`px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${
                    activeLayer === 'PFZ' ? 'bg-[#1a5490] text-white shadow-2xs' : 'text-[#6b6b80]'
                  }`}
                >
                  PFZ
                </button>
              </div>
            </div>

            {/* Real Leaflet Map — OSM base + INCOIS live WMS heatmap layer */}
            <div className="rounded-xl overflow-hidden">
              <OceanMap center={regionCoords} activeLayer={activeLayer} height={260} onProbe={handleProbe}>
                {/* Gradient scale legend bar (Top Right) */}
                <div className="absolute top-2.5 right-2.5 bg-white/95 backdrop-blur-md rounded-lg p-2 shadow-xs border border-[#c2c6d1]/40 z-[1000] min-w-[90px] pointer-events-none">
                  <div className="text-[8px] font-bold tracking-wider text-[#6b6b80] mb-1 text-center uppercase font-heading">
                    {activeLayer === 'Temp' ? 'SST Scale (°C)' : 'Chlorophyll Scale'}
                  </div>
                  <div className="w-full h-2 rounded-xs heatmap-scale-bar" />
                  <div className="flex justify-between text-[8px] text-[#22223b] mt-0.5 font-mono font-semibold">
                    <span>{activeLayer === 'Temp' ? '26.5°' : '0.1'}</span>
                    <span>{activeLayer === 'Temp' ? '29.8°' : '4.5'}</span>
                  </div>
                </div>
              </OceanMap>
            </div>

            {/* Probe Inspector Card */}
            {probeCoords && (
              <div className="bg-[#fafaf7] rounded-xl p-2.5 border border-[#c2c6d1]/30 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#1a5490]" />
                  <div>
                    <span className="text-[9px] font-mono text-[#6b6b80] uppercase block">
                      Selected Coordinates
                    </span>
                    <span className="font-mono font-bold text-[#22223b]">
                      {probeCoords.lat}, {probeCoords.lng}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div>
                    <span className="text-[9px] text-[#6b6b80] uppercase font-mono block">SST</span>
                    <span className="font-mono font-bold text-[#c62828]">{probeCoords.sst}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-[#6b6b80] uppercase font-mono block">Chlorophyll</span>
                    <span className="font-mono font-bold text-[#2e7d32]">{probeCoords.chl}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sub-Tab 2: Research & Analysis (Trends + Compare Two Regions) */}
      {subTab === 'research' && (
        <div className="flex flex-col gap-3.5">
          {/* Compare-Two-Regions Selector */}
          <div className="bg-[#ffffff] rounded-2xl p-3.5 border border-[#c2c6d1]/35 floating-card-shadow flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ArrowRightLeft className="w-4 h-4 text-[#1a5490]" />
                <h3 className="font-heading text-xs font-bold text-[#1a5490]">
                  Compare Two Maritime Regions
                </h3>
              </div>
              <span className="text-[9px] font-mono text-[#6b6b80]">Delta Analysis</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] font-bold text-[#6b6b80] uppercase font-heading block mb-1">
                  Region A
                </label>
                <select
                  value={regionA}
                  onChange={(e) => setRegionA(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#c2c6d1]/50 bg-[#fafaf7] text-xs font-semibold text-[#22223b] focus:outline-hidden cursor-pointer"
                >
                  <option value="Vizhinjam">Vizhinjam Coast</option>
                  <option value="Kochi">Kochi Offshore</option>
                  <option value="Bay of Bengal">Bay of Bengal</option>
                </select>
              </div>

              <div>
                <label className="text-[9px] font-bold text-[#6b6b80] uppercase font-heading block mb-1">
                  Region B
                </label>
                <select
                  value={regionB}
                  onChange={(e) => setRegionB(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#c2c6d1]/50 bg-[#fafaf7] text-xs font-semibold text-[#22223b] focus:outline-hidden cursor-pointer"
                >
                  <option value="Kochi">Kochi Offshore</option>
                  <option value="Vizhinjam">Vizhinjam Coast</option>
                  <option value="Bay of Bengal">Bay of Bengal</option>
                </select>
              </div>
            </div>

            {/* Side-by-Side Comparison Matrix */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#c2c6d1]/20">
              <div className="bg-[#fafaf7] p-2.5 rounded-xl border border-[#c2c6d1]/30 flex flex-col gap-1 text-[11px]">
                <span className="font-heading font-bold text-[#1a5490]">{metricA.regionName}</span>
                <div className="flex justify-between text-[#424750]">
                  <span>Salinity:</span>
                  <span className="font-mono font-bold">
                    {conditionsA?.salinityPsu != null ? `${conditionsA.salinityPsu.toFixed(1)} PSU` : '—'}
                  </span>
                </div>
                <div className="flex justify-between text-[#424750]">
                  <span>Wind Speed:</span>
                  <span className="font-mono font-bold">
                    {conditionsA?.windKts != null ? `${conditionsA.windKts.toFixed(0)} kts` : '—'}
                  </span>
                </div>
                <div className="flex justify-between text-[#424750]">
                  <span>Wave Height:</span>
                  <span className="font-mono font-bold">
                    {conditionsA?.waveHeightM != null ? `${conditionsA.waveHeightM.toFixed(1)} m` : '—'}
                  </span>
                </div>
              </div>

              <div className="bg-[#fafaf7] p-2.5 rounded-xl border border-[#c2c6d1]/30 flex flex-col gap-1 text-[11px]">
                <span className="font-heading font-bold text-[#1a5490]">{metricB.regionName}</span>
                <div className="flex justify-between text-[#424750]">
                  <span>Salinity:</span>
                  <span className="font-mono font-bold">
                    {conditionsB?.salinityPsu != null ? `${conditionsB.salinityPsu.toFixed(1)} PSU` : '—'}
                  </span>
                </div>
                <div className="flex justify-between text-[#424750]">
                  <span>Wind Speed:</span>
                  <span className="font-mono font-bold">
                    {conditionsB?.windKts != null ? `${conditionsB.windKts.toFixed(0)} kts` : '—'}
                  </span>
                </div>
                <div className="flex justify-between text-[#424750]">
                  <span>Wave Height:</span>
                  <span className="font-mono font-bold">
                    {conditionsB?.waveHeightM != null ? `${conditionsB.waveHeightM.toFixed(1)} m` : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Weekly Insight Glass Card */}
          <div className="bg-[#ffffff] rounded-2xl p-4 border border-[#c2c6d1]/35 floating-card-shadow flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-full bg-[#dcfce7] text-[#16a34a] flex items-center justify-center shrink-0 shadow-2xs">
              <TrendingUp className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="flex-1">
              <h3 className="font-heading text-sm font-extrabold text-[#111827] tracking-tight">
                Weekly Insight
              </h3>
              <p className="text-xs text-[#374151] leading-relaxed mt-1">
                {historyLoading ? (
                  'Fetching live satellite history…'
                ) : sstWeeklyDelta === null ? (
                  'Not enough historical readings yet to compute a weekly trend for this region.'
                ) : (
                  <>
                    Average SST has {sstWeeklyDelta >= 0 ? 'increased' : 'decreased'} by{' '}
                    <span className="font-extrabold text-[#dc2626]">
                      {Math.abs(sstWeeklyDelta).toFixed(1)}°C
                    </span>{' '}
                    over the last week near {selectedRegion}.
                  </>
                )}
              </p>
            </div>
          </div>

          {/* SST Trend (30 Days) Card — real daily readings from Copernicus Marine */}
          <div className="bg-[#ffffff] rounded-2xl p-4 floating-card-shadow border border-[#c2c6d1]/35 flex flex-col justify-between">
            <div className="flex justify-between items-center mb-1">
              <div className="flex items-center gap-1.5">
                <h3 className="font-heading text-sm font-extrabold text-[#111827] tracking-tight">
                  SST Trend <span className="text-xs font-normal text-[#6b7280]">(30 Days)</span>
                </h3>
              </div>
              <button
                type="button"
                className="text-[#9ca3af] hover:text-[#374151] p-1 rounded-md transition-colors"
                title="Options"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>

            {!sstHistory || sstHistory.length === 0 ? (
              <div className="h-28 w-full flex items-center justify-center text-[10px] text-[#9ca3af] font-mono">
                {historyLoading ? 'Loading real satellite data…' : 'No live SST history available for this region.'}
              </div>
            ) : (
              <>
                <div className="h-28 w-full relative flex items-end justify-between gap-1 mt-4 px-1">
                  {sstHistory.map((day, index) => {
                    const isSelected = hoveredBarIndex === index;
                    const heightPct = barHeightPct(day.value, sstMin, sstMax);

                    return (
                      <div
                        key={day.date}
                        onMouseEnter={() => setHoveredBarIndex(index)}
                        onMouseLeave={() => setHoveredBarIndex(null)}
                        className="w-full h-full flex flex-col justify-end items-center relative group cursor-pointer"
                      >
                        {isSelected && (
                          <div className="absolute -top-6 bg-[#ffffff] shadow-xs border border-[#c2c6d1]/40 rounded px-1.5 py-0.5 text-[8px] font-bold text-[#1a5490] font-mono whitespace-nowrap z-20">
                            {day.value.toFixed(1)}°C · {formatShortDate(day.date)}
                          </div>
                        )}
                        <div
                          style={{ height: `${heightPct}%` }}
                          className={`w-full rounded-t-xs transition-all ${
                            isSelected ? 'bar-highlight-gradient' : 'bar-inactive-gradient'
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between mt-2 text-[8px] text-[#6b6b80] font-mono">
                  <span>{formatShortDate(sstHistory[0].date)}</span>
                  <span>{formatShortDate(sstHistory[Math.floor(sstHistory.length / 2)].date)}</span>
                  <span>{formatShortDate(sstHistory[sstHistory.length - 1].date)}</span>
                </div>
              </>
            )}
          </div>

          {/* Chlorophyll Concentration Card — real daily readings, gap-free ocean colour product */}
          <div className="bg-[#ffffff] rounded-2xl p-4 floating-card-shadow border border-[#c2c6d1]/35 flex flex-col justify-between">
            <div className="flex justify-between items-center mb-1">
              <div className="flex items-center gap-1.5">
                <Leaf className="w-4 h-4 text-[#2e7d32]" />
                <h3 className="font-heading text-xs font-bold text-[#22223b]">
                  Chlorophyll Concentration <span className="font-normal text-[#6b7280]">(30 Days)</span>
                </h3>
              </div>
              <span className="text-[8px] font-bold text-[#2e7d32] font-mono bg-[#e8f5e9] px-2 py-0.5 rounded-full">
                mg/m³
              </span>
            </div>

            {!chlHistory || chlHistory.length === 0 ? (
              <div className="h-24 w-full flex items-center justify-center text-[10px] text-[#9ca3af] font-mono">
                {historyLoading ? 'Loading real satellite data…' : 'No live chlorophyll history available for this region.'}
              </div>
            ) : (
              <>
                <div className="h-24 w-full relative mt-2">
                  <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 50">
                    <defs>
                      <linearGradient id="chloroGrad" x1="0%" x2="0%" y1="0%" y2="100%">
                        <stop offset="0%" stopColor="#2e7d32" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#e8f5e9" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path d={`M${chlLinePoints} L100,50 L0,50 Z`} fill="url(#chloroGrad)" />
                    <path
                      d={`M${chlLinePoints}`}
                      fill="none"
                      stroke="#2e7d32"
                      strokeWidth="2"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                </div>

                <div className="flex justify-between mt-2 text-[8px] text-[#6b6b80] font-mono">
                  <span>{formatShortDate(chlHistory[0].date)}</span>
                  <span>{formatShortDate(chlHistory[Math.floor(chlHistory.length / 2)].date)}</span>
                  <span>{formatShortDate(chlHistory[chlHistory.length - 1].date)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
};
