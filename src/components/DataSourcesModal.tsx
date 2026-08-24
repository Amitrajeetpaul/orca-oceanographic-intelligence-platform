import React from 'react';
import { motion } from 'motion/react';
import { X, Database, ExternalLink, CheckCircle2, Clock, Layers, Shield } from 'lucide-react';
import { DATA_SOURCES } from '../data/mockData';

interface DataSourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DataSourcesModal: React.FC<DataSourcesModalProps> = ({ isOpen, onClose }) => {
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
              <Database className="w-4 h-4 text-[#a4c9ff]" />
            </div>
            <div className="min-w-0">
              <h2 className="font-heading font-bold text-sm leading-tight text-white truncate">
                Data Transparency &amp; Sources
              </h2>
              <p className="text-[10px] text-white/80 font-mono truncate">
                Real, un-mocked public satellite &amp; buoy networks
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

        {/* Content body - scrollable and constrained with min-h-0 */}
        <div className="p-3.5 overflow-y-auto space-y-3 bg-[#fafaf7] flex-1 min-h-0 overscroll-contain">
          <div className="bg-[#e8f5e9] p-3 rounded-xl border border-[#2e7d32]/25 flex items-start gap-2.5">
            <Shield className="w-4 h-4 text-[#2e7d32] shrink-0 mt-0.5" />
            <p className="text-[11px] text-[#22223b] leading-relaxed">
              Every data feed integrated into ORCA is sourced directly from confirmed, open governmental and scientific oceanographic networks. No simulated or mock data is generated.
            </p>
          </div>

          <div className="space-y-3">
            {DATA_SOURCES.map((source) => (
              <div
                key={source.id}
                className="bg-[#ffffff] rounded-xl p-3 border border-[#c2c6d1]/40 shadow-2xs flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-heading text-xs font-bold text-[#1a5490] leading-tight">
                      {source.name}
                    </h3>
                    <p className="text-[10px] text-[#6b6b80] font-medium mt-0.5">
                      {source.agency}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold font-mono bg-[#e8f5e9] text-[#2e7d32] border border-[#2e7d32]/20 flex items-center gap-1 shrink-0">
                    <CheckCircle2 className="w-3 h-3" />
                    {source.apiStatus}
                  </span>
                </div>

                <p className="text-[11px] text-[#424750] leading-relaxed">
                  {source.description}
                </p>

                <div className="bg-[#fafaf7] rounded-lg p-2.5 border border-[#c2c6d1]/25 flex flex-col gap-1.5 text-[10px]">
                  <div className="flex items-start gap-1.5 text-[#6b6b80]">
                    <Layers className="w-3.5 h-3.5 text-[#1a5490] shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-[#22223b] mr-1">Parameters:</span>
                      <span className="text-[#424750]">{source.parameters.join(', ')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[#6b6b80]">
                    <Clock className="w-3.5 h-3.5 text-[#1a5490] shrink-0" />
                    <span className="font-semibold text-[#22223b]">Cadence:</span>
                    <span className="text-[#424750]">{source.refreshInterval}</span>
                  </div>
                </div>

                <div className="pt-1 flex items-center justify-between text-[9.5px] border-t border-[#c2c6d1]/20">
                  <span className="text-[#6b6b80] font-mono">{source.coverage}</span>
                  <a
                    href={source.portalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#1a5490] hover:text-[#0d2c4d] hover:underline font-semibold flex items-center gap-1"
                  >
                    <span>Portal Documentation</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#ffffff] border-t border-[#c2c6d1]/30 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-1.5 rounded-full btn-primary-gradient text-white text-xs font-heading font-bold cursor-pointer shadow-xs active:scale-95 transition-transform"
          >
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
};
