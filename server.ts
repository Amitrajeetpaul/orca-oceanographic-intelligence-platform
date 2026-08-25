import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { handleChat } from './backend/orchestrator';
import { probePoint } from './backend/probe';
import { getSstAt, getChlAt, getSstHistory, getChlHistory } from './backend/dataSources/copernicus';
import { getAllRegions, resolveRegion } from './backend/regions';

dotenv.config();

const COPERNICUS_REFRESH_MS = 3 * 60 * 60 * 1000; // matches copernicus.ts's cache TTL

// Copernicus's subprocess-backed fetch is slow (network + CLI + auth), so we
// warm its cache for the known regions in the background instead of making a
// chat request wait on a cold fetch. No-op if credentials aren't configured.
// Runs fully sequentially — this only delays how soon the cache is warm
// (the server itself is already listening by the time this starts), and
// concurrent subprocesses were dying silently under load even after capping
// their thread counts, most likely from Copernicus throttling concurrent
// sessions on the same account rather than a local resource limit.
async function warmCopernicusCache() {
  if (!process.env.COPERNICUSMARINE_SERVICE_USERNAME || !process.env.COPERNICUSMARINE_SERVICE_PASSWORD) return;
  for (const { name, coords } of getAllRegions()) {
    await getSstAt(coords.lat, coords.lon).catch((err) => console.warn(`Copernicus SST warm-up failed for ${name}:`, err));
    await getChlAt(coords.lat, coords.lon).catch((err) => console.warn(`Copernicus CHL warm-up failed for ${name}:`, err));
  }
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

  // Health check API
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'ORCA Oceanographic Intelligence Platform',
      hasApiKey: !!process.env.GROQ_API_KEY,
      hasCopernicusCredentials: !!process.env.COPERNICUSMARINE_SERVICE_USERNAME && !!process.env.COPERNICUSMARINE_SERVICE_PASSWORD,
    });
  });

  // Ocean AI Assistant endpoint — orchestrates 3 real data agents backed by
  // real sources (Temperature & Chlorophyll/PFZ: Copernicus Marine, falling
  // back to INCOIS; Weather: Open-Meteo), then optionally uses Groq to
  // synthesize a natural-language answer strictly from their live findings
  // (see backend/orchestrator.ts).
  app.post('/api/chat', async (req, res) => {
    const { prompt, region = 'South Kerala Coast', role = 'fisherman' } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    try {
      const result = await handleChat({ query: prompt, region, role });
      return res.json(result);
    } catch (error: any) {
      console.error('Chat orchestration error:', error);
      res.status(500).json({
        text: 'ORCA could not reach live ocean data sources just now. Please try again in a moment.',
        source: 'Unavailable',
        error: error.message,
      });
    }
  });

  // Real-time point probe for the map — reuses the same live INCOIS WMS
  // grid the agents use, for an arbitrary clicked lat/lon.
  app.get('/api/probe', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);

    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return res.status(400).json({ error: 'lat and lon query params are required' });
    }

    try {
      const result = await probePoint(lat, lon);
      return res.json(result);
    } catch (error: any) {
      console.error('Probe error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Real 30-day SST/chlorophyll history for Explore's charts — pulled
  // directly from Copernicus's own archive in one call each (not an
  // accumulating local store), so it's a genuine retrospective from day one.
  app.get('/api/history', async (req, res) => {
    const region = (req.query.region as string) || 'South Kerala Coast';
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
    const coords = resolveRegion(region);

    try {
      const [sst, chl] = await Promise.all([
        getSstHistory(coords.lat, coords.lon, days),
        getChlHistory(coords.lat, coords.lon, days),
      ]);
      return res.json({ region, coords, sst, chl });
    } catch (error: any) {
      console.error('History error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ORCA Server running on http://0.0.0.0:${PORT}`);
    warmCopernicusCache();
    setInterval(warmCopernicusCache, COPERNICUS_REFRESH_MS);
  });
}

startServer();
