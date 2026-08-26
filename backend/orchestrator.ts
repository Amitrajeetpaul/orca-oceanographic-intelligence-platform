import type { AgentFinding, AgentStatus, RoutePoint, LanguageCode } from '../src/types';
import { LANGUAGES } from '../src/data/languages';
import { resolveRegion } from './regions';
import { geocodePlace } from './dataSources/geocoding';
import { checkGeofence } from './dataSources/eez';
import { findNearbyCyclone } from './dataSources/gdacs';
import { planRoute, planRouteToNearestPfz } from './route';
import { runTemperatureAgent } from './agents/temperatureAgent';
import { runChlorophyllAgent } from './agents/chlorophyllAgent';
import { runWeatherAgent, runForecastAgent } from './agents/weatherAgent';
import { runTideAgent } from './agents/tideAgent';
import { scanAllRegions } from './regionScan';

export interface ConversationTurn {
  role: 'user' | 'assistant';
  text: string;
}

// How many prior turns to carry into each Groq call — enough for real
// follow-up continuity ("what about tomorrow?", "and near Kochi?") without
// blowing up the prompt budget of a low-reasoning-effort call.
const MAX_HISTORY_TURNS = 8;

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
  geofenceWarning?: {
    severity: 'inside' | 'near';
    territory: string;
    message: string;
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

async function callGroq(
  systemPrompt: string,
  userContent: string,
  opts: { maxTokens?: number; temperature?: number; history?: ConversationTurn[] } = {}
): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const historyMessages = (opts.history ?? [])
    .slice(-MAX_HISTORY_TURNS)
    .map((t) => ({ role: t.role, content: t.text }));

  const body = JSON.stringify({
    model: GROQ_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: userContent },
    ],
    temperature: opts.temperature ?? 0,
    ...(opts.maxTokens ? { max_tokens: opts.maxTokens, reasoning_effort: 'low' } : {}),
  });

  // One retry on rate-limit (429) — a short burst of messages can briefly
  // exceed Groq's per-minute token budget even with capped output; without
  // this, every extraction/synthesis call in that window would silently
  // fail and fall back to a generic answer instead of the real one.
  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body,
        signal: AbortSignal.timeout(opts.maxTokens ? 8000 : 10000),
      });

      if (res.status === 429 && attempt === 0) {
        const retryAfterMs = Math.min(parseFloat(res.headers.get('retry-after') || '1') * 1000, 3000);
        await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
        continue;
      }

      if (!res.ok) throw new Error(`Groq API responded ${res.status}`);
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content?.trim();
      return text || null;
    } catch (err) {
      console.warn('Groq call failed:', err instanceof Error ? err.message : err);
      return null;
    }
  }
  return null;
}

async function synthesizeWithGroq(params: {
  query: string;
  region: string;
  role: string;
  evidenceLines: string;
  preferredLanguage?: LanguageCode;
  history?: ConversationTurn[];
}): Promise<string | null> {
  const fallbackLabel = params.preferredLanguage
    ? LANGUAGES.find((l) => l.code === params.preferredLanguage)?.label
    : null;

  const systemPrompt = `You are ORCA, a marine intelligence assistant for Indian coastal waters. A user (role: ${params.role}) asked about region "${params.region}". Three specialized agents just gathered LIVE evidence below. Write a 2-4 sentence answer using ONLY the numbers and facts given below — never invent a number that isn't listed. If an agent reports "Unavailable" or low confidence, say so plainly instead of guessing. Do not add a source citation line, one is appended separately.

IMPORTANT — scope: if the user's question is NOT actually about ocean, coastal, weather, or fishing conditions (e.g. general trivia, unrelated topics), do NOT answer it from your own general knowledge even if you know the answer. Instead, briefly and politely say ORCA is a marine intelligence assistant for Indian coastal waters and can't help with that, and suggest the kind of question it can answer instead. Ignore the evidence block in that case.

IMPORTANT — language: detect the language the user's question is written in (English, or any Indian regional language such as Hindi, Tamil, Telugu, Malayalam, Kannada, Bengali, Gujarati, Marathi, or Odia — the question could be in any of these, including transliterated into Latin script, or contain minor transcription noise from voice input). Reply in that SAME language and script the user used. If the language is genuinely ambiguous${
    fallbackLabel ? `, prefer ${fallbackLabel} (the user's saved preference)` : ', default to English'
  }.

IMPORTANT — conversation memory: prior turns are provided as message history for CONTEXT ONLY — use them to resolve references like "there", "that place", or "again", and to avoid repeating yourself verbatim. Never reuse a number or fact from an earlier turn in this answer — every number you state must come from the fresh Evidence block below, since conditions may have changed since the last message.

Evidence:
${params.evidenceLines}`;

  // maxTokens must be set here — without it, callGroq omits reasoning_effort
  // entirely, and this reasoning model then burns an uncapped number of
  // hidden "thinking" tokens on what should be a short 2-4 sentence answer.
  // That was blowing through Groq's per-minute token budget in a handful of
  // messages and silently degrading every subsequent answer to a generic
  // fallback (confirmed via Railway logs: repeated 429s after a short burst).
  return callGroq(systemPrompt, params.query, { temperature: 0.4, history: params.history, maxTokens: 500 });
}

// Lets a user ask about any place ("Marina Beach", "Kovalam") in free text,
// in any language, instead of being limited to the fixed region dropdown.
// Given conversation history, also resolves follow-ups that don't name a
// place at all ("what about tomorrow?", "is it safe there?") by inferring
// the place is still whatever was last discussed. Returns null only if no
// place has ever come up (or Groq is unavailable).
async function extractPlaceName(query: string, history: ConversationTurn[] = []): Promise<string | null> {
  const systemPrompt = `Extract the core place, city, or beach name being discussed in the user's LATEST question about Indian coastal waters — the question may be in English or any Indian regional language. Strip generic descriptor words like "coast", "sea", "waters", "area" unless they're part of the official name (e.g. keep "Marina Beach" as-is, but for "Chennai coast" extract just "Chennai"). If the latest question doesn't name a place but is a natural follow-up to the conversation (e.g. "what about tomorrow?", "is it safe there?", "and the wind?"), infer the place from the conversation history instead. Reply with ONLY the place name (transliterated to English/Latin script) and nothing else. If no place has been mentioned anywhere in the conversation, reply with exactly: NONE`;

  const result = await callGroq(systemPrompt, query, { maxTokens: 200, history });
  if (!result || result.toUpperCase() === 'NONE') return null;
  return result;
}

// Detects route-planning questions ("safest route from X to Y", "plan a path
// to the PFZ near Z") and extracts both endpoints, in any language.
async function extractRouteEndpoints(
  query: string,
  history: ConversationTurn[] = []
): Promise<{ origin: string; destination: string } | null> {
  const systemPrompt = `The user is asking about Indian coastal waters, possibly in a regional Indian language. Determine if their LATEST message is asking for a ROUTE, PATH, or SAFE NAVIGATION PLAN between a starting point and a destination — use the conversation history to fill in an endpoint the latest message leaves implicit (e.g. "and back?" after a route was just discussed). The destination is often a real named place (a port, beach, town), but if the user asks for a route to "the nearest/best fishing zone", "a good PFZ", or similar — NOT a named place — reply with ORIGIN | NEAREST_PFZ instead (using the literal text NEAREST_PFZ for the destination). If no starting point is named at all (e.g. "route to the nearest fishing zone" with no origin given), use the literal text CURRENT_LOCATION for the origin. Reply with ONLY: ORIGIN | DESTINATION (both transliterated to English/Latin script — no extra words). If this is clearly not a route-planning question, reply with exactly: NONE`;

  const result = await callGroq(systemPrompt, query, { maxTokens: 200, history });
  if (!result || result.toUpperCase() === 'NONE' || !result.includes('|')) return null;
  const [origin, destination] = result.split('|').map((s) => s.trim());
  if (!origin || !destination) return null;
  return { origin, destination };
}

// Detects broad, coast-wide survey questions ("which regions look good for
// fishing?", "which zones should I avoid?") as distinct from a question
// about one specific named place — these need a scan across every known
// region instead of the single-location agent pipeline.
async function extractMultiRegionIntent(query: string, history: ConversationTurn[] = []): Promise<'favorable' | 'avoid' | null> {
  const systemPrompt = `The user is asking about Indian coastal waters, possibly in a regional Indian language. Determine if their LATEST message is asking to SURVEY OR COMPARE conditions across MULTIPLE regions/zones spanning the coast — NOT about one specific named place. Two kinds: (1) asking which regions currently look FAVORABLE for fishing (high chlorophyll, good sea temperature, productive conditions) — reply exactly: FAVORABLE. (2) asking which regions/zones should be AVOIDED right now due to hazardous conditions or maritime boundary restrictions — reply exactly: AVOID. If the question names one specific place, or isn't this kind of broad multi-region survey, reply exactly: NONE`;

  const result = await callGroq(systemPrompt, query, { maxTokens: 50, history });
  if (!result) return null;
  const trimmed = result.trim().toUpperCase();
  if (trimmed === 'FAVORABLE') return 'favorable';
  if (trimmed === 'AVOID') return 'avoid';
  return null;
}

const POTENTIAL_RANK: Record<'High' | 'Moderate' | 'Low', number> = { High: 2, Moderate: 1, Low: 0 };

// A separate path from the single-location pipeline — scans every known
// region live (regionScan.ts) and hands the model a coast-wide summary
// instead of one place's evidence. Directly answers two PS example
// queries: "which regions show high chlorophyll + favourable SST" and
// "which zones should be avoided due to hazardous conditions or geofencing".
async function handleMultiRegionQuery(params: {
  mode: 'favorable' | 'avoid';
  query: string;
  role: string;
  preferredLanguage?: LanguageCode;
  history: ConversationTurn[];
}): Promise<ChatResult> {
  const { mode, query, role, preferredLanguage, history } = params;
  const scan = await scanAllRegions();

  let evidenceLines: string;
  let summaryValue: string;

  if (mode === 'favorable') {
    const ranked = [...scan].sort((a, b) => POTENTIAL_RANK[b.pfzPotential] - POTENTIAL_RANK[a.pfzPotential]);
    evidenceLines = ranked
      .map(
        (r) =>
          `- ${r.region}: SST ${r.sst !== null ? r.sst.toFixed(1) + '°C' : 'unavailable'}, Chlorophyll ${
            r.chl !== null ? r.chl.toFixed(2) + ' mg/m³' : 'unavailable'
          } — ${r.pfzPotential} potential`
      )
      .join('\n');
    const highCount = ranked.filter((r) => r.pfzPotential === 'High').length;
    summaryValue = `${highCount} region${highCount === 1 ? '' : 's'} with High potential`;
  } else {
    const toAvoid = scan.filter((r) => r.hazardous || r.nearForeignWaters);
    evidenceLines =
      toAvoid.length > 0
        ? `${toAvoid.length} of ${scan.length} monitored regions are currently flagged — the other ${
            scan.length - toAvoid.length
          } are within normal safe conditions and NOT listed below:\n` +
          toAvoid
            .map((r) => {
              const reasons = [
                r.hazardous ? `hazardous conditions (${r.hazardReason})` : null,
                r.nearForeignWaters ? `near/inside ${r.foreignTerritory} waters` : null,
              ].filter(Boolean);
              return `- ${r.region}: ${reasons.join('; ')}`;
            })
            .join('\n')
        : `All ${scan.length} monitored regions are currently within normal safe conditions — none need to be avoided right now.`;
    summaryValue = `${toAvoid.length} region${toAvoid.length === 1 ? '' : 's'} flagged`;
  }

  const summaryFinding: AgentFinding = {
    agentName: 'Regional Survey Agent',
    type: mode === 'favorable' ? 'chlorophyll' : 'weather',
    sourceName: 'INCOIS live SST/chlorophyll grid, Open-Meteo, VLIZ Marine Regions',
    sourceUrl: 'https://incois.gov.in',
    timestamp: new Date().toISOString(),
    confidence: 90,
    metric: mode === 'favorable' ? 'Coast-wide Fishing Potential Survey' : 'Coast-wide Hazard/Boundary Survey',
    value: summaryValue,
    rawFindings: evidenceLines,
    status: 'completed',
  };

  const evidenceBlock = `- Regional Survey Agent [live scan across ${scan.length} monitored regions — read the numbers below carefully, do not assume every scanned region matches the description]:\n${evidenceLines}`;
  const synthesized = await synthesizeWithGroq({
    query,
    region: 'all monitored regions',
    role,
    evidenceLines: evidenceBlock,
    preferredLanguage,
    history,
  });
  const text = synthesized || evidenceLines;

  const best = mode === 'favorable' ? [...scan].sort((a, b) => POTENTIAL_RANK[b.pfzPotential] - POTENTIAL_RANK[a.pfzPotential])[0] : scan[0];

  return {
    text,
    source: 'INCOIS, Open-Meteo, VLIZ Marine Regions | Live coast-wide scan',
    agents: [toAgentStatus(summaryFinding)],
    findings: [summaryFinding],
    resolvedLocation: { lat: 15.0, lon: 78.0, label: 'All monitored regions' },
    pfzDetails: {
      distance: 'coast-wide',
      bearing: '—',
      sst: best?.sst !== null && best?.sst !== undefined ? `${best.sst.toFixed(1)}°C` : 'n/a',
      chlorophyll: best?.chl !== null && best?.chl !== undefined ? `${best.chl.toFixed(2)} mg/m³` : 'n/a',
      depth: 'n/a',
      potential: best?.pfzPotential ?? 'Low',
    },
  };
}

export type TemporalIntent = { daysAhead: number; dateLabel: string } | 'too_far' | null;

// Detects genuinely future-dated questions ("what about tomorrow?", "safe
// to go out Friday?") so the orchestrator can fetch a real forecast instead
// of quietly answering with today's live reading as if it addressed the
// question. Returns null for "now"/no clear future reference.
async function extractTemporalIntent(query: string, history: ConversationTurn[] = []): Promise<TemporalIntent> {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const todayDow = today.toLocaleDateString('en-US', { weekday: 'long' });

  const systemPrompt = `Today is ${todayDow}, ${todayStr}. The user is asking about Indian coastal waters, possibly in a regional Indian language, possibly with voice-transcription noise. Determine if their LATEST message (using conversation history to resolve follow-ups like "what about tomorrow?") is asking about conditions on a FUTURE day, rather than right now/today/current conditions. If it's about now/today or has no clear future reference, reply with exactly: NOW. If it names a future day within the next 7 days (tomorrow, a weekday name, "in 3 days", "this weekend"), reply with ONLY: N|label — where N is an integer 1-7 (days from today) and label is a short human-readable label such as "tomorrow" or "Friday". If it asks about something more than 7 days away, reply with exactly: TOO_FAR`;

  const result = await callGroq(systemPrompt, query, { maxTokens: 100, history });
  if (!result) return null;
  const trimmed = result.trim().toUpperCase();
  if (trimmed === 'NOW') return null;
  if (trimmed === 'TOO_FAR') return 'too_far';

  const [nStr, label] = result.trim().split('|').map((s) => s.trim());
  const n = parseInt(nStr, 10);
  if (Number.isNaN(n) || n < 1 || n > 7) return null;
  return { daysAhead: n, dateLabel: label || `${n} day(s) from now` };
}

function buildTemplateAnswer(findings: AgentFinding[], region: string, unresolvedPlace: string | null): string {
  const [temp, chl, weather, tide] = findings;
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
      tide && tide.confidence > 0 ? `Tide: ${tide.value}.` : '',
    ]
      .filter(Boolean)
      .join(' ')
  );
}

export async function handleChat(params: {
  query: string;
  region: string;
  role: string;
  preferredLanguage?: LanguageCode;
  history?: ConversationTurn[];
}): Promise<ChatResult> {
  const { query, role, preferredLanguage, history = [] } = params;

  // Run in parallel with route extraction — a coast-wide survey question
  // ("which regions look good?") takes a completely different path from
  // the rest of this function, so branch out immediately if detected.
  const [routeEndpoints, multiRegionMode] = await Promise.all([extractRouteEndpoints(query, history), extractMultiRegionIntent(query, history)]);

  if (multiRegionMode) {
    return handleMultiRegionQuery({ mode: multiRegionMode, query, role, preferredLanguage, history });
  }

  let coords = resolveRegion(params.region);
  let region = params.region;
  let unresolvedPlace: string | null = null;
  let temporalIntent: TemporalIntent = null;

  let routeResult = null as Awaited<ReturnType<typeof planRoute>>;
  if (routeEndpoints) {
    const originArg =
      routeEndpoints.origin.toUpperCase() === 'CURRENT_LOCATION' ? { displayName: region, lat: coords.lat, lon: coords.lon } : routeEndpoints.origin;
    routeResult =
      routeEndpoints.destination.toUpperCase() === 'NEAREST_PFZ'
        ? await planRouteToNearestPfz(originArg)
        : await planRoute(originArg, routeEndpoints.destination);
  }

  if (routeResult) {
    coords = routeResult.originCoords;
    region = routeResult.origin;
  } else {
    // Independent Groq calls — run in parallel rather than adding another
    // sequential round-trip to every request.
    const [extractedPlace, intent] = await Promise.all([
      extractPlaceName(query, history),
      extractTemporalIntent(query, history),
    ]);
    temporalIntent = intent;

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

  const weatherPromise =
    temporalIntent && typeof temporalIntent === 'object'
      ? runForecastAgent(coords.lat, coords.lon, temporalIntent.daysAhead, temporalIntent.dateLabel)
      : runWeatherAgent(coords.lat, coords.lon);

  const [tempFinding, chlResult, weatherFinding, tideFinding, geofence, nearbyCyclone] = await Promise.all([
    runTemperatureAgent(coords.lat, coords.lon),
    runChlorophyllAgent(coords.lat, coords.lon),
    weatherPromise,
    runTideAgent(coords.lat, coords.lon),
    routeResult ? Promise.resolve(null) : checkGeofence(coords.lat, coords.lon),
    findNearbyCyclone(coords.lat, coords.lon),
  ]);

  const findings: AgentFinding[] = [tempFinding, chlResult.finding, weatherFinding, tideFinding];
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

  if (temporalIntent && typeof temporalIntent === 'object') {
    evidenceLines += `\n- Temporal note: the user asked about ${temporalIntent.dateLabel}, a FUTURE day. The Marine Weather & Hazards Agent above is a forecast for that day, not today. The Temperature and Chlorophyll agents above still only reflect TODAY's live reading — there is no forecast source for sea temperature or chlorophyll. You MUST make this distinction clear: state the forecast wind/wave for ${temporalIntent.dateLabel}, and if you mention SST or chlorophyll, explicitly note it's today's reading since no forecast exists for it.`;
  } else if (temporalIntent === 'too_far') {
    evidenceLines += `\n- Temporal note: the user asked about a day more than 7 days from now. No forecast data is available that far out. You MUST tell the user this plainly instead of guessing or using today's data as if it answers the question.`;
  }

  let geofenceWarning: ChatResult['geofenceWarning'];
  if (geofence?.inForeignWaters && geofence.currentTerritory) {
    geofenceWarning = {
      severity: 'inside',
      territory: geofence.currentTerritory,
      message: `This location falls within ${geofence.currentTerritory}'s Exclusive Economic Zone, not India's. Entering foreign waters without authorization carries real legal and safety risk.`,
    };
    evidenceLines += `\n- Maritime Boundary [VLIZ Marine Regions EEZ dataset]: This location is INSIDE ${geofence.currentTerritory}'s Exclusive Economic Zone, not India's. This is a real legal/safety hazard — you MUST warn the user clearly and prominently, before any other information.`;
  } else if (geofence?.nearForeignBoundary && geofence.nearbyTerritory) {
    geofenceWarning = {
      severity: 'near',
      territory: geofence.nearbyTerritory,
      message: `This location is within roughly 15nm of ${geofence.nearbyTerritory}'s Exclusive Economic Zone. Exercise caution navigating further in that direction.`,
    };
    evidenceLines += `\n- Maritime Boundary [VLIZ Marine Regions EEZ dataset]: This location is within roughly 15 nautical miles of ${geofence.nearbyTerritory}'s Exclusive Economic Zone boundary. Mention this caution to the user.`;
  }

  // Always stated explicitly, even when clear — "no cyclone found in
  // evidence" must never be misread as the topic being unavailable/out of
  // scope for a direct "any cyclone alerts?" question.
  evidenceLines += nearbyCyclone
    ? `\n- Cyclone Alert [GDACS, EU JRC/UN OCHA via NOAA/JTWC]: Tropical Cyclone ${nearbyCyclone.cyclone.name} is active roughly ${Math.round(
        nearbyCyclone.distanceKm
      )}km away (${nearbyCyclone.cyclone.severityText}, GDACS alert level: ${nearbyCyclone.cyclone.alertLevel}). This is a real, current hazard — you MUST warn the user about this clearly.`
    : `\n- Cyclone Alert [GDACS, EU JRC/UN OCHA via NOAA/JTWC]: No active tropical cyclone within 500km of this location right now.`;

  if (unresolvedPlace) {
    evidenceLines += `\n- Location lookup: the user asked about "${unresolvedPlace}", but this place could not be found. The numbers below are for the fallback region "${region}" instead, NOT for "${unresolvedPlace}". You MUST clearly tell the user "${unresolvedPlace}" could not be located, and that you're showing "${region}" instead as the nearest available data — do not present the fallback numbers as if they answer the original question.`;
  }

  const synthesized = await synthesizeWithGroq({ query, region, role, evidenceLines, preferredLanguage, history });
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
    geofenceWarning,
  };
}
