import React, { useState } from 'react';
import { UserProfile, UserRole, LanguageCode, ThemePalette } from '../types';
import {
  Anchor,
  Microscope,
  LogOut,
  CheckCircle,
  Bell,
  Volume2,
  Database,
  Network,
  Plus,
  Trash2,
  Globe,
  MapPin,
  Sparkles,
  Palette,
} from 'lucide-react';
import { DataSourcesModal } from './DataSourcesModal';
import { ArchitectureModal } from './ArchitectureModal';

const THEME_PALETTES: { id: ThemePalette; name: string; gradient: string; preview: string }[] = [
  {
    id: 'deep-ocean',
    name: 'Deep Marine',
    gradient: 'from-[#1A5490] via-[#123C68] to-[#0D2C4D]',
    preview: 'bg-gradient-to-r from-[#1A5490] to-[#0D2C4D]',
  },
  {
    id: 'emerald-teal',
    name: 'Emerald Coast',
    gradient: 'from-[#0F766E] via-[#115E59] to-[#042F2E]',
    preview: 'bg-gradient-to-r from-[#0F766E] to-[#042F2E]',
  },
  {
    id: 'twilight-indigo',
    name: 'Twilight Indigo',
    gradient: 'from-[#4338CA] via-[#312E81] to-[#1E1B4B]',
    preview: 'bg-gradient-to-r from-[#4338CA] to-[#1E1B4B]',
  },
  {
    id: 'sunset-coral',
    name: 'Sunset Horizon',
    gradient: 'from-[#C2410C] via-[#9A3412] to-[#431407]',
    preview: 'bg-gradient-to-r from-[#C2410C] to-[#431407]',
  },
];

interface ProfileViewProps {
  user: UserProfile;
  onUpdateUser: (updated: Partial<UserProfile>) => void;
  onLogout: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  onUpdateUser,
  onLogout,
}) => {
  const [role, setRole] = useState<UserRole>(user.role);
  const [name, setName] = useState(user.name);
  const [institution, setInstitution] = useState(user.vesselOrInstitution);
  const [units, setUnits] = useState<'metric' | 'nautical'>(user.preferredUnits);
  const [language, setLanguage] = useState<LanguageCode>(user.language || 'en');
  const [themePalette, setThemePalette] = useState<ThemePalette>(user.themePalette || 'deep-ocean');
  const [notifications, setNotifications] = useState(user.notificationsEnabled);
  const [audioAlerts, setAudioAlerts] = useState(user.audioAlerts);
  const [savedRegions, setSavedRegions] = useState<string[]>(user.savedRegions || ['South Kerala Coast', 'Vizhinjam Coast', 'Kochi Offshore']);
  const [newRegionInput, setNewRegionInput] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Modals
  const [showDataSources, setShowDataSources] = useState(false);
  const [showArchitecture, setShowArchitecture] = useState(false);

  const handleSave = () => {
    onUpdateUser({
      name,
      role,
      vesselOrInstitution: institution,
      preferredUnits: units,
      language,
      themePalette,
      notificationsEnabled: notifications,
      audioAlerts,
      savedRegions,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2200);
  };

  const handleRoleToggle = (newRole: UserRole) => {
    setRole(newRole);
    if (newRole === 'fisherman') {
      setName('Captain Rajesh Nair');
      setInstitution('Vizhinjam Fishing Cooperative #42');
    } else {
      setName('Dr. Anya Sharma');
      setInstitution('National Institute of Ocean Technology');
    }
  };

  const handleAddRegion = () => {
    if (newRegionInput.trim() && !savedRegions.includes(newRegionInput.trim())) {
      setSavedRegions([...savedRegions, newRegionInput.trim()]);
      setNewRegionInput('');
    }
  };

  const handleRemoveRegion = (regionToRemove: string) => {
    setSavedRegions(savedRegions.filter((r) => r !== regionToRemove));
  };

  return (
    <main className="w-full px-4 -mt-36 z-10 flex-1 flex flex-col gap-3.5 pb-24">
      {/* Profile Overview Card */}
      <div className="bg-[#ffffff] rounded-2xl p-4 floating-card-shadow border border-[#c2c6d1]/35 flex flex-col gap-4">
        {/* User Badge Row */}
        <div className="flex items-center gap-3 pb-3 border-b border-[#c2c6d1]/25">
          <div className="w-13 h-13 rounded-full overflow-hidden border-2 border-[#1a5490] shadow-xs bg-[#22223b] shrink-0">
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="font-heading text-sm font-bold text-[#22223b] truncate">
                {name}
              </h2>
              <span className="px-2 py-0.5 status-badge-success text-[9px] font-bold font-mono rounded-full shrink-0">
                {role === 'fisherman' ? 'Fisherman' : 'Researcher'}
              </span>
            </div>
            <p className="text-[10px] text-[#6b6b80] font-mono truncate">{user.email}</p>
            <p className="text-[10px] text-[#424750] truncate">{institution}</p>
          </div>

          <button
            onClick={onLogout}
            className="p-2 rounded-xl text-[#c62828] hover:bg-[#fde8e8] transition-colors shrink-0 cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Role Toggle Switcher */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-[#1a5490] uppercase tracking-wider block font-heading">
            Active Operator Role
          </label>
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#fafaf7] rounded-xl border border-[#c2c6d1]/30">
            <button
              type="button"
              onClick={() => handleRoleToggle('fisherman')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-heading font-semibold transition-all cursor-pointer ${
                role === 'fisherman'
                  ? 'btn-primary-gradient text-white shadow-xs'
                  : 'text-[#6b6b80] hover:text-[#1a5490]'
              }`}
            >
              <Anchor className="w-3.5 h-3.5" />
              <span>Fisherman / Operator</span>
            </button>

            <button
              type="button"
              onClick={() => handleRoleToggle('researcher')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-heading font-semibold transition-all cursor-pointer ${
                role === 'researcher'
                  ? 'btn-primary-gradient text-white shadow-xs'
                  : 'text-[#6b6b80] hover:text-[#1a5490]'
              }`}
            >
              <Microscope className="w-3.5 h-3.5" />
              <span>Researcher / Authority</span>
            </button>
          </div>
        </div>

        {/* Saved Monitoring Regions */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-[#1a5490] uppercase tracking-wider block font-heading">
            Saved Coastal Regions ({savedRegions.length})
          </label>

          <div className="space-y-1.5">
            {savedRegions.map((reg) => (
              <div
                key={reg}
                className="flex items-center justify-between px-3 py-1.5 bg-[#fafaf7] rounded-lg border border-[#c2c6d1]/25 text-xs text-[#22223b]"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-[#1a5490]" />
                  <span>{reg}</span>
                </div>
                {savedRegions.length > 1 && (
                  <button
                    onClick={() => handleRemoveRegion(reg)}
                    className="text-[#6b6b80] hover:text-[#c62828] p-0.5 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-1.5 pt-1">
            <input
              value={newRegionInput}
              onChange={(e) => setNewRegionInput(e.target.value)}
              placeholder="Add harbor or coordinate name..."
              className="flex-1 px-3 py-1.5 rounded-lg border border-[#c2c6d1]/40 bg-[#fafaf7] text-xs text-[#22223b] placeholder:text-[#6b6b80] focus:outline-hidden"
            />
            <button
              onClick={handleAddRegion}
              className="px-3 py-1.5 rounded-lg btn-primary-gradient text-white text-xs font-bold cursor-pointer flex items-center gap-1 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>
        </div>

        {/* Theme & Gradient Palette Selector */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-[#1a5490] uppercase tracking-wider block font-heading flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5" />
              <span>Theme Gradient Palette</span>
            </label>
            <span className="text-[9px] font-mono text-[#6b6b80]">Instant Switch</span>
          </div>

          <div className="grid grid-cols-2 gap-2 p-1.5 bg-[#fafaf7] rounded-xl border border-[#c2c6d1]/30 text-xs">
            {THEME_PALETTES.map((pal) => {
              const isSelected = themePalette === pal.id;
              return (
                <button
                  key={pal.id}
                  type="button"
                  id={`theme-palette-${pal.id}`}
                  onClick={() => {
                    setThemePalette(pal.id);
                    // Immediate interactive preview update
                    onUpdateUser({ themePalette: pal.id });
                  }}
                  className={`p-2 rounded-xl flex items-center gap-2.5 transition-all text-left cursor-pointer border ${
                    isSelected
                      ? 'bg-white border-[#1a5490] shadow-sm ring-2 ring-[#1a5490]/20'
                      : 'bg-[#fafaf7] hover:bg-white border-[#c2c6d1]/30 hover:border-[#1a5490]/40'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-lg ${pal.preview} shadow-2xs shrink-0 border border-white/40 flex items-center justify-center`}>
                    {isSelected && <Sparkles className="w-3 h-3 text-white animate-pulse" />}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className={`text-xs font-heading leading-tight truncate ${isSelected ? 'font-bold text-[#1a5490]' : 'font-medium text-[#22223b]'}`}>
                      {pal.name}
                    </span>
                    <span className="text-[9px] text-[#6b6b80] capitalize">
                      {pal.id.replace('-', ' ')}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Language Selection */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-[#1a5490] uppercase tracking-wider block font-heading">
            Interface &amp; Advisory Language
          </label>
          <div className="grid grid-cols-4 gap-1 p-1 bg-[#fafaf7] rounded-xl border border-[#c2c6d1]/30 text-xs">
            {[
              { code: 'en', label: 'English' },
              { code: 'hi', label: 'हिन्दी' },
              { code: 'ta', label: 'தமிழ்' },
              { code: 'ml', label: 'മലയാളം' },
            ].map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => setLanguage(lang.code as LanguageCode)}
                className={`py-1.5 rounded-lg font-medium transition-all cursor-pointer text-center ${
                  language === lang.code
                    ? 'btn-primary-gradient text-white font-bold shadow-2xs'
                    : 'text-[#6b6b80] hover:text-[#22223b]'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        {/* Units Configuration */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-[#1a5490] uppercase tracking-wider block font-heading">
            Preferred Navigation Units
          </label>
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#fafaf7] rounded-xl border border-[#c2c6d1]/30 text-xs">
            <button
              type="button"
              onClick={() => setUnits('nautical')}
              className={`py-2 px-2 rounded-lg font-medium transition-all cursor-pointer ${
                units === 'nautical'
                  ? 'btn-primary-gradient text-white font-bold shadow-2xs'
                  : 'text-[#6b6b80]'
              }`}
            >
              Nautical (nm, kts, m)
            </button>
            <button
              type="button"
              onClick={() => setUnits('metric')}
              className={`py-2 px-2 rounded-lg font-medium transition-all cursor-pointer ${
                units === 'metric'
                  ? 'btn-primary-gradient text-white font-bold shadow-2xs'
                  : 'text-[#6b6b80]'
              }`}
            >
              Metric (km, km/h, m)
            </button>
          </div>
        </div>

        {/* Transparency Links */}
        <div className="space-y-1.5 pt-1">
          <button
            onClick={() => setShowDataSources(true)}
            className="w-full flex items-center justify-between p-3 bg-[#fafaf7] hover:bg-[#e8f0fe] rounded-xl border border-[#c2c6d1]/30 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-[#1a5490]">
              <Database className="w-4 h-4" />
              <span>Data Transparency &amp; Public Sources</span>
            </div>
            <span className="text-[9px] font-mono font-bold text-[#2e7d32]">Copernicus • INCOIS</span>
          </button>

          <button
            onClick={() => setShowArchitecture(true)}
            className="w-full flex items-center justify-between p-3 bg-[#fafaf7] hover:bg-[#e8f0fe] rounded-xl border border-[#c2c6d1]/30 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-[#1a5490]">
              <Network className="w-4 h-4" />
              <span>Multi-Agent Technical Architecture</span>
            </div>
            <span className="text-[9px] font-mono font-bold text-[#1a5490]">Architecture Blueprint</span>
          </button>
        </div>

        {/* Save Profile Button */}
        <div className="pt-2 flex items-center justify-between border-t border-[#c2c6d1]/25">
          {savedSuccess ? (
            <span className="text-xs font-bold text-[#2e7d32] flex items-center gap-1 font-heading">
              <CheckCircle className="w-4 h-4" /> Changes saved!
            </span>
          ) : (
            <span className="text-[10px] text-[#6b6b80] font-mono">Preferences stored</span>
          )}

          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-full btn-primary-gradient text-white text-xs font-heading font-bold cursor-pointer"
          >
            Save Settings
          </button>
        </div>
      </div>

      {/* Modals */}
      <DataSourcesModal isOpen={showDataSources} onClose={() => setShowDataSources(false)} />
      <ArchitectureModal isOpen={showArchitecture} onClose={() => setShowArchitecture(false)} />
    </main>
  );
};
