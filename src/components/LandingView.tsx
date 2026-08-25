import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, DollarSign, Activity, Bell, LogIn, Waves } from 'lucide-react';
import cleanOceanHorizon from '../assets/images/ocean_horizon_clean_1787583691584.jpg';

interface LandingViewProps {
  onGetStarted: () => void;
  onOpenLogin: () => void;
}

const FEATURES = [
  {
    icon: DollarSign,
    title: 'Fishermen Safety',
    description: 'Real-time alerts on volatile sea states and weather.',
  },
  {
    icon: Activity,
    title: 'Researcher Trends',
    description: 'Long-term ecological tracking and data visualization.',
  },
  {
    icon: Bell,
    title: 'Real-time Alerts',
    description: 'Instant notifications for critical oceanic anomalies.',
  },
];

export const LandingView: React.FC<LandingViewProps> = ({
  onGetStarted,
  onOpenLogin,
}) => {
  return (
    <div className="relative w-full max-w-md min-h-screen mx-auto flex flex-col overflow-hidden bg-[#0a1926] text-white shadow-2xl select-none font-sans">
      {/* Cropped Hero Photo — wordmark sits where sky meets water */}
      <div className="relative w-full h-[300px] shrink-0 overflow-hidden">
        <img
          alt="Ocean Horizon with glistening dark water and calm sky"
          className="w-full h-full object-cover object-center"
          src={cleanOceanHorizon}
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#0a1926] via-[#0a1926]/40 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#06121f]/60 to-transparent pointer-events-none" />

        <header className="absolute inset-x-0 top-0 z-20 pt-7 px-6 flex items-center justify-end">
          <button
            onClick={onOpenLogin}
            className="text-[11px] font-medium text-white bg-black/30 hover:bg-black/50 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/20 transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
        </header>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className="absolute inset-x-0 bottom-6 z-10 flex flex-col items-center gap-1.5"
        >
          <Waves className="w-7 h-7 text-white drop-shadow-md" />
          <div
            className="flex items-center justify-center gap-3 text-white select-none"
            style={{ fontFamily: '"Bodoni Moda", "Cinzel", "Cormorant Garamond", Georgia, serif' }}
          >
            {['O', 'R', 'C', 'A'].map((letter, index) => (
              <span
                key={index}
                className="text-4xl font-normal leading-none inline-block"
                style={{
                  textShadow: '0 2px 14px rgba(0, 0, 0, 0.9), 0 0 30px rgba(255, 255, 255, 0.4)',
                }}
              >
                {letter}
              </span>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Tagline, Subtext & Always-Visible Feature List on solid navy panel */}
      <div className="relative z-10 flex-1 flex flex-col px-6 pt-6 pb-8 gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="font-heading text-2xl font-extrabold text-white tracking-tight">
            Ask. Understand. Act.
          </h1>
          <p className="text-sm text-white/70 leading-relaxed max-w-xs">
            Ask plain-language questions about ocean conditions and get clear, evidence-backed answers from real-time data networks.
          </p>
        </div>

        <div className="border-t border-white/10" />

        <div className="flex flex-col gap-5">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div key={title} className="flex flex-col items-center gap-1.5 text-center">
              <div className="w-11 h-11 rounded-full bg-[#86efac] flex items-center justify-center shrink-0 shadow-md">
                <Icon className="w-5 h-5 text-[#0a1926]" strokeWidth={2.5} />
              </div>
              <span className="text-sm font-bold text-white font-heading">{title}</span>
              <p className="text-xs text-white/70 max-w-[220px] leading-relaxed">{description}</p>
            </div>
          ))}
        </div>

        <div className="flex-1 min-h-4" />

        {/* Primary Call to Action */}
        <div className="w-full flex flex-col items-center gap-3">
          <button
            onClick={onGetStarted}
            id="landing-enter-platform-btn"
            className="w-full py-3.5 px-6 rounded-full bg-gradient-to-r from-[#d4e3ff] via-[#ffffff] to-[#a4c9ff] hover:brightness-105 active:scale-[0.99] text-[#001c39] font-heading font-extrabold text-xs tracking-wider uppercase shadow-[0_8px_30px_rgba(0,0,0,0.4)] transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Enter Platform</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenLogin}
            className="text-[11px] text-white/70 hover:text-white transition-colors cursor-pointer"
          >
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
};
