import React from 'react';
import { motion } from 'motion/react';
import { X, Network, Cpu, Database, ShieldCheck, ArrowDown, Server, Radio, FileText, CheckCircle } from 'lucide-react';

interface ArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ArchitectureModal: React.FC<ArchitectureModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-xs"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[#ffffff] rounded-2xl shadow-2xl border border-[#c2c6d1]/45 overflow-hidden flex flex-col max-h-[86vh]"
      >
        {/* Header with primary gradient */}
        <div className="primary-header-gradient p-3.5 text-white flex justify-between items-center relative overflow-hidden shrink-0">
          <div className="header-radial-glow absolute inset-0 pointer-events-none" />
          <div className="z-10 flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/25 shrink-0 shadow-2xs">
              <Network className="w-4 h-4 text-[#a4c9ff]" />
            </div>
            <div className="min-w-0">
              <h2 className="font-heading font-bold text-sm leading-tight text-white truncate">
                Technical Architecture &amp; Pipeline
              </h2>
              <p className="text-[10px] text-white/80 font-mono truncate">
                Multi-Agent Orchestration Blueprint
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="z-10 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white transition-colors flex items-center justify-center cursor-pointer shrink-0 ml-2 border border-white/15"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content body */}
        <div className="p-3.5 overflow-y-auto space-y-3.5 bg-[#fafaf7] flex-1 min-h-0 overscroll-contain">
          {/* Architecture flow diagram */}
          <div className="bg-[#ffffff] p-3.5 rounded-xl border border-[#c2c6d1]/40 shadow-2xs space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#1a5490] font-heading block">
              Collaborative Multi-Agent Pipeline
            </span>

            {/* Step 1: User Query */}
            <div className="p-2 rounded-lg bg-[#fafaf7] border border-[#c2c6d1]/30 flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-[#1a5490] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                1
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-bold text-[#22223b] block">
                  Plain-Language User Query
                </span>
                <span className="text-[9px] text-[#6b6b80] font-mono block truncate">
                  e.g. "Where is the nearest good fishing zone today?"
                </span>
              </div>
            </div>

            <div className="flex justify-center text-[#1a5490]">
              <ArrowDown className="w-3.5 h-3.5" />
            </div>

            {/* Step 2: Agent Orchestrator */}
            <div className="p-2 rounded-lg bg-[#fafaf7] border border-[#c2c6d1]/30 flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-[#1a5490] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                2
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-bold text-[#22223b] block">
                  Agent Orchestrator (Intent Parser)
                </span>
                <span className="text-[9px] text-[#6b6b80] block leading-tight">
                  Analyzes query intent, identifies region coordinates, and dispatches tasks to specialized agents in parallel.
                </span>
              </div>
            </div>

            <div className="flex justify-center text-[#1a5490]">
              <ArrowDown className="w-3.5 h-3.5" />
            </div>

            {/* Step 3: 3 Specialized Agents */}
            <div className="grid grid-cols-3 gap-1.5 text-center">
              <div className="p-2 rounded-lg bg-[#e8f0fe] border border-[#1a5490]/25 flex flex-col items-center gap-1">
                <Radio className="w-3.5 h-3.5 text-[#1a5490]" />
                <span className="text-[10px] font-bold text-[#1a5490]">Temperature</span>
                <span className="text-[8px] text-[#6b6b80]">Copernicus SST</span>
              </div>

              <div className="p-2 rounded-lg bg-[#e8f5e9] border border-[#2e7d32]/25 flex flex-col items-center gap-1">
                <Database className="w-3.5 h-3.5 text-[#2e7d32]" />
                <span className="text-[10px] font-bold text-[#2e7d32]">Chlorophyll</span>
                <span className="text-[8px] text-[#6b6b80]">INCOIS PFZ Feed</span>
              </div>

              <div className="p-2 rounded-lg bg-[#fff3e0] border border-[#b36b00]/25 flex flex-col items-center gap-1">
                <Cpu className="w-3.5 h-3.5 text-[#b36b00]" />
                <span className="text-[10px] font-bold text-[#b36b00]">Weather</span>
                <span className="text-[8px] text-[#6b6b80]">Marine Forecast</span>
              </div>
            </div>

            <div className="flex justify-center text-[#1a5490]">
              <ArrowDown className="w-3.5 h-3.5" />
            </div>

            {/* Step 4: Explainable Consensus & UI Reaction */}
            <div className="p-2 rounded-lg bg-[#e8f5e9] border border-[#2e7d32]/30 flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-[#2e7d32] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                4
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-bold text-[#22223b] block">
                  Consensus Merging &amp; Sync
                </span>
                <span className="text-[9px] text-[#424750] block leading-tight">
                  Synthesizes evidence-backed answer with source citations. Highlights map coordinates and renders route hazard zones.
                </span>
              </div>
            </div>
          </div>

          {/* System Specs and Guarantees */}
          <div className="bg-[#ffffff] p-3.5 rounded-xl border border-[#c2c6d1]/40 shadow-2xs space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#1a5490] font-heading block">
              Core Technical Guarantees
            </span>

            <div className="space-y-1.5 text-[11px] text-[#424750]">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-[#2e7d32] shrink-0 mt-0.5" />
                <span><strong>No Mock Data:</strong> Telemetry is ingested from confirmed public APIs and satellite rasters.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-[#2e7d32] shrink-0 mt-0.5" />
                <span><strong>Smart Caching:</strong> Regional rasters are cached locally and refreshed every 3 hours.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-[#2e7d32] shrink-0 mt-0.5" />
                <span><strong>Confidence Handling:</strong> Cloud cover degradation flags caution rather than guessing.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#ffffff] border-t border-[#c2c6d1]/30 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-1.5 rounded-full btn-primary-gradient text-white text-xs font-heading font-bold cursor-pointer shadow-xs active:scale-95 transition-transform"
          >
            Got it
          </button>
        </div>
      </motion.div>
    </div>
  );
};
