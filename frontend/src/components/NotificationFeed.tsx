"use client";

import React from "react";

interface NotificationItem {
  type: string;
  to: string;
  message: string;
  status: string;
  ts: string;
}

interface NotificationFeedProps {
  notifications: NotificationItem[];
}

export const NotificationFeed: React.FC<NotificationFeedProps> = ({ notifications }) => {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-md shadow-xl space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <span>📡 Outbound Alert Transmission Feed</span>
        </h3>
        <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-violet-500/20 text-violet-300 border border-violet-500/30">
          Live Mock / Twilio / MSG91
        </span>
      </div>

      <p className="text-xs text-slate-400">
        Simulated and live SMS/Voice call dispatches triggered by the Suyog AI escalation engine:
      </p>

      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
        {notifications.length === 0 ? (
          <p className="text-xs text-slate-500 p-3 bg-black/20 rounded-xl">No notifications dispatched yet.</p>
        ) : (
          notifications.map((n, i) => (
            <div
              key={i}
              className="p-3 rounded-xl border border-slate-800 bg-black/40 text-xs space-y-1 font-mono"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-400">
                  {n.type === "SMS" ? "📱 SMS" : "📞 VOICE CALL"} ➔ {n.to}
                </span>
                <span className="text-[10px] text-slate-400">
                  {new Date(n.ts).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-slate-300 font-sans text-xs whitespace-pre-wrap">{n.message}</p>
              <div className="text-[10px] text-emerald-400 font-semibold">{n.status}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
