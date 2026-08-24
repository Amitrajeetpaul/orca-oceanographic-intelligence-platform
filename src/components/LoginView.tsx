import React, { useState } from 'react';
import { UserProfile } from '../types';
import { Waves, LogIn, Anchor, Microscope, ArrowLeft, Lock, Mail, ChevronDown } from 'lucide-react';

interface LoginViewProps {
  onLogin: (profile: Partial<UserProfile>) => void;
  onBackToLanding?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin, onBackToLanding }) => {
  const [email, setEmail] = useState('anya.sharma@orca-ocean.org');
  const [password, setPassword] = useState('••••••••••••');
  const [roleOption, setRoleOption] = useState<'researcher' | 'fisherman'>('researcher');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin({
      email: email,
      role: roleOption,
      name: roleOption === 'fisherman' ? 'Captain Rajesh Nair' : 'Dr. Anya Sharma',
      avatarUrl:
        roleOption === 'fisherman'
          ? 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80'
          : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
      vesselOrInstitution:
        roleOption === 'fisherman' ? 'Vizhinjam Fishing Cooperative #42' : 'National Institute of Ocean Technology',
    });
  };

  return (
    <div className="relative w-full max-w-md min-h-screen mx-auto flex flex-col justify-between overflow-x-hidden bg-[#fafaf7] text-[#22223b] shadow-2xl">
      {/* Top Gradient Header */}
      <div className="relative w-full h-[290px] primary-header-gradient flex flex-col items-center justify-start pt-10 pb-12 z-0 select-none overflow-hidden">
        <div className="header-radial-glow absolute inset-0 pointer-events-none" />

        {onBackToLanding && (
          <button
            onClick={onBackToLanding}
            className="absolute top-6 left-6 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-colors cursor-pointer border border-white/20 z-20"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}

        <div
          onClick={onBackToLanding}
          className="flex items-center gap-2.5 z-10 cursor-pointer group mt-2"
        >
          <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-xs group-hover:bg-white/20 transition-colors">
            <Waves className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-heading font-extrabold text-3xl tracking-tight text-white leading-none">
              ORCA
            </h1>
            <span className="text-[10px] tracking-wider uppercase text-white/75 font-mono">
              Ocean Intelligence
            </span>
          </div>
        </div>

        <p className="text-xs text-white/80 z-10 mt-2 font-medium">
          Conversational Oceanographic Intelligence
        </p>
      </div>

      {/* Main Login Card with Floating Shadow */}
      <main className="w-full px-6 -mt-36 z-10 flex-1">
        <div className="bg-[#ffffff] rounded-2xl p-6 floating-card-shadow w-full flex flex-col gap-4 border border-[#c2c6d1]/35">
          <div className="text-center">
            <h2 className="font-heading text-lg font-bold text-[#22223b]">
              Operator Sign In
            </h2>
            <p className="text-xs text-[#6b6b80] mt-0.5">
              Access real-time satellite telemetry and advisory agents
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="relative flex items-center">
              <Mail className="w-4 h-4 absolute left-3.5 text-[#6b6b80]" />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-full border border-[#c2c6d1]/50 bg-[#fafaf7] text-xs text-[#22223b] placeholder:text-[#6b6b80] focus:border-[#1a5490] focus:outline-hidden font-medium"
                placeholder="Operator email"
                type="email"
                required
              />
            </div>

            <div className="relative flex items-center">
              <Lock className="w-4 h-4 absolute left-3.5 text-[#6b6b80]" />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-full border border-[#c2c6d1]/50 bg-[#fafaf7] text-xs text-[#22223b] placeholder:text-[#6b6b80] focus:border-[#1a5490] focus:outline-hidden font-medium"
                placeholder="Password"
                type="password"
                required
              />
            </div>

            <div className="relative">
              <select
                value={roleOption}
                onChange={(e) => setRoleOption(e.target.value as 'researcher' | 'fisherman')}
                className="w-full px-4 py-2.5 rounded-full border border-[#c2c6d1]/50 bg-[#fafaf7] text-xs text-[#22223b] appearance-none focus:border-[#1a5490] focus:outline-hidden cursor-pointer font-medium"
              >
                <option value="researcher">Researcher / Coastal Authority</option>
                <option value="fisherman">Fisherman / Vessel Master</option>
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6b6b80] pointer-events-none" />
            </div>

            <button
              type="submit"
              className="w-full mt-2 py-2.5 rounded-full btn-primary-gradient text-white font-heading font-bold text-xs tracking-wider hover:opacity-95 transition-opacity cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
            >
              <LogIn className="w-4 h-4" />
              <span>Launch Platform</span>
            </button>
          </form>

          <div className="text-center flex flex-col items-center gap-1.5 pt-1">
            <button
              type="button"
              onClick={handleSubmit}
              className="text-[11px] text-[#6b6b80] hover:text-[#1a5490] transition-colors cursor-pointer font-medium"
            >
              Quick Test Sign In with Demo Credentials
            </button>
          </div>
        </div>
      </main>

      {/* Footer copyright */}
      <footer className="w-full py-4 text-center text-[10px] text-[#6b6b80] z-10 font-mono">
        ORCA • Copernicus Marine &amp; INCOIS Telemetry
      </footer>
    </div>
  );
};
