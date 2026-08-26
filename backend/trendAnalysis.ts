import { getSstHistory, getChlHistory } from './dataSources/copernicus';

export interface Trend {
  firstHalfAvg: number;
  secondHalfAvg: number;
  pctChange: number;
  direction: 'up' | 'down' | 'flat';
  days: number;
}

// Splits a real 30-day history into two halves and compares their
// averages — a simple, honest trend signal (not a fabricated one) that
// mirrors what the Explore charts already show, just summarized as a
// single number for reasoning rather than a full curve.
function computeTrend(history: { date: string; value: number }[]): Trend | null {
  if (history.length < 6) return null;
  const mid = Math.floor(history.length / 2);
  const firstHalf = history.slice(0, mid);
  const secondHalf = history.slice(mid);
  const avg = (arr: { value: number }[]) => arr.reduce((sum, d) => sum + d.value, 0) / arr.length;
  const firstHalfAvg = avg(firstHalf);
  const secondHalfAvg = avg(secondHalf);
  const pctChange = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
  const direction = Math.abs(pctChange) < 3 ? 'flat' : pctChange > 0 ? 'up' : 'down';
  return { firstHalfAvg, secondHalfAvg, pctChange, direction, days: history.length };
}

export interface RegionTrends {
  sst: Trend | null;
  chl: Trend | null;
}

export async function getRegionTrends(lat: number, lon: number): Promise<RegionTrends> {
  const [sstHistory, chlHistory] = await Promise.all([
    getSstHistory(lat, lon, 30).catch(() => []),
    getChlHistory(lat, lon, 30).catch(() => []),
  ]);
  return { sst: computeTrend(sstHistory), chl: computeTrend(chlHistory) };
}
