/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TabType, UserProfile } from './types';
import { INITIAL_USER } from './data/mockData';
import { TopAppBar, BottomNavBar } from './components/Navigation';
import { LandingView } from './components/LandingView';
import { LoginView } from './components/LoginView';
import { HomeView } from './components/HomeView';
import { ExploreView } from './components/ExploreView';
import { AlertsView } from './components/AlertsView';
import { ProfileView } from './components/ProfileView';

// Covers India's full coastline — west coast (Gujarat down to Kerala), east
// coast (Tamil Nadu up to West Bengal), and both island territories.
const REGIONS = [
  'Gujarat Coast',
  'Maharashtra Coast',
  'Goa Coast',
  'Karnataka Coast',
  'Malabar Coast',
  'South Kerala Coast',
  'Vizhinjam Coast',
  'Kochi Offshore',
  'South Tamil Nadu',
  'North Tamil Nadu',
  'South Andhra Pradesh',
  'North Andhra Pradesh',
  'Odisha Coast',
  'West Bengal Coast',
  'Lakshadweep Islands',
  'Andaman & Nicobar Islands',
  'Bay of Bengal',
];

export default function App() {
  const [viewState, setViewState] = useState<'app' | 'landing' | 'login'>('landing');
  const [currentTab, setCurrentTab] = useState<TabType>('home');
  const [user, setUser] = useState<UserProfile>(INITIAL_USER);
  const [selectedRegion, setSelectedRegion] = useState<string>('South Kerala Coast');

  const handleLogin = (profile: Partial<UserProfile>) => {
    setUser((prev) => ({ ...prev, ...profile }));
    setViewState('app');
  };

  const handleUpdateUser = (updated: Partial<UserProfile>) => {
    setUser((prev) => ({ ...prev, ...updated }));
  };

  // 1. Landing View
  if (viewState === 'landing') {
    return (
      <div className="bg-[#fcf8ff] min-h-screen flex justify-center selection:bg-[#a4c9ff] selection:text-[#001c39]">
        <LandingView
          onGetStarted={() => setViewState('app')}
          onOpenLogin={() => setViewState('login')}
        />
      </div>
    );
  }

  // 2. Login View
  if (viewState === 'login') {
    return (
      <div className="bg-[#fcf8ff] min-h-screen flex justify-center selection:bg-[#a4c9ff] selection:text-[#001c39]">
        <LoginView
          onLogin={handleLogin}
          onBackToLanding={() => setViewState('landing')}
        />
      </div>
    );
  }

  // 3. Main App View (Centered mobile canvas matching original design)
  const currentThemeClass = `theme-${user.themePalette || 'deep-ocean'}`;

  return (
    <div className={`bg-[#fcf8ff] min-h-screen flex justify-center selection:bg-[#a4c9ff] selection:text-[#001c39] ${currentThemeClass}`}>
      <div className="relative w-full max-w-md min-h-screen flex flex-col justify-between overflow-x-hidden shadow-2xl bg-[#fcf8ff] text-[#191932]">
        {/* Top Gradient Header Section */}
        <TopAppBar
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          user={user}
          selectedRegion={selectedRegion}
          onRegionChange={setSelectedRegion}
          regions={REGIONS}
          onOpenLogin={() => setViewState('login')}
          onUpdateUser={handleUpdateUser}
        />

        {/* Floating Main Content Area with Smooth Screen Transitions */}
        <AnimatePresence mode="wait">
          {currentTab === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="w-full flex-1 flex flex-col"
            >
              <HomeView selectedRegion={selectedRegion} user={user} />
            </motion.div>
          )}

          {currentTab === 'explore' && (
            <motion.div
              key="explore"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="w-full flex-1 flex flex-col"
            >
              <ExploreView
                selectedRegion={selectedRegion}
                onRegionChange={setSelectedRegion}
              />
            </motion.div>
          )}

          {currentTab === 'alerts' && (
            <motion.div
              key="alerts"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="w-full flex-1 flex flex-col"
            >
              <AlertsView onNavigateToHome={() => setCurrentTab('home')} />
            </motion.div>
          )}

          {currentTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="w-full flex-1 flex flex-col"
            >
              <ProfileView
                user={user}
                onUpdateUser={handleUpdateUser}
                onLogout={() => setViewState('login')}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Persistent Bottom Navigation Bar */}
        <BottomNavBar
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          user={user}
          selectedRegion={selectedRegion}
          onRegionChange={setSelectedRegion}
          regions={REGIONS}
        />
      </div>
    </div>
  );
}
