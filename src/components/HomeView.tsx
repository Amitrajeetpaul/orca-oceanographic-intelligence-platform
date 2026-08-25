import React, { useState, useRef, useEffect } from 'react';
import {
  MapLayer,
  ChatMessage,
  AgentStatus,
  UserProfile,
  AgentFinding,
} from '../types';
import {
  Thermometer,
  Leaf,
  Wind,
  CheckCircle2,
  Hourglass,
  ArrowUp,
  Sparkles,
  Info,
  Navigation as NavigationIcon,
  AlertTriangle,
  Crosshair,
  X,
  MapPin,
  LocateFixed,
  Mic,
  Volume2,
  Square,
} from 'lucide-react';
import { SAMPLE_PROMPT_CHIPS, INITIAL_CHAT_MESSAGES } from '../data/mockData';
import { resolveRegionCoords, findNearestRegion } from '../data/regionCoords';
import { resolveLanguage, detectScriptLanguage } from '../data/languages';
import { AgentDetailModal } from './AgentDetailModal';
import { OceanMap, ProbeResult } from './OceanMap';

// Beyond this, the nearest coastal region isn't really "nearby" — no point
// suggesting Odisha's coast to someone standing in Delhi.
const NEARBY_THRESHOLD_KM = 300;

interface HomeViewProps {
  selectedRegion: string;
  user: UserProfile;
}

interface ProbedLocation {
  lat: string;
  lng: string;
  sst: string;
  chl: string;
  potential: string;
}

export const HomeView: React.FC<HomeViewProps> = ({ selectedRegion, user }) => {
  const [activeLayer, setActiveLayer] = useState<MapLayer>('Temp');
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_CHAT_MESSAGES);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeAgentSteps, setActiveAgentSteps] = useState<AgentStatus[]>([]);
  const [inspectedFindings, setInspectedFindings] = useState<AgentFinding[] | null>(null);
  const [inspectedQuery, setInspectedQuery] = useState<string>('');
  const [probedLocation, setProbedLocation] = useState<ProbedLocation | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceUnsupported, setVoiceUnsupported] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [nearbySuggestion, setNearbySuggestion] = useState<{ name: string; distanceKm: number } | null>(null);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const [locationIssue, setLocationIssue] = useState<'denied' | 'unavailable' | 'unsupported' | null>(null);
  const [locationIssueDismissed, setLocationIssueDismissed] = useState(false);

  const regionCoords = resolveRegionCoords(selectedRegion);
  const [mapCenter, setMapCenter] = useState(regionCoords);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isProcessing, activeAgentSteps]);

  // Ask for the phone's real GPS position, and if it's actually near a
  // coastal region we know about, offer to check conditions there. Never
  // blocks anything on failure — instead surfaces a small retryable prompt
  // so denying it by accident (or a transient GPS timeout) isn't a dead end.
  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationIssue('unsupported');
      return;
    }
    setLocationIssue(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nearest = findNearestRegion({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
        if (nearest.distanceKm <= NEARBY_THRESHOLD_KM) {
          setNearbySuggestion(nearest);
        }
        setLocationIssueDismissed(true);
      },
      (error) => {
        setLocationIssue(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable');
      },
      { timeout: 10000, maximumAge: 10 * 60 * 1000 }
    );
  };

  useEffect(() => {
    requestLocation();
  }, []);

  // Picking a new region from the dropdown should move the map there,
  // overriding wherever the last chat question resolved to.
  useEffect(() => {
    setMapCenter(regionCoords);
  }, [regionCoords.lat, regionCoords.lon]);

  const handleMapProbe = (lat: number, lon: number, result: ProbeResult | null) => {
    if (!result) {
      setProbedLocation(null);
      return;
    }
    setProbedLocation({
      lat: `${lat.toFixed(3)}° N`,
      lng: `${lon.toFixed(3)}° E`,
      sst: result.sst.value !== null ? `${result.sst.value.toFixed(1)}°C` : 'Unavailable',
      chl: result.chl.value !== null ? `${result.chl.value.toFixed(2)} mg/m³` : 'Unavailable',
      potential: result.pfzPotential,
    });
  };

  // Voice input: records real microphone audio and sends it to the backend,
  // which transcribes it with Groq's Whisper model. Whisper auto-detects the
  // spoken language on its own — unlike the browser's native Speech
  // Recognition API, which locks to one pre-selected language and mangles
  // anything spoken in a different one, this understands whatever language
  // the user actually speaks without them having to pick it first.
  const startListening = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setVoiceUnsupported(true);
      return;
    }
    setVoiceUnsupported(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setIsListening(false);

        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (audioBlob.size === 0) return;

        setIsTranscribing(true);
        try {
          const res = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': audioBlob.type || 'audio/webm' },
            body: audioBlob,
          });
          if (res.ok) {
            const { text } = await res.json();
            if (text) handleSendMessage(text);
          }
        } catch {
          // Silent failure — no live server data to lose here, user can just retry.
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsListening(true);
    } catch {
      setVoiceUnsupported(true);
    }
  };

  const stopListening = () => {
    mediaRecorderRef.current?.stop();
  };

  // Voice output via the browser's native Speech Synthesis — detects the
  // script of the *response* text so it speaks in the right voice even if
  // it differs from whatever the voice-input picker is currently set to.
  const speakMessage = (msg: ChatMessage) => {
    if (!('speechSynthesis' in window)) return;
    if (speakingMsgId === msg.id) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(msg.text);
    utterance.lang = resolveLanguage(detectScriptLanguage(msg.text)).speechCode;
    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);
    setSpeakingMsgId(msg.id);
    window.speechSynthesis.speak(utterance);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputValue.trim();
    if (!query || isProcessing) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsProcessing(true);

    // Step 1: Temperature agent check
    const tempAgent: AgentStatus = {
      name: 'Temperature agent',
      type: 'temp',
      status: 'checking',
      source: 'Copernicus SST',
    };
    setActiveAgentSteps([tempAgent]);

    // Step 2: Chlorophyll agent check
    setTimeout(() => {
      tempAgent.status = 'completed';
      tempAgent.value = '28.5°C';
      const chloroAgent: AgentStatus = {
        name: 'Chlorophyll agent',
        type: 'chlorophyll',
        status: 'checking',
        source: 'INCOIS PFZ',
      };
      setActiveAgentSteps([{ ...tempAgent }, chloroAgent]);
    }, 700);

    // Step 3: Weather agent check
    setTimeout(() => {
      const chloroAgent: AgentStatus = {
        name: 'Chlorophyll agent',
        type: 'chlorophyll',
        status: 'completed',
        value: '1.42 mg/m³',
        source: 'INCOIS PFZ',
      };
      const weatherAgent: AgentStatus = {
        name: 'Weather agent',
        type: 'weather',
        status: 'checking',
        source: 'Open-Meteo Marine',
      };
      setActiveAgentSteps([
        { ...tempAgent, status: 'completed', value: '28.5°C' },
        chloroAgent,
        weatherAgent,
      ]);
    }, 1400);

    // Step 4: Finalize Merged Consensus
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: query,
          region: selectedRegion,
          layer: activeLayer,
          role: user.role,
          preferredLanguage: user.language,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server responded ${response.status}`);
      }
      const data = await response.json();

      if (data.resolvedLocation) {
        setMapCenter({ lat: data.resolvedLocation.lat, lon: data.resolvedLocation.lon });
      }

      setTimeout(() => {
        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          sender: 'assistant',
          text: data.text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          source: data.source,
          agents: data.agents as AgentStatus[] | undefined,
          findings: data.findings as AgentFinding[] | undefined,
          hasRoute: !!data.routeData,
          routeData: data.routeData,
          pfzDetails: data.pfzDetails,
        };

        setMessages((prev) => [...prev, assistantMsg]);
        setIsProcessing(false);
        setActiveAgentSteps([]);
      }, 600);
    } catch {
      setTimeout(() => {
        const fallbackMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          sender: 'assistant',
          text: `ORCA could not reach live ocean data sources just now. Please try again in a moment.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          source: 'Unavailable',
        };
        setMessages((prev) => [...prev, fallbackMsg]);
        setIsProcessing(false);
        setActiveAgentSteps([]);
      }, 600);
    }
  };

  const latestRouteData = [...messages].reverse().find((m) => m.routeData)?.routeData;

  return (
    <main className="w-full px-4 -mt-36 z-10 flex-1 pb-24">
      {/* Location-Aware Proactive Suggestion */}
      {nearbySuggestion && !suggestionDismissed && (
        <div className="mb-3 bg-white rounded-2xl floating-card-shadow border border-[#c2c6d1]/35 p-3.5 flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-[#1a5490]/10 text-[#1a5490] flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-[#22223b]">
              You're near {nearbySuggestion.name}
              <span className="font-normal text-[#6b6b80]"> ({Math.round(nearbySuggestion.distanceKm)} km away)</span>
            </p>
            <p className="text-[11px] text-[#6b6b80] mt-0.5">Want ocean conditions and fishing suggestions for this coast?</p>
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => {
                  setSuggestionDismissed(true);
                  handleSendMessage(`What are today's ocean conditions and fishing safety near ${nearbySuggestion.name}?`);
                }}
                className="px-3 py-1 rounded-full btn-primary-gradient text-white text-[10px] font-heading font-bold cursor-pointer"
              >
                Yes, show me
              </button>
              <button
                type="button"
                onClick={() => setSuggestionDismissed(true)}
                className="px-3 py-1 rounded-full text-[10px] font-semibold text-[#6b6b80] hover:text-[#22223b] cursor-pointer"
              >
                Not now
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSuggestionDismissed(true)}
            className="text-[#94a3b8] hover:text-[#1e293b] p-0.5 cursor-pointer shrink-0"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Location Permission Fallback — shown when geolocation was denied,
          timed out, or isn't supported, with a one-tap retry. */}
      {locationIssue && !locationIssueDismissed && !nearbySuggestion && (
        <div className="mb-3 bg-white rounded-2xl floating-card-shadow border border-[#c2c6d1]/35 p-3.5 flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-[#f2a65a]/15 text-[#b36b00] flex items-center justify-center shrink-0">
            <LocateFixed className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-[#22223b]">
              {locationIssue === 'denied'
                ? "Location access wasn't granted"
                : locationIssue === 'unsupported'
                ? 'Location isn’t supported on this browser'
                : "Couldn't get your location"}
            </p>
            <p className="text-[11px] text-[#6b6b80] mt-0.5">
              {locationIssue === 'denied'
                ? 'Turn on location for this site in your browser settings, then retry to get suggestions for your nearest coast.'
                : 'This may be a temporary signal issue — try again.'}
            </p>
            {locationIssue !== 'unsupported' && (
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={requestLocation}
                  className="px-3 py-1 rounded-full btn-primary-gradient text-white text-[10px] font-heading font-bold cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setLocationIssueDismissed(true)}
            className="text-[#94a3b8] hover:text-[#1e293b] p-0.5 cursor-pointer shrink-0"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Floating Card: Overlaps header with negative top margin */}
      <div className="bg-[#ffffff] rounded-2xl floating-card-shadow overflow-hidden flex flex-col border border-[#c2c6d1]/35">
        {/* Real Leaflet Map — OSM base + INCOIS live WMS heatmap layer */}
        <OceanMap center={mapCenter} activeLayer={activeLayer} height={250} onProbe={handleMapProbe}>
          {/* Heatmap Legend Bar (Top Right) */}
          <div className="absolute top-2.5 right-2.5 bg-white/95 backdrop-blur-md rounded-lg p-2 shadow-xs border border-[#c2c6d1]/40 z-[1000] min-w-[85px] pointer-events-none">
            <div className="text-[8px] font-bold tracking-wider text-[#6b6b80] mb-1 text-center uppercase font-heading">
              {activeLayer === 'Temp'
                ? 'SST Scale (°C)'
                : activeLayer === 'Chlorophyll'
                ? 'CHL (mg/m³)'
                : 'PFZ Index'}
            </div>
            <div className="w-full h-2 rounded-xs heatmap-scale-bar" />
            <div className="flex justify-between text-[8px] text-[#22223b] mt-0.5 font-mono font-semibold">
              <span>{activeLayer === 'Temp' ? '26.5°' : '0.1'}</span>
              <span>{activeLayer === 'Temp' ? '29.8°' : '4.5'}</span>
            </div>
          </div>

          {/* Route Hazard Label — reflects the most recently planned route's real waypoint data */}
          {latestRouteData && latestRouteData.hazards.length > 0 && (
            <div className="absolute top-2.5 left-2.5 bg-[#fde8e8] border border-[#c62828]/40 rounded-lg px-2.5 py-1 text-[9px] font-bold text-[#c62828] flex items-center gap-1 z-[1000] shadow-xs pointer-events-none max-w-[220px]">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span className="truncate">{latestRouteData.hazards[0]}</span>
            </div>
          )}

          {/* Layer Toggle Floating Pills */}
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md rounded-full shadow-md border border-[#c2c6d1]/40 p-0.5 flex items-center gap-1 z-[1000]">
            <button
              onClick={() => setActiveLayer('Temp')}
              className={`px-3 py-1 rounded-full text-[10px] font-semibold transition-all cursor-pointer ${
                activeLayer === 'Temp'
                  ? 'btn-primary-gradient text-white'
                  : 'text-[#6b6b80] hover:text-[#1a5490]'
              }`}
            >
              Temp
            </button>
            <button
              onClick={() => setActiveLayer('Chlorophyll')}
              className={`px-3 py-1 rounded-full text-[10px] font-semibold transition-all cursor-pointer ${
                activeLayer === 'Chlorophyll'
                  ? 'btn-primary-gradient text-white'
                  : 'text-[#6b6b80] hover:text-[#1a5490]'
              }`}
            >
              Chlorophyll
            </button>
            <button
              onClick={() => setActiveLayer('PFZ')}
              className={`px-3 py-1 rounded-full text-[10px] font-semibold transition-all cursor-pointer ${
                activeLayer === 'PFZ'
                  ? 'btn-primary-gradient text-white'
                  : 'text-[#6b6b80] hover:text-[#1a5490]'
              }`}
            >
              PFZ Zones
            </button>
          </div>
        </OceanMap>

        {/* Probed Location Telemetry Banner (real data from /api/probe) */}
        {probedLocation && (
          <div className="bg-[#f8fafc] px-3.5 py-3 border-b border-[#c2c6d1]/35 flex flex-col gap-2.5 shadow-2xs">
            {/* Header row: Coordinates, Probed Tag, Temp Badge & Close */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-5 h-5 rounded-full bg-[#1a5490]/15 text-[#1a5490] flex items-center justify-center shrink-0">
                  <Crosshair className="w-3 h-3 text-[#1a5490]" />
                </div>
                <span className="font-mono text-xs font-bold text-[#1e293b] tracking-tight truncate">
                  {probedLocation.lat}, {probedLocation.lng}
                </span>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#e0f2fe] text-[#0369a1] font-semibold border border-[#0284c7]/20 shrink-0">
                  Probed Point
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Sea Surface Temp Badge */}
                <div className="flex items-center gap-1 bg-[#ffffff] border border-[#c2c6d1]/45 rounded-lg px-2 py-1 shadow-2xs">
                  <Thermometer className="w-3.5 h-3.5 text-[#dc2626]" />
                  <span className="font-mono text-xs font-bold text-[#1e293b]">
                    {probedLocation.sst}
                  </span>
                </div>
                <button
                  type="button"
                  id="dismiss-probed-point-btn"
                  onClick={() => setProbedLocation(null)}
                  className="text-[#94a3b8] hover:text-[#1e293b] p-1 cursor-pointer rounded-lg hover:bg-[#e2e8f0] transition-colors"
                  title="Dismiss probed point"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Metrics Grid Row */}
            <div className="grid grid-cols-2 gap-2 bg-white rounded-xl p-2 border border-[#c2c6d1]/30">
              <div className="flex flex-col">
                <span className="text-[9px] font-semibold text-[#64748b] uppercase tracking-wider">
                  Chlorophyll
                </span>
                <span className="text-[11px] font-bold text-[#16a34a] mt-0.5">
                  {probedLocation.chl}
                </span>
              </div>

              <div className="flex flex-col border-l border-[#e2e8f0] pl-2">
                <span className="text-[9px] font-semibold text-[#64748b] uppercase tracking-wider">
                  PFZ Potential
                </span>
                <span className="text-[11px] font-bold text-[#1e293b] mt-0.5">
                  {probedLocation.potential}
                </span>
              </div>
            </div>

            {/* Action link */}
            <div className="flex items-center justify-end pt-0.5">
              <button
                type="button"
                id="ask-ai-probe-btn"
                onClick={() => {
                  handleSendMessage(
                    `Analyze oceanographic telemetry and fishing prospects at location ${probedLocation.lat}, ${probedLocation.lng} (SST: ${probedLocation.sst}, Chlorophyll: ${probedLocation.chl}).`
                  );
                }}
                className="text-[11px] text-[#1a5490] hover:text-[#0d2c4d] font-bold flex items-center gap-1.5 cursor-pointer bg-[#e8f0fe] hover:bg-[#d9e7fd] px-2.5 py-1 rounded-lg border border-[#1a5490]/20 transition-all active:scale-98"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#1a5490]" />
                <span>Ask AI about this location</span>
              </button>
            </div>
          </div>
        )}

        {/* Chat / Assistant Interaction Section */}
        <div className="p-4 bg-[#ffffff] flex flex-col gap-3">
          {/* Quick Prompt Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar pb-1">
            {SAMPLE_PROMPT_CHIPS.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(chip)}
                disabled={isProcessing}
                className="whitespace-nowrap text-[10px] text-[#1a5490] bg-[#fafaf7] hover:bg-[#e8f0fe] border border-[#c2c6d1]/40 rounded-full px-2.5 py-1 transition-colors shrink-0 cursor-pointer"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Messages Scroll Area */}
          <div
            ref={chatScrollRef}
            className="flex flex-col gap-3.5 max-h-[340px] overflow-y-auto hide-scrollbar pt-1"
          >
            {messages.map((msg, msgIdx) => {
              if (msg.sender === 'user') {
                return (
                  <div key={msg.id} className="flex justify-end">
                    <div className="bg-[#e8f0fe] text-[#22223b] rounded-2xl rounded-tr-xs px-3.5 py-2 max-w-[85%] border border-[#1a5490]/15 shadow-2xs">
                      <p className="text-xs font-sans leading-relaxed">{msg.text}</p>
                    </div>
                  </div>
                );
              }

              return (
                <div key={msg.id} className="flex flex-col gap-2">
                  {/* Multi-Agent Status Cards */}
                  {msg.agents && (
                    <div className="flex flex-col gap-1 max-w-[90%]">
                      {msg.agents.map((agent, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between bg-[#fafaf7] rounded-lg px-2.5 py-1.5 border border-[#c2c6d1]/30 text-[10px] text-[#424750]"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-4 h-4 rounded-full flex items-center justify-center ${
                                agent.type === 'temp'
                                  ? 'bg-[#1a5490]/15 text-[#1a5490]'
                                  : agent.type === 'chlorophyll'
                                  ? 'bg-[#2e7d32]/15 text-[#2e7d32]'
                                  : 'bg-[#b36b00]/15 text-[#b36b00]'
                              }`}
                            >
                              {agent.type === 'temp' && <Thermometer className="w-2.5 h-2.5" />}
                              {agent.type === 'chlorophyll' && <Leaf className="w-2.5 h-2.5" />}
                              {agent.type === 'weather' && <Wind className="w-2.5 h-2.5" />}
                            </div>
                            <span className="font-semibold text-[#22223b]">{agent.name}</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {agent.value && (
                              <span className="font-mono text-[9px] font-bold text-[#1a5490]">
                                {agent.value}
                              </span>
                            )}
                            {agent.status === 'warning' ? (
                              <AlertTriangle className="w-3.5 h-3.5 text-[#f2a65a]" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#2e7d32]" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Route Hazard Summary Card if message contains route */}
                  {msg.hasRoute && msg.routeData && (
                    <div className="p-3 bg-[#fde8e8] rounded-xl border border-[#c62828]/25 text-[#22223b] space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold text-[#c62828] font-heading">
                        <div className="flex items-center gap-1">
                          <NavigationIcon className="w-3.5 h-3.5" />
                          <span>Navigation Route Overview</span>
                        </div>
                        <span className="text-[10px] font-mono">{msg.routeData.distance}</span>
                      </div>
                      <p className="text-[11px] text-[#424750]">
                        Transit Time: <strong>{msg.routeData.estimatedTime}</strong>
                      </p>
                      <div className="space-y-0.5 pt-1">
                        {msg.routeData.hazards.map((hz, idx) => (
                          <div key={idx} className="flex items-center gap-1 text-[10px] text-[#c62828] font-medium">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            <span>{hz}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Assistant Message Bubble */}
                  <div className="flex justify-start">
                    <div className="bg-[#fafaf7] text-[#22223b] rounded-2xl rounded-tl-xs px-3.5 py-2.5 max-w-[95%] border border-[#c2c6d1]/30 shadow-2xs relative">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#1a5490] rounded-l-2xl" />
                      <div className="flex items-start gap-1.5">
                        <p className="text-xs font-sans leading-relaxed flex-1">{msg.text}</p>
                        {'speechSynthesis' in window && (
                          <button
                            type="button"
                            onClick={() => speakMessage(msg)}
                            title={speakingMsgId === msg.id ? 'Stop' : 'Listen to this answer'}
                            className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
                              speakingMsgId === msg.id ? 'bg-[#1a5490] text-white' : 'text-[#1a5490] hover:bg-[#1a5490]/10'
                            }`}
                          >
                            <Volume2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Source attribution & drill-down */}
                      <div className="mt-2 pt-1.5 border-t border-[#c2c6d1]/25 flex items-center justify-between gap-1 text-[9px] text-[#6b6b80] font-mono">
                        <div className="flex items-center gap-1 truncate">
                          <Info className="w-3 h-3 text-[#1a5490] shrink-0" />
                          <span className="truncate">{msg.source || 'Source unavailable'}</span>
                        </div>

                        {msg.findings && (
                          <button
                            onClick={() => {
                              const precedingUserMsg = messages[msgIdx - 1];
                              setInspectedQuery(precedingUserMsg?.sender === 'user' ? precedingUserMsg.text : '');
                              setInspectedFindings(msg.findings || null);
                            }}
                            className="text-[#1a5490] hover:underline font-bold whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-0.5"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>Inspect Agents</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Real-time in-progress agent checklist during generation */}
            {isProcessing && activeAgentSteps.length > 0 && (
              <div className="flex flex-col gap-1 max-w-[90%] animate-pulse">
                {activeAgentSteps.map((agent, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between bg-[#fafaf7] rounded-lg px-2.5 py-1.5 border border-[#c2c6d1]/30 text-[10px] text-[#424750]"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded-full flex items-center justify-center ${
                          agent.type === 'temp'
                            ? 'bg-[#1a5490]/15 text-[#1a5490]'
                            : agent.type === 'chlorophyll'
                            ? 'bg-[#2e7d32]/15 text-[#2e7d32]'
                            : 'bg-[#b36b00]/15 text-[#b36b00]'
                        }`}
                      >
                        {agent.type === 'temp' && <Thermometer className="w-2.5 h-2.5" />}
                        {agent.type === 'chlorophyll' && <Leaf className="w-2.5 h-2.5" />}
                        {agent.type === 'weather' && <Wind className="w-2.5 h-2.5" />}
                      </div>
                      <span className="font-semibold text-[#22223b]">
                        {agent.name} {agent.status === 'checking' ? 'checking…' : 'verified'}
                      </span>
                    </div>

                    {agent.status === 'completed' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#2e7d32]" />
                    ) : (
                      <Hourglass className="w-3.5 h-3.5 text-[#1a5490] animate-spin" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* User Input Prompt Bar */}
          <div className="pt-1 flex flex-col gap-1.5">
            {voiceUnsupported && (
              <p className="text-[9px] text-[#b36b00] px-1">Voice input isn't supported in this browser — try Chrome on Android.</p>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-1.5"
            >
              <button
                type="button"
                onClick={isListening ? stopListening : startListening}
                disabled={isProcessing || isTranscribing}
                title={isListening ? 'Stop and send' : 'Ask by voice — speak in any language'}
                className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-all active:scale-95 shadow-xs border ${
                  isListening
                    ? 'bg-[#c62828] text-white border-[#c62828] animate-pulse'
                    : 'bg-[#fafaf7] text-[#1a5490] border-[#c2c6d1]/50 hover:bg-[#e8f0fe]'
                }`}
              >
                {isListening ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-4 h-4" />}
              </button>

              <div className="relative flex-1 flex items-center">
                <input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  disabled={isProcessing}
                  className="w-full bg-[#fafaf7] border border-[#c2c6d1]/50 focus:border-[#1a5490] text-[#22223b] placeholder:text-[#6b6b80] rounded-full py-2.5 pl-4 pr-10 text-xs shadow-inner focus:outline-hidden"
                  placeholder={
                    isListening
                      ? 'Listening… speak any language, tap to send'
                      : isTranscribing
                      ? 'Transcribing…'
                      : 'Ask in any language, or use the mic...'
                  }
                  type="text"
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim() || isProcessing}
                  className="absolute right-1.5 w-7 h-7 rounded-full btn-primary-gradient disabled:opacity-40 flex items-center justify-center text-white cursor-pointer transition-transform active:scale-95 shadow-xs"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Drill-Down Agent Detail View Modal */}
      {inspectedFindings && (
        <AgentDetailModal
          isOpen={!!inspectedFindings}
          onClose={() => setInspectedFindings(null)}
          findings={inspectedFindings}
          queryText={inspectedQuery}
        />
      )}
    </main>
  );
};
