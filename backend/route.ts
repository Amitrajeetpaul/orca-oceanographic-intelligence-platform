import type { RoutePoint } from '../src/types';
import { geocodePlace } from './dataSources/geocoding';
import { getWeather } from './dataSources/openMeteo';

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

// Samples real live weather at 5 points along a straight line between origin
// and destination — good enough for coastal hops at this scale, without
// pulling in a full nautical-routing/land-avoidance engine.
export async function planRoute(originQuery: string, destQuery: string): Promise<RouteResult | null> {
  const [origin, dest] = await Promise.all([geocodePlace(originQuery), geocodePlace(destQuery)]);
  if (!origin || !dest) return null;

  const waypointCoords = WAYPOINT_NAMES.map((_, i) => {
    const t = i / (WAYPOINT_NAMES.length - 1);
    return {
      lat: origin.lat + (dest.lat - origin.lat) * t,
      lon: origin.lon + (dest.lon - origin.lon) * t,
    };
  });

  const weatherResults = await Promise.all(waypointCoords.map((c) => getWeather(c.lat, c.lon).catch(() => null)));

  const waypoints: RoutePoint[] = waypointCoords.map((c, i) => {
    const w = weatherResults[i];
    if (!w) {
      return { lat: c.lat, lng: c.lon, name: WAYPOINT_NAMES[i], status: 'caution', hazardReason: 'Weather data unavailable' };
    }

    const windKts = w.windSpeedKmh / 1.852;
    const wave = w.waveHeightM;
    let status: 'safe' | 'caution' | 'danger' = 'safe';
    let hazardReason: string | undefined;

    const parts: string[] = [];
    if (wave !== null && wave > 2) parts.push(`${wave.toFixed(1)}m swell`);
    if (windKts > 20) parts.push(`${windKts.toFixed(0)}kt wind`);

    if ((wave !== null && wave > 3) || windKts > 30) {
      status = 'danger';
      hazardReason = parts.join(', ');
    } else if (parts.length > 0) {
      status = 'caution';
      hazardReason = parts.join(', ');
    }

    return { lat: c.lat, lng: c.lon, name: WAYPOINT_NAMES[i], status, hazardReason };
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
