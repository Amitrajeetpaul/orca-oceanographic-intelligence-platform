export type TabType = 'home' | 'explore' | 'alerts' | 'profile';

export type UserRole = 'fisherman' | 'researcher';

export type MapLayer = 'Temp' | 'Chlorophyll' | 'PFZ';

// Covers English plus the major languages of India's coastal states.
export type LanguageCode = 'en' | 'hi' | 'ta' | 'te' | 'ml' | 'kn' | 'bn' | 'gu' | 'mr' | 'or';

export type ThemePalette = 'deep-ocean' | 'emerald-teal' | 'twilight-indigo' | 'sunset-coral';

export interface ThemeColors {
  id: ThemePalette;
  name: string;
  gradientClass: string;
  btnGradientClass: string;
  previewGradient: string;
  glowColor: string;
  primaryHex: string;
}

export interface AgentFinding {
  agentName: string;
  type: 'temp' | 'chlorophyll' | 'weather' | 'buoy';
  sourceName: string;
  sourceUrl: string;
  timestamp: string;
  confidence: number;
  metric: string;
  value: string;
  rawFindings: string;
  status: 'completed' | 'checking' | 'warning';
}

export interface AgentStatus {
  name: string;
  type: 'temp' | 'chlorophyll' | 'weather' | 'buoy';
  status: 'checking' | 'completed' | 'warning';
  value?: string;
  source?: string;
  confidence?: number;
}

export interface RoutePoint {
  lat: number;
  lng: number;
  name: string;
  status: 'safe' | 'caution' | 'danger';
  hazardReason?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  agents?: AgentStatus[];
  source?: string;
  findings?: AgentFinding[];
  hasRoute?: boolean;
  routeData?: {
    origin: string;
    destination: string;
    distance: string;
    estimatedTime: string;
    hazards: string[];
    waypoints: RoutePoint[];
  };
  pfzDetails?: {
    distance: string;
    bearing: string;
    sst: string;
    chlorophyll: string;
    depth: string;
    potential: 'High' | 'Moderate' | 'Low';
    coordinates?: string;
  };
  geofenceWarning?: {
    severity: 'inside' | 'near';
    territory: string;
    message: string;
  };
}

export interface CoastalAlert {
  id: string;
  title: string;
  timeAgo: string;
  type: 'danger' | 'warning' | 'success' | 'info';
  description: string;
  location: string;
  meta: string;
  severity?: 'High' | 'Moderate' | 'Low' | 'Notice';
  coordinates?: string;
  actionAdvice?: string;
  source?: string;
  issuedAt?: string;
}

export interface RegionalMetric {
  id: string;
  regionName: string;
  weeklyInsight: {
    changeValue: string;
    description: string;
    type: 'increase' | 'decrease';
  };
  sstData: {
    day: string;
    temp: number;
    highlight?: boolean;
  }[];
  chlorophyllData: {
    time: string;
    value: number;
  }[];
  buoyMetrics: {
    salinity: string;
    currentSpeed: string;
    dissolvedOxygen: string;
    waveHeight: string;
    airPressure: string;
    thermoclineDepth: string;
  };
}

export interface DataSourceItem {
  id: string;
  name: string;
  agency: string;
  coverage: string;
  parameters: string[];
  refreshInterval: string;
  apiStatus: 'Active & Verified' | 'Live Telemetry' | 'Scheduled Pull';
  portalUrl: string;
  description: string;
}

export interface UserProfile {
  name: string;
  role: UserRole;
  email: string;
  avatarUrl: string;
  vesselOrInstitution: string;
  primaryRegion: string;
  savedRegions: string[];
  language: LanguageCode;
  preferredUnits: 'metric' | 'nautical';
  themePalette?: ThemePalette;
  notificationsEnabled: boolean;
  audioAlerts: boolean;
}
