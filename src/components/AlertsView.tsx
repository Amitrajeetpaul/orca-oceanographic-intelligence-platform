import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Bell,
  History,
  AlertTriangle,
  Wind,
  Anchor,
  Info,
  CheckCircle2,
  Search,
  ExternalLink,
  Filter,
  Download,
  Sparkles,
} from 'lucide-react';
import { INITIAL_ALERTS, INITIAL_CHAT_MESSAGES } from '../data/mockData';
import { CoastalAlert, ChatMessage } from '../types';

interface AlertsViewProps {
  onNavigateToHome?: () => void;
}

export const AlertsView: React.FC<AlertsViewProps> = ({ onNavigateToHome }) => {
  const [subTab, setSubTab] = useState<'notifications' | 'history'>('notifications');
  const [selectedAlert, setSelectedAlert] = useState<string | null>(null);
  const [historySearch, setHistorySearch] = useState('');
  const [alerts, setAlerts] = useState<CoastalAlert[]>(INITIAL_ALERTS);

  const filteredHistory = INITIAL_CHAT_MESSAGES.filter(
    (msg) =>
      msg.text.toLowerCase().includes(historySearch.toLowerCase()) ||
      (msg.source && msg.source.toLowerCase().includes(historySearch.toLowerCase()))
  );

  return (
    <main className="w-full px-4 -mt-36 z-10 flex-1 flex flex-col gap-3.5 pb-24">
      {/* Sub-Tab Selector */}
      <div className="bg-[#ffffff] rounded-2xl p-1 flex gap-1 border border-[#c2c6d1]/35 shadow-sm">
        <button
          onClick={() => setSubTab('notifications')}
          className={`flex-1 py-2 rounded-xl text-xs font-heading font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            subTab === 'notifications'
              ? 'btn-primary-gradient text-white'
              : 'text-[#6b6b80] hover:text-[#22223b]'
          }`}
        >
          <Bell className="w-3.5 h-3.5" />
          <span>Live Notifications ({alerts.length})</span>
        </button>

        <button
          onClick={() => setSubTab('history')}
          className={`flex-1 py-2 rounded-xl text-xs font-heading font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            subTab === 'history'
              ? 'btn-primary-gradient text-white'
              : 'text-[#6b6b80] hover:text-[#22223b]'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Chat &amp; Query History</span>
        </button>
      </div>

      {/* Sub-Tab 1: Notifications */}
      {subTab === 'notifications' && (
        <div className="bg-[#ffffff] rounded-2xl floating-card-shadow border border-[#c2c6d1]/35 overflow-hidden flex flex-col">
          {/* Live Feed Header */}
          <div className="px-4 py-3 border-b border-[#fafaf7] flex justify-between items-center bg-[#fafaf7]/50">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#c62828] animate-ping" />
              <h3 className="font-heading text-xs font-bold text-[#1a5490]">
                Coastal Hazard Feed
              </h3>
            </div>
            <span className="text-[9px] font-mono font-bold text-[#6b6b80] uppercase">
              Auto-Refresh Active
            </span>
          </div>

          {/* Alert List Rows */}
          <div className="divide-y divide-[#c2c6d1]/20">
            {alerts.map((alert) => {
              const isDanger = alert.severity === 'High' || alert.type === 'danger';
              const isWarning = alert.severity === 'Moderate' || alert.type === 'warning';
              const isSuccess = alert.type === 'success';

              return (
                <div
                  key={alert.id}
                  onClick={() => setSelectedAlert(selectedAlert === alert.id ? null : alert.id)}
                  className="p-3.5 hover:bg-[#fafaf7] transition-colors flex gap-3 items-start cursor-pointer group"
                >
                  {/* Rounded-square icon badge (12px radius) matching status gradient */}
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                      isDanger
                        ? 'status-badge-danger'
                        : isWarning
                        ? 'status-badge-warning'
                        : isSuccess
                        ? 'status-badge-success'
                        : 'status-badge-info'
                    }`}
                  >
                    {isDanger && <AlertTriangle className="w-4 h-4" />}
                    {isWarning && <Wind className="w-4 h-4" />}
                    {isSuccess && <Anchor className="w-4 h-4" />}
                    {!isDanger && !isWarning && !isSuccess && <Info className="w-4 h-4" />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 flex flex-col gap-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="font-heading text-xs font-bold text-[#22223b] leading-tight">
                        {alert.title}
                      </h4>
                      <span
                        className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          isDanger
                            ? 'status-badge-danger'
                            : isWarning
                            ? 'status-badge-warning'
                            : isSuccess
                            ? 'status-badge-success'
                            : 'status-badge-info'
                        }`}
                      >
                        {alert.timeAgo}
                      </span>
                    </div>

                    <p className="text-[11px] text-[#424750] leading-relaxed">
                      {alert.description}
                    </p>

                    <div className="flex items-center gap-2 mt-0.5 text-[9px] text-[#6b6b80] font-mono">
                      <span>{alert.location}</span>
                      {alert.meta && (
                        <>
                          <span>•</span>
                          <span className={isDanger ? 'text-[#c62828] font-bold' : ''}>
                            {alert.meta}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Expandable Action Advisory */}
                    {selectedAlert === alert.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-2 pt-2 border-t border-[#c2c6d1]/20 flex flex-col gap-2"
                      >
                        {alert.actionAdvice && (
                          <div className="p-2.5 rounded-xl bg-[#fafaf7] border border-[#c2c6d1]/25 text-[10px] text-[#22223b]">
                            <span className="font-bold text-[#1a5490] block mb-0.5">
                              Recommended Action:
                            </span>
                            {alert.actionAdvice}
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[9px] text-[#6b6b80] font-mono">
                            {alert.source || 'INCOIS Official Bulletin'}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onNavigateToHome) onNavigateToHome();
                            }}
                            className="px-3 py-1 rounded-full btn-primary-gradient text-white text-[10px] font-heading font-semibold cursor-pointer"
                          >
                            Inspect Coordinates on Map
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sub-Tab 2: Chat & Query History */}
      {subTab === 'history' && (
        <div className="bg-[#ffffff] rounded-2xl floating-card-shadow border border-[#c2c6d1]/35 overflow-hidden flex flex-col gap-3 p-4">
          {/* Search bar */}
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 absolute left-3 text-[#6b6b80]" />
            <input
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Search past queries or parameters..."
              className="w-full bg-[#fafaf7] border border-[#c2c6d1]/50 focus:border-[#1a5490] text-[#22223b] placeholder:text-[#6b6b80] rounded-full py-2 pl-8 pr-3 text-xs focus:outline-hidden"
            />
          </div>

          {/* History List Rows */}
          <div className="space-y-3">
            {filteredHistory.map((item) => (
              <div
                key={item.id}
                className="bg-[#fafaf7] rounded-xl p-3.5 border border-[#c2c6d1]/30 flex flex-col gap-2"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-[#e8f0fe] text-[#1a5490] flex items-center justify-center text-xs font-bold shrink-0">
                      Q
                    </div>
                    <h4 className="font-heading text-xs font-bold text-[#22223b]">
                      "{item.text}"
                    </h4>
                  </div>
                  <span className="text-[9px] font-mono text-[#6b6b80] shrink-0">
                    {item.timestamp}
                  </span>
                </div>

                {item.pfzDetails && (
                  <div className="bg-[#ffffff] rounded-lg p-2 border border-[#c2c6d1]/20 flex items-center justify-between text-[10px]">
                    <span className="text-[#6b6b80]">
                      PFZ Target: <strong>{item.pfzDetails.distance}</strong>
                    </span>
                    <span className="font-mono font-bold text-[#2e7d32]">
                      SST: {item.pfzDetails.sst} • Chl: {item.pfzDetails.chlorophyll}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1 border-t border-[#c2c6d1]/20 text-[9px]">
                  <span className="text-[#6b6b80] font-mono">{item.source}</span>
                  <button
                    onClick={() => {
                      if (onNavigateToHome) onNavigateToHome();
                    }}
                    className="text-[#1a5490] hover:underline font-bold font-heading cursor-pointer flex items-center gap-1"
                  >
                    <span>Re-open on Map</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
};
