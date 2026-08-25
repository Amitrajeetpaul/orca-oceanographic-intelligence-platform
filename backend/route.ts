import type { RoutePoint } from '../src/types';
import { geocodePlace } from './dataSources/geocoding';
import { getWeather } from './dataSources/openMeteo';
import { checkGeofence } from './dataSources/eez';
import { findNearestPfz } from './pfzSearch';

export interface RouteResult {
  origin: string;
  originCoords: { lat: number; lon: number };
  destination: string;
  destCoords: { lat: number; lon: number };
  distance: string;
  estimatedTime: string;
  hazards: string[];
  waypoints: RoutePoint[];
}

const ASSUMED_SPEED_KNOTS = 15; // typical small fishing-vessel cruise speed
const WAYPOINT_NAMES = ['Origin', 'Waypoint 1', 'Midpoint', 'Waypoint 2', 'Destination'];

function haversineNm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R_KM = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const km = 2 * R_KM * Math.asin(Math.sqrt(h));
  return km * 0.539957; // km -> nautical miles
}

export interface NamedPoint {
  displayName: string;
  lat: number;
  lon: number;
}

// Shared by both a normal two-named-place route and a route to a derived
// "nearest fishing zone" destination — samples real live weather (and
// geofence status) at 5 points along a straight line, good enough for
// coastal hops at this scale without a full nautical-routing engine.
async function buildRouteResult(origin: NamedPoint, dest: NamedPoint): Promise<RouteResult> {
  const waypointCoords = WAYPOINT_NAMES.map((_, i) => {
    const t = i / (WAYPOINT_NAMES.length - 1);
    return {
      lat: origin.lat + (dest.lat - origin.lat) * t,
      lon: origin.lon + (dest.lon - origin.lon) * t,
    };
  });

  const [weatherResults, geofenceResults] = await Promise.all([
    Promise.all(waypointCoords.map((c) => getWeather(c.lat, c.lon).catch(() => null))),
    Promise.all(waypointCoords.map((c) => checkGeofence(c.lat, c.lon).catch(() => null))),
  ]);

  const waypoints: RoutePoint[] = waypointCoords.map((c, i) => {
    const w = weatherResults[i];
    const geofence = geofenceResults[i];

    let status: 'safe' | 'caution' | 'danger' = 'safe';
    const parts: string[] = [];

    if (!w) {
      status = 'caution';
      parts.push('Weather data unavailable');
    } else {
      const windKts = w.windSpeedKmh / 1.852;
      const wave = w.waveHeightM;
      if (wave !== null && wave > 2) parts.push(`${wave.toFixed(1)}m swell`);
      if (windKts > 20) parts.push(`${windKts.toFixed(0)}kt wind`);
      if ((wave !== null && wave > 3) || windKts > 30) status = 'danger';
      else if (parts.length > 0) status = 'caution';
    }

    // Real EEZ boundary check (VLIZ Marine Regions) — a waypoint actually
    // inside foreign waters overrides everything else as 'danger'; being
    // near a boundary at least bumps a 'safe' waypoint to 'caution'.
    if (geofence?.inForeignWaters && geofence.currentTerritory) {
      status = 'danger';
      parts.unshift(`entering ${geofence.currentTerritory} waters`);
    } else if (geofence?.nearForeignBoundary && geofence.nearbyTerritory) {
      if (status === 'safe') status = 'caution';
      parts.push(`~15nm from ${geofence.nearbyTerritory} waters`);
    }

    return { lat: c.lat, lng: c.lon, name: WAYPOINT_NAMES[i], status, hazardReason: parts.length > 0 ? parts.join(', ') : undefined };
  });

  const distanceNm = haversineNm(origin, dest);
  const timeMins = Math.round((distanceNm / ASSUMED_SPEED_KNOTS) * 60);

  const hazards = waypoints
    .filter((w) => w.status !== 'safe')
    .map((w) => `${w.name}: ${w.hazardReason || 'Hazardous conditions'}`);

  return {
    origin: origin.displayName,
    originCoords: { lat: origin.lat, lon: origin.lon },
    destination: dest.displayName,
    destCoords: { lat: dest.lat, lon: dest.lon },
    distance: `${distanceNm.toFixed(1)} nm`,
    estimatedTime: `${timeMins} mins @ ${ASSUMED_SPEED_KNOTS} kts`,
    hazards,
    waypoints,
  };
}

export async function planRoute(originQueryOrPoint: string | NamedPoint, destQuery: string): Promise<RouteResult | null> {
  const [origin, dest] = await Promise.all([
    typeof originQueryOrPoint === 'string' ? geocodePlace(originQueryOrPoint) : originQueryOrPoint,
    geocodePlace(destQuery),
  ]);
  if (!origin || !dest) return null;
  return buildRouteResult(origin, dest);
}

// For "route me to the nearest good fishing zone"-style questions, where
// the destination isn't a real named place to geocode — it has to be
// derived live from the same SST/chlorophyll signals INCOIS's own PFZ
// advisories use (see pfzSearch.ts), then routed to like any other point.
export async function planRouteToNearestPfz(originQueryOrPoint: string | NamedPoint): Promise<RouteResult | null> {
  const origin = typeof originQueryOrPoint === 'string' ? await geocodePlace(originQueryOrPoint) : originQueryOrPoint;
  if (!origin) return null;

  const pfz = await findNearestPfz(origin.lat, origin.lon);
  if (!pfz) return null;

  const dest: NamedPoint = {
    displayName: `Potential Fishing Zone (${pfz.potential}, ${pfz.distanceNm}nm ${pfz.bearingLabel} of ${origin.displayName})`,
    lat: pfz.lat,
    lon: pfz.lon,
  };
  return buildRouteResult(origin, dest);
}
