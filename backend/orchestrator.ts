import type { AgentFinding, AgentStatus, RoutePoint, LanguageCode } from '../src/types';
import { LANGUAGES } from '../src/data/languages';
import { resolveRegion } from './regions';
import { geocodePlace } from './dataSources/geocoding';
import { planRoute } from './route';
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
  routeData?: {
    origin: string;
    destination: string;
    distance: string;
    estimatedTime: string;
    hazards: string[];
    waypoints: RoutePoint[];
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

async function callGroq(systemPrompt: string, userContent: string, opts: { maxTokens?: number; temperature?: number } = {}): Promise<string | null> {
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
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: opts.temperature ?? 0,
        ...(opts.maxTokens ? { max_tokens: opts.maxTokens, reasoning_effort: 'low' } : {}),
      }),
      signal: AbortSignal.timeout(opts.maxTokens ? 8000 : 10000),
    });

    if (!res.ok) throw new Error(`Groq API responded ${res.status}`);
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch (err) {
    console.warn('Groq call failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

async function synthesizeWithGroq(params: {
  query: string;
  region: string;
  role: string;
  evidenceLines: string;
  preferredLanguage?: LanguageCode;
}): Promise<string | null> {
  const fallbackLabel = params.preferredLanguage
    ? LANGUAGES.find((l) => l.code === params.preferredLanguage)?.label
    : null;

  const systemPrompt = `You are ORCA, a marine intelligence assistant for Indian coastal waters. A user (role: ${params.role}) asked about region "${params.region}". Three specialized agents just gathered LIVE evidence below. Write a 2-4 sentence answer using ONLY the numbers and facts given below — never invent a number that isn't listed. If an agent reports "Unavailable" or low confidence, say so plainly instead of guessing. Do not add a source citation line, one is appended separately.

IMPORTANT — language: detect the language the user's question is written in (English, or any Indian regional language such as Hindi, Tamil, Telugu, Malayalam, Kannada, Bengali, Gujarati, Marathi, or Odia — the question could be in any of these, including transliterated into Latin script, or contain minor transcription noise from voice input). Reply in that SAME language and script the user used. If the language is genuinely ambiguous${
    fallbackLabel ? `, prefer ${fallbackLabel} (the user's saved preference)` : ', default to English'
  }.

Evidence:
${params.evidenceLines}`;

  return callGroq(systemPrompt, params.query, { temperature: 0.4 });
}

// Lets a user ask about any place ("Marina Beach", "Kovalam") in free text,
// in any language, instead of being limited to the fixed region dropdown.
// Returns null if no specific place is mentioned (or Groq is unavailable).
async function extractPlaceName(query: string): Promise<string | null> {
  const systemPrompt = `Extract the core place, city, or beach name mentioned in the user's question about Indian coastal waters — the question may be in English or any Indian regional language. Strip generic descriptor words like "coast", "sea", "waters", "area" unless they're part of the official name (e.g. keep "Marina Beach" as-is, but for "Chennai coast" extract just "Chennai"). Reply with ONLY the place name (transliterated to English/Latin script) and nothing else. If no specific place is mentioned, reply with exactly: NONE`;

  const result = await callGroq(systemPrompt, query, { maxTokens: 200 });
  if (!result || result.toUpperCase() === 'NONE') return null;
  return result;
}

// Detects route-planning questions ("safest route from X to Y", "plan a path
// to the PFZ near Z") and extracts both endpoints, in any language.
async function extractRouteEndpoints(query: string): Promise<{ origin: string; destination: string } | null> {
  const systemPrompt = `The user is asking about Indian coastal waters, possibly in a regional Indian language. Determine if they're asking for a ROUTE, PATH, or SAFE NAVIGATION PLAN between two specific places (a starting point and a destination). If so, reply with ONLY: ORIGIN | DESTINATION (both transliterated to English/Latin script, using real place names — no extra words). If this is not a route-planning question, or only one place is mentioned with no clear start/end, reply with exactly: NONE`;

  const result = await callGroq(systemPrompt, query, { maxTokens: 200 });
  if (!result || result.toUpperCase() === 'NONE' || !result.includes('|')) return null;
  const [origin, destination] = result.split('|').map((s) => s.trim());
  if (!origin || !destination) return null;
  return { origin, destination };
}

function buildTemplateAnswer(findings: AgentFinding[], region: string, unresolvedPlace: string | null): string {
  const [temp, chl, weather] = findings;
  const prefix = unresolvedPlace
    ? `I couldn't locate "${unresolvedPlace}". Showing the nearest available data for ${region} instead. `
    : '';
  return (
    prefix +
    [
      temp.confidence > 0
        ? `Sea surface temperature off ${region} is ${temp.value}.`
        : `Sea surface temperature data is currently unavailable for ${region}.`,
      chl.confidence > 0 ? `Chlorophyll concentration reads ${chl.value}.` : `Chlorophyll data is currently unavailable.`,
      weather.confidence > 0 ? `Marine conditions: ${weather.value}.` : `Weather data is currently unavailable.`,
    ].join(' ')
  );
}

export async function handleChat(params: {
  query: string;
  region: string;
  role: string;
  preferredLanguage?: LanguageCode;
}): Promise<ChatResult> {
  const { query, role, preferredLanguage } = params;

  // A route question resolves both endpoints via geocoding + samples real
  // weather along the path; otherwise fall back to single-place extraction.
  const routeEndpoints = await extractRouteEndpoints(query);
  const routeResult = routeEndpoints ? await planRoute(routeEndpoints.origin, routeEndpoints.destination) : null;

  let coords = resolveRegion(params.region);
  let region = params.region;
  let unresolvedPlace: string | null = null;

  if (routeResult) {
    coords = routeResult.originCoords;
    region = routeResult.origin;
  } else {
    const extractedPlace = await extractPlaceName(query);
    if (extractedPlace) {
      const geocoded = await geocodePlace(extractedPlace);
      if (geocoded) {
        coords = { lat: geocoded.lat, lon: geocoded.lon };
        region = geocoded.displayName;
      } else {
        // Groq found a place name in the question, but the geocoder
        // couldn't locate it — don't silently answer for the unrelated
        // dropdown default as if that's what was asked; tell the model so
        // it can say plainly that the place wasn't found (this previously
        // produced confusing answers like "I only have data for South
        // Kerala Coast" when the user actually asked about somewhere else).
        unresolvedPlace = extractedPlace;
      }
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

  let evidenceLines = findings
    .map((f) => `- ${f.agentName} [${f.sourceName}]: ${f.metric} = ${f.value} (confidence ${f.confidence}%). ${f.rawFindings}`)
    .join('\n');

  if (routeResult) {
    evidenceLines += `\n- Route Planning [live weather sampled along the path]: ${routeResult.distance} from ${routeResult.origin} to ${routeResult.destination}, est. ${routeResult.estimatedTime}. ${
      routeResult.hazards.length > 0 ? `Hazards found: ${routeResult.hazards.join('; ')}.` : 'No hazardous segments found along the route.'
    }`;
  }

  if (unresolvedPlace) {
    evidenceLines += `\n- Location lookup: the user asked about "${unresolvedPlace}", but this place could not be found. The numbers below are for the fallback region "${region}" instead, NOT for "${unresolvedPlace}". You MUST clearly tell the user "${unresolvedPlace}" could not be located, and that you're showing "${region}" instead as the nearest available data — do not present the fallback numbers as if they answer the original question.`;
  }

  const synthesized = await synthesizeWithGroq({ query, region, role, evidenceLines, preferredLanguage });
  const text = synthesized || buildTemplateAnswer(findings, region, unresolvedPlace);

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
    routeData: routeResult
      ? {
          origin: routeResult.origin,
          destination: routeResult.destination,
          distance: routeResult.distance,
          estimatedTime: routeResult.estimatedTime,
          hazards: routeResult.hazards,
          waypoints: routeResult.waypoints,
        }
      : undefined,
  };
}
