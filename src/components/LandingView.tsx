import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Shield, TrendingUp, BellRing, LogIn } from 'lucide-react';
import cleanOceanHorizon from '../assets/images/ocean_horizon_clean_1787583691584.jpg';

interface LandingViewProps {
  onGetStarted: () => void;
  onOpenLogin: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({
  onGetStarted,
  onOpenLogin,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="relative w-full max-w-md min-h-screen mx-auto flex flex-col justify-between overflow-hidden bg-[#0a1926] text-white shadow-2xl select-none font-sans">
      {/* Background Image of Horizon Seascape */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <img
          alt="Ocean Horizon with glistening dark water and calm sky"
          className="w-full h-full object-cover object-center"
          src={cleanOceanHorizon}
          referrerPolicy="no-referrer"
        />

        {/* Subtle vignette gradients on top and bottom for UI controls clarity */}
        <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#06121f]/90 via-[#06121f]/35 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#06121f]/60 to-transparent pointer-events-none" />
      </div>

      {/* Top Header Tag */}
      <header className="relative z-20 pt-8 px-6 flex items-center justify-between">
        <div className="flex items-center gap-1.5 opacity-90 drop-shadow-md">
          <span
            className="material-symbols-outlined text-white text-lg"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            waves
          </span>
          <span className="text-[10px] tracking-[0.25em] uppercase font-semibold text-white">
            Ocean Intelligence
          </span>
        </div>

        <button
          onClick={onOpenLogin}
          className="text-[11px] font-medium text-white bg-black/30 hover:bg-black/50 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/20 transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
        >
          <LogIn className="w-3.5 h-3.5" />
          <span>Sign In</span>
        </button>
      </header>

      {/* ORCA Letters Positioned Exactly Bisected / Divided by the Ocean Horizon Line */}
      <div className="absolute inset-x-0 top-[48.6%] -translate-y-1/2 z-10 flex flex-col items-center justify-center pointer-events-none px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          className="w-full flex items-center justify-center"
        >
          {/* Exact Horizon Bisected Serif Letters */}
          <div
            className="flex items-center justify-center gap-6 sm:gap-9 text-white select-none"
            style={{
              fontFamily: '"Bodoni Moda", "Cinzel", "Cormorant Garamond", Georgia, serif',
            }}
          >
            {['O', 'R', 'C', 'A'].map((letter, index) => (
              <span
                key={index}
                className="text-5xl sm:text-6xl font-normal leading-none tracking-normal inline-block transform"
                style={{
                  textShadow:
                    '0 2px 14px rgba(0, 0, 0, 0.9), 0 0 30px rgba(255, 255, 255, 0.4), 0 0 60px rgba(164, 201, 255, 0.25)',
                  filter: 'drop-shadow(0 4px 10px rgba(0, 0, 0, 0.85))',
                }}
              >
                {letter}
              </span>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Center Spacer to preserve layout */}
      <div className="relative z-10 flex-1 pointer-events-none" />

      {/* Bottom Floating Action Area */}
      <footer className="relative z-20 px-6 pb-10 flex flex-col items-center gap-3">
        {/* Toggleable Feature Overview Drawer */}
        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.98 }}
              transition={{ duration: 0.25 }}
              className="w-full bg-[#0a1e33]/95 backdrop-blur-xl border border-white/20 rounded-2xl p-4 shadow-2xl flex flex-col gap-3 mb-1"
            >
              <div className="flex justify-between items-center border-b border-white/10 pb-2">
                <span className="text-xs font-bold font-heading text-white">ORCA Platform Capabilities</span>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-[11px] text-white/60 hover:text-white cursor-pointer px-1"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white/5 border border-white/10">
                  <Shield className="w-4 h-4 text-[#a0f399]" />
                  <span className="text-[10px] font-semibold text-white">Fishermen</span>
                  <span className="text-[8px] text-white/70">PFZ &amp; Safety</span>
                </div>
                <div className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white/5 border border-white/10">
                  <TrendingUp className="w-4 h-4 text-[#a4c9ff]" />
                  <span className="text-[10px] font-semibold text-white">Researchers</span>
                  <span className="text-[8px] text-white/70">SST &amp; Chl Trends</span>
                </div>
                <div className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white/5 border border-white/10">
                  <BellRing className="w-4 h-4 text-[#ffdad6]" />
                  <span className="text-[10px] font-semibold text-white">Alerts</span>
                  <span className="text-[8px] text-white/70">Live Feed</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Primary Call to Action Button */}
        <div className="w-full flex flex-col items-center gap-2">
          <button
            onClick={onGetStarted}
            id="landing-enter-platform-btn"
            className="w-full py-3.5 px-6 rounded-full bg-gradient-to-r from-[#d4e3ff] via-[#ffffff] to-[#a4c9ff] hover:brightness-105 active:scale-[0.99] text-[#001c39] font-heading font-extrabold text-xs tracking-wider uppercase shadow-[0_8px_30px_rgba(0,0,0,0.6)] transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Enter Platform</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-4 text-[11px] text-white/80 drop-shadow-sm">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="hover:text-white transition-colors underline cursor-pointer text-[10px]"
            >
              {showDetails ? 'Hide Overview' : 'Overview & Features'}
            </button>
            <span>•</span>
            <button
              onClick={onOpenLogin}
              className="hover:text-white transition-colors cursor-pointer text-[10px]"
            >
              Sign In
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
