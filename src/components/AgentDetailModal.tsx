import React from 'react';
import { motion } from 'motion/react';
import { X, Thermometer, Leaf, Wind, CheckCircle2, AlertCircle, ExternalLink, ShieldCheck, Sparkles } from 'lucide-react';
import { AgentFinding } from '../types';

interface AgentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  findings: AgentFinding[];
  queryText?: string;
  synthesisSummary?: string;
}

export const AgentDetailModal: React.FC<AgentDetailModalProps> = ({
  isOpen,
  onClose,
  findings,
  queryText = 'Where is the nearest good fishing zone today?',
  synthesisSummary,
}) => {
  if (!isOpen) return null;

  const warningCount = findings.filter((f) => f.status === 'warning').length;
  const avgConfidence = findings.length
    ? Math.round(findings.reduce((sum, f) => sum + f.confidence, 0) / findings.length)
    : 0;
  const consensusSummary =
    warningCount > 0
      ? `${warningCount} of ${findings.length} agents flagged low confidence or unavailable data — treat this answer as partial, not a full consensus.`
      : `All ${findings.length} agents reported live data at ${avgConfidence}% average confidence with no flags raised.`;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[2000] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[#ffffff] rounded-2xl shadow-2xl border border-[#c2c6d1]/40 overflow-hidden flex flex-col max-h-[85vh] my-auto"
      >
        {/* Header with primary gradient */}
        <div className="primary-header-gradient p-3.5 sm:p-4 text-white flex justify-between items-center relative overflow-hidden shrink-0">
          <div className="header-radial-glow absolute inset-0 pointer-events-none" />
          <div className="z-10 flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shrink-0">
              <Sparkles className="w-4 h-4 text-[#a4c9ff]" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-sm leading-tight text-white">
                Multi-Agent Inspection Matrix
              </h2>
              <p className="text-[10px] text-white/80 font-mono">
                Individual raw agent telemetry before orchestrator synthesis
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            className="z-10 p-1.5 rounded-full hover:bg-white/15 text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content body */}
        <div className="p-3.5 sm:p-4 overflow-y-auto space-y-3.5 bg-[#fafaf7] flex-1 overscroll-contain">
          {/* Query context card */}
          <div className="bg-[#ffffff] p-3 rounded-xl border border-[#c2c6d1]/30 shadow-2xs">
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#6b6b80] font-heading block mb-0.5">
              Target Query
            </span>
            <p className="text-xs font-medium text-[#22223b]">"{queryText}"</p>
          </div>

          {/* Individual Agent Cards */}
          <div className="space-y-3">
            {findings.map((finding, idx) => {
              const isTemp = finding.type === 'temp';
              const isChloro = finding.type === 'chlorophyll';
              const isWeather = finding.type === 'weather';

              return (
                <div
                  key={idx}
                  className="bg-[#ffffff] rounded-xl p-3.5 border border-[#c2c6d1]/40 shadow-2xs flex flex-col gap-2 relative overflow-hidden"
                >
                  {/* Status strip top accent */}
                  <div
                    className={`absolute top-0 left-0 right-0 h-1 ${
                      isTemp ? 'bg-[#1a5490]' : isChloro ? 'bg-[#2e7d32]' : 'bg-[#b36b00]'
                    }`}
                  />

                  {/* Agent Header */}
                  <div className="flex items-start justify-between gap-2 pt-0.5">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isTemp
                            ? 'bg-[#1a5490]/10 text-[#1a5490]'
                            : isChloro
                            ? 'bg-[#2e7d32]/10 text-[#2e7d32]'
                            : 'bg-[#b36b00]/10 text-[#b36b00]'
                        }`}
                      >
                        {isTemp && <Thermometer className="w-4 h-4" />}
                        {isChloro && <Leaf className="w-4 h-4" />}
                        {isWeather && <Wind className="w-4 h-4" />}
                      </div>
                      <div>
                        <h3 className="font-heading text-xs font-bold text-[#22223b]">
                          {finding.agentName}
                        </h3>
                        <p className="text-[9px] text-[#6b6b80] font-mono">
                          {finding.sourceName}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold font-mono bg-[#e8f5e9] text-[#2e7d32] border border-[#2e7d32]/20 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {finding.confidence}% Conf.
                      </span>
                    </div>
                  </div>

                  {/* Telemetry Metric Value */}
                  <div className="bg-[#fafaf7] rounded-lg p-2 border border-[#c2c6d1]/25 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-[#6b6b80] block font-mono">
                        {finding.metric}
                      </span>
                      <span className="text-xs font-bold text-[#1a5490] font-mono">
                        {finding.value}
                      </span>
                    </div>
                    <span className="text-[9px] text-[#6b6b80] font-mono">
                      {finding.timestamp}
                    </span>
                  </div>

                  {/* Raw Findings text */}
                  <p className="text-[11px] text-[#424750] leading-relaxed">
                    {finding.rawFindings}
                  </p>

                  {/* Source link */}
                  <div className="pt-1 flex items-center justify-between text-[9px] text-[#6b6b80] border-t border-[#c2c6d1]/20">
                    <span className="font-mono">Real-time Public Feed</span>
                    <a
                      href={finding.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#1a5490] hover:underline font-semibold flex items-center gap-0.5"
                    >
                      <span>Official Portal</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Orchestrator synthesis badge */}
          <div className="p-3 rounded-xl bg-gradient-to-br from-[#1a5490]/10 to-[#123c68]/5 border border-[#1a5490]/20 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-[#1a5490] shrink-0 mt-0.5" />
            <div className="text-[11px] text-[#22223b] leading-relaxed">
              <span className="font-bold text-[#1a5490] block font-heading">
                Orchestrator Consensus Verification
              </span>
              {consensusSummary}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#ffffff] border-t border-[#c2c6d1]/30 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-full btn-primary-gradient text-white text-xs font-heading font-semibold cursor-pointer"
          >
            Close Inspector
          </button>
        </div>
      </motion.div>
    </div>
  );
};
