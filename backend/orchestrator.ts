import type { AgentFinding, AgentStatus } from '../src/types';
import { resolveRegion } from './regions';
import { geocodePlace } from './dataSources/geocoding';
import { runTemperatureAgent } from './agents/temperatureAgent';
import { runChlorophyllAgent } from './agents/chlorophyllAgent';
import { runWeatherAgent } from './agents/weatherAgent';

export interface ChatResult {
  text: string;
  source: string;
  agents: AgentStatus[];
  findings: AgentFinding[];
  resolvedLocation: { lat: number; lon: number; label: string };
  pfzDetails: {
    distance: string;
    bearing: string;
    sst: string;
    chlorophyll: string;
    depth: string;
    potential: 'High' | 'Moderate' | 'Low';
    coordinates?: string;
  };
}

function toAgentStatus(f: AgentFinding): AgentStatus {
  return {
    name: f.agentName,
    type: f.type,
    status: f.status,
    value: f.value,
    source: f.sourceName,
    confidence: f.confidence,
  };
}

const GROQ_MODEL = 'openai/gpt-oss-20b';

async function synthesizeWithGroq(params: {
  query: string;
  region: string;
  role: string;
  evidenceLines: string;
}): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const systemPrompt = `You are ORCA, a marine intelligence assistant for Indian coastal waters. A user (role: ${params.role}) asked about region "${params.region}". Three specialized agents just gathered LIVE evidence below. Write a 2-4 sentence answer using ONLY the numbers and facts given below — never invent a number that isn't listed. If an agent reports "Unavailable" or low confidence, say so plainly instead of guessing. Do not add a source citation line, one is appended separately.

Evidence:
${params.evidenceLines}`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: params.query },
        ],
        temperature: 0.4,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) throw new Error(`Groq API responded ${res.status}`);
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch (err) {
    console.warn('Groq synthesis failed, using template answer:', err);
    return null;
  }
}

// Lets a user ask about any place ("Marina Beach", "Kovalam") in free text
// instead of being limited to the fixed region dropdown. Returns null if no
// specific place is mentioned (or Groq is unavailable) so the caller falls
// back to the dropdown-selected region.
async function extractPlaceName(query: string): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: 'system',
            content: `Extract the core place, city, or beach name mentioned in the user's question about Indian coastal waters. Strip generic descriptor words like "coast", "sea", "waters", "area" unless they're part of the official name (e.g. keep "Marina Beach" as-is, but for "Chennai coast" extract just "Chennai"). Reply with ONLY the place name and nothing else. If no specific place is mentioned, reply with exactly: NONE`,
          },
          { role: 'user', content: query },
        ],
        temperature: 0,
        max_tokens: 200,
        reasoning_effort: 'low',
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const place = data.choices?.[0]?.message?.content?.trim();
    if (!place || place.toUpperCase() === 'NONE') return null;
    return place;
  } catch (err) {
    console.warn('Place extraction failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

function buildTemplateAnswer(findings: AgentFinding[], region: string): string {
  const [temp, chl, weather] = findings;
  return [
    temp.confidence > 0
      ? `Sea surface temperature off ${region} is ${temp.value}.`
      : `Sea surface temperature data is currently unavailable for ${region}.`,
    chl.confidence > 0 ? `Chlorophyll concentration reads ${chl.value}.` : `Chlorophyll data is currently unavailable.`,
    weather.confidence > 0 ? `Marine conditions: ${weather.value}.` : `Weather data is currently unavailable.`,
  ].join(' ');
}

export async function handleChat(params: { query: string; region: string; role: string }): Promise<ChatResult> {
  const { query, role } = params;

  // Try to figure out a specific place from the question itself ("Marina
  // Beach", "Kovalam") before falling back to the dropdown-selected region —
  // people ask about wherever they actually are, not a fixed list of 5 spots.
  let coords = resolveRegion(params.region);
  let region = params.region;
  const extractedPlace = await extractPlaceName(query);
  if (extractedPlace) {
    const geocoded = await geocodePlace(extractedPlace);
    if (geocoded) {
      coords = { lat: geocoded.lat, lon: geocoded.lon };
      region = geocoded.displayName;
    }
  }

  const [tempFinding, chlResult, weatherFinding] = await Promise.all([
    runTemperatureAgent(coords.lat, coords.lon),
    runChlorophyllAgent(coords.lat, coords.lon),
    runWeatherAgent(coords.lat, coords.lon),
  ]);

  const findings: AgentFinding[] = [tempFinding, chlResult.finding, weatherFinding];
  const agents = findings.map(toAgentStatus);

  const liveSourceNames = [...new Set(findings.filter((f) => f.confidence > 0).map((f) => f.sourceName.split(' (')[0]))];
  const source = liveSourceNames.length > 0 ? `${liveSourceNames.join(', ')} | Live` : 'No live sources reachable';

  const evidenceLines = findings
    .map((f) => `- ${f.agentName} [${f.sourceName}]: ${f.metric} = ${f.value} (confidence ${f.confidence}%). ${f.rawFindings}`)
    .join('\n');

  const synthesized = await synthesizeWithGroq({ query, region, role, evidenceLines });
  const text = synthesized || buildTemplateAnswer(findings, region);

  return {
    text,
    source,
    agents,
    findings,
    resolvedLocation: { lat: coords.lat, lon: coords.lon, label: region },
    pfzDetails: {
      distance: `at ${region}`,
      bearing: '—',
      sst: tempFinding.value,
      chlorophyll: chlResult.finding.value,
      depth: 'n/a',
      potential: chlResult.pfzPotential,
      coordinates: `${coords.lat.toFixed(2)}° N, ${coords.lon.toFixed(2)}° E`,
    },
  };
}
