"use client";

import React from "react";

interface StatusBannerProps {
  status: "green" | "yellow" | "red";
  elderName: string;
  awayMode: boolean;
  onToggleAway: () => void;
  activeAlertCount: number;
}

export const StatusBanner: React.FC<StatusBannerProps> = ({
  status,
  elderName,
  awayMode,
  onToggleAway,
  activeAlertCount,
}) => {
  const configs = {
    green: {
      bg: "bg-emerald-950/40 border-emerald-500/30 text-emerald-300",
      pill: "bg-emerald-500 text-emerald-950",
      title: "ALL NORMAL",
      subtitle: "Routine monitoring active. No safety alerts.",
      icon: "🛡️",
    },
    yellow: {
      bg: "bg-amber-950/40 border-amber-500/30 text-amber-300",
      pill: "bg-amber-500 text-amber-950",
      title: "ATTENTION NEEDED",
      subtitle: "Pending medicine reminder or hub offline check.",
      icon: "⚠️",
    },
    red: {
      bg: "bg-rose-950/60 border-rose-500/50 text-rose-200 animate-pulse",
      pill: "bg-rose-600 text-white font-black",
      title: "EMERGENCY ALERT ACTIVE",
      subtitle: `${activeAlertCount} active alert(s) requiring immediate attention!`,
      icon: "🚨",
    },
  };

  const current = configs[status] || configs.green;

  return (
    <div
      className={`rounded-2xl border p-6 transition-all duration-300 backdrop-blur-md shadow-2xl ${current.bg}`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="text-4xl p-3 bg-black/30 rounded-2xl border border-white/10">
            {current.icon}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-0.5 rounded-full text-xs tracking-wider uppercase font-bold ${current.pill}`}>
                {current.title}
              </span>
              {awayMode && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Away Mode Active
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold mt-1 text-white flex items-center gap-2">
              {elderName}
              <span className="text-sm font-normal text-slate-400">Home Safety Guard</span>
            </h1>
            <p className="text-sm mt-0.5 opacity-80">{current.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-center">
          <button
            onClick={onToggleAway}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold tracking-wide border transition-all ${
              awayMode
                ? "bg-blue-600 text-white border-blue-400 shadow-lg shadow-blue-600/30"
                : "bg-slate-800/80 text-slate-300 border-slate-700 hover:border-slate-500 hover:bg-slate-800"
            }`}
          >
            {awayMode ? "Disable Away Mode" : "Enable Away Mode"}
          </button>
        </div>
      </div>
    </div>
  );
};
