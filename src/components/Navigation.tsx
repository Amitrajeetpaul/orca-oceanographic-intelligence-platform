import React, { useState } from 'react';
import { TabType, UserProfile, ThemePalette } from '../types';
import { Anchor, Microscope, Waves, Bell, Compass, User as UserIcon, ChevronDown, Check, Palette, Sparkles } from 'lucide-react';

const QUICK_THEMES: { id: ThemePalette; name: string; preview: string }[] = [
  { id: 'deep-ocean', name: 'Deep Marine', preview: 'from-[#1A5490] to-[#0D2C4D]' },
  { id: 'emerald-teal', name: 'Emerald Teal', preview: 'from-[#0F766E] to-[#042F2E]' },
  { id: 'twilight-indigo', name: 'Twilight Indigo', preview: 'from-[#4338CA] to-[#1E1B4B]' },
  { id: 'sunset-coral', name: 'Sunset Horizon', preview: 'from-[#C2410C] to-[#431407]' },
];

interface NavigationProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
  user: UserProfile;
  selectedRegion: string;
  onRegionChange: (region: string) => void;
  regions: string[];
  unreadAlertsCount?: number;
  onOpenLogin?: () => void;
  onUpdateUser?: (updated: Partial<UserProfile>) => void;
}

export const TopAppBar: React.FC<NavigationProps> = ({
  currentTab,
  onTabChange,
  user,
  selectedRegion,
  onRegionChange,
  regions,
  unreadAlertsCount = 2,
  onUpdateUser,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [themePickerOpen, setThemePickerOpen] = useState(false);

  return (
    <header className="relative w-full h-[290px] primary-header-gradient flex flex-col items-center justify-start pt-7 pb-10 select-none shrink-0">
      {/* Radial Glow Blob */}
      <div className="header-radial-glow absolute inset-0 pointer-events-none" />

      {/* Top Header Row */}
      <div className="w-full flex items-center justify-between px-6 z-10">
        {/* Brand Title */}
        <div
          onClick={() => onTabChange('home')}
          className="flex items-center gap-2 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-lg bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-xs group-hover:bg-white/20 transition-colors">
            <Waves className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-heading font-extrabold text-xl tracking-tight text-white leading-none">
              ORCA
            </h1>
            <span className="text-[9px] tracking-wider uppercase text-white/75 font-mono">
              Ocean Intelligence
            </span>
          </div>
        </div>

        {/* Right Header Actions: Palette Switcher & User Profile */}
        <div className="flex items-center gap-1.5">
          {/* Quick Palette Toggle Button */}
          {onUpdateUser && (
            <div className="relative">
              <button
                type="button"
                id="quick-palette-toggle"
                onClick={() => setThemePickerOpen(!themePickerOpen)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/25 active:scale-95 text-white backdrop-blur-md flex items-center justify-center border border-white/20 transition-all cursor-pointer shadow-2xs"
                title="Change Theme Gradient Color"
              >
                <Palette className="w-3.5 h-3.5" />
              </button>

              {themePickerOpen && (
                <>
                  <div
                    className="fixed inset-0 z-[2000]"
                    onClick={() => setThemePickerOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-48 bg-[#ffffff] text-[#22223b] rounded-2xl shadow-2xl border border-[#c2c6d1]/40 py-2 px-1.5 z-[2001] animate-in fade-in zoom-in-95">
                    <div className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-[#6b6b80] font-heading flex items-center justify-between">
                      <span>Gradient Palette</span>
                      <Sparkles className="w-3 h-3 text-[#1a5490]" />
                    </div>
                    <div className="space-y-1 mt-1">
                      {QUICK_THEMES.map((theme) => {
                        const isCurrent = (user.themePalette || 'deep-ocean') === theme.id;
                        return (
                          <button
                            key={theme.id}
                            type="button"
                            onClick={() => {
                              onUpdateUser({ themePalette: theme.id });
                              setThemePickerOpen(false);
                            }}
                            className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                              isCurrent
                                ? 'bg-[#1a5490]/10 text-[#1a5490] font-bold'
                                : 'text-[#22223b] hover:bg-[#fafaf7]'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className={`w-3.5 h-3.5 rounded-full bg-gradient-to-r ${theme.preview} border border-black/10 shrink-0`} />
                              <span className="text-xs">{theme.name}</span>
                            </div>
                            {isCurrent && <Check className="w-3.5 h-3.5 text-[#1a5490]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* User Profile Avatar & Persona Badge */}
          <div
            onClick={() => onTabChange('profile')}
            className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/20 cursor-pointer hover:bg-white/20 transition-all shadow-xs"
            title={`Signed in as ${user.name} (${user.role})`}
          >
            <div className="w-6 h-6 rounded-full overflow-hidden border border-white/40 shadow-xs bg-[#22223b] shrink-0">
              <img
                alt={user.name}
                className="w-full h-full object-cover"
                src={user.avatarUrl}
              />
            </div>
            <span className="text-[10px] font-semibold text-white truncate max-w-[80px]">
              {user.role === 'fisherman' ? 'Fisherman' : 'Researcher'}
            </span>
          </div>
        </div>
      </div>

      {/* Dynamic Sub-header Context / Region Selector */}
      {currentTab === 'home' && (
        <div className="mt-4 z-[2000] relative flex flex-col items-center">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-1.5 text-white bg-white/15 hover:bg-white/25 rounded-full px-3.5 py-1.5 backdrop-blur-md border border-white/25 transition-all text-xs font-medium cursor-pointer shadow-xs"
          >
            <span className="w-2 h-2 rounded-full bg-[#2e7d32] animate-pulse shrink-0" />
            <span className="font-medium">{selectedRegion}</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-80" />
          </button>

          {dropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-[2000]"
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-52 bg-[#ffffff] text-[#22223b] rounded-2xl shadow-2xl border border-[#c2c6d1]/40 py-2 z-[2001] animate-in fade-in zoom-in-95">
                <div className="px-3.5 py-1 text-[9px] font-bold uppercase tracking-wider text-[#6b6b80] font-heading">
                  Maritime Monitoring Corridor
                </div>
                {regions.map((region) => (
                  <button
                    key={region}
                    onClick={() => {
                      onRegionChange(region);
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 text-xs flex items-center justify-between hover:bg-[#fafaf7] transition-colors cursor-pointer ${
                      selectedRegion === region
                        ? 'bg-[#1a5490]/10 text-[#1a5490] font-bold'
                        : 'text-[#22223b]'
                    }`}
                  >
                    <span>{region}</span>
                    {selectedRegion === region && (
                      <Check className="w-3.5 h-3.5 text-[#1a5490]" />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {currentTab === 'explore' && (
        <div className="w-full px-6 mt-3 z-10 flex flex-col items-start">
          <h2 className="font-heading font-extrabold text-2xl tracking-tight text-white leading-tight">
            Research &amp; Analysis
          </h2>
          <p className="text-xs font-medium text-white/85 mt-0.5">
            Regional Environmental Data
          </p>
        </div>
      )}

      {currentTab === 'alerts' && (
        <div className="w-full px-6 mt-4 z-10 flex flex-col items-start">
          <h2 className="font-heading font-bold text-lg text-white">
            Coastal Alerts &amp; History
          </h2>
          <p className="text-xs text-white/80">
            Active Maritime Hazard Bulletins &amp; Query Records
          </p>
        </div>
      )}

      {currentTab === 'profile' && (
        <div className="w-full px-6 mt-4 z-10 flex flex-col items-start">
          <h2 className="font-heading font-bold text-lg text-white">
            Operator Settings
          </h2>
          <p className="text-xs text-white/80">{user.vesselOrInstitution}</p>
        </div>
      )}
    </header>
  );
};

export const BottomNavBar: React.FC<NavigationProps> = ({
  currentTab,
  onTabChange,
  unreadAlertsCount = 2,
}) => {
  return (
    <nav
      id="bottom-navigation-bar"
      className="fixed bottom-0 left-0 right-0 w-full max-w-md mx-auto z-50 flex justify-around items-center px-4 py-2 pb-safe bg-[#ffffff] border-t border-[#c2c6d1]/30 shadow-[0_-4px_20px_rgba(26,84,144,0.08)] select-none"
    >
      {/* 1. Home */}
      <button
        onClick={() => onTabChange('home')}
        id="nav-tab-home"
        className={`flex flex-col items-center justify-center transition-all cursor-pointer ${
          currentTab === 'home'
            ? 'btn-primary-gradient text-white rounded-full px-4 py-1.5 shadow-md'
            : 'text-[#6b6b80] hover:text-[#1a5490] py-1.5 px-3'
        }`}
      >
        <Waves className="w-4 h-4" />
        <span className="text-[10px] font-bold tracking-wide mt-0.5 font-heading">
          Home
        </span>
      </button>

      {/* 2. Explore */}
      <button
        onClick={() => onTabChange('explore')}
        id="nav-tab-explore"
        className={`flex flex-col items-center justify-center transition-all cursor-pointer ${
          currentTab === 'explore'
            ? 'btn-primary-gradient text-white rounded-full px-4 py-1.5 shadow-md'
            : 'text-[#6b6b80] hover:text-[#1a5490] py-1.5 px-3'
        }`}
      >
        <Compass className="w-4 h-4" />
        <span className="text-[10px] font-bold tracking-wide mt-0.5 font-heading">
          Explore
        </span>
      </button>

      {/* 3. Alerts */}
      <button
        onClick={() => onTabChange('alerts')}
        id="nav-tab-alerts"
        className={`flex flex-col items-center justify-center transition-all relative cursor-pointer ${
          currentTab === 'alerts'
            ? 'btn-primary-gradient text-white rounded-full px-4 py-1.5 shadow-md'
            : 'text-[#6b6b80] hover:text-[#1a5490] py-1.5 px-3'
        }`}
      >
        {unreadAlertsCount > 0 && currentTab !== 'alerts' && (
          <span className="absolute top-1 right-2.5 w-2 h-2 bg-[#c62828] rounded-full border-2 border-white animate-pulse" />
        )}
        <Bell className="w-4 h-4" />
        <span className="text-[10px] font-bold tracking-wide mt-0.5 font-heading">
          Alerts
        </span>
      </button>

      {/* 4. Profile */}
      <button
        onClick={() => onTabChange('profile')}
        id="nav-tab-profile"
        className={`flex flex-col items-center justify-center transition-all cursor-pointer ${
          currentTab === 'profile'
            ? 'btn-primary-gradient text-white rounded-full px-4 py-1.5 shadow-md'
            : 'text-[#6b6b80] hover:text-[#1a5490] py-1.5 px-3'
        }`}
      >
        <UserIcon className="w-4 h-4" />
        <span className="text-[10px] font-bold tracking-wide mt-0.5 font-heading">
          Profile
        </span>
      </button>
    </nav>
  );
};
