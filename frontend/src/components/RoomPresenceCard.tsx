"use client";

import React from "react";

interface RoomInfo {
  last_motion_ts: string | null;
  minutes_ago: number | null;
}

interface DeviceInfo {
  device_id: string | null;
  status: string;
  rssi: number | null;
  firmware: string | null;
  last_seen: string | null;
}

interface RoomPresenceProps {
  rooms: Record<string, RoomInfo>;
  device: DeviceInfo;
}

export const RoomPresenceCard: React.FC<RoomPresenceProps> = ({ rooms, device }) => {
  const formatTimeAgo = (mins: number | null) => {
    if (mins === null) return "No motion recorded today";
    if (mins === 0) return "Active just now (< 1 min)";
    if (mins < 60) return `Motion ${mins} min${mins === 1 ? "" : "s"} ago`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `Motion ${hrs}h ${remMins}m ago`;
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-md shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <span>🏠 Room Presence & Motion</span>
        </h3>
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              device.status === "online" ? "bg-emerald-400 animate-pulse" : "bg-rose-500"
            }`}
          />
          <span className="text-xs font-mono text-slate-300">
            Hub {device.status.toUpperCase()} ({device.rssi ? `${device.rssi} dBm` : "Offline"})
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Bedroom */}
        <div className="p-4 rounded-xl border border-slate-800 bg-black/20 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm text-slate-200">🛏️ Bedroom (PIR 1)</span>
            <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
              GPIO 27
            </span>
          </div>
          <p className="text-xs text-emerald-400 font-medium">
            {formatTimeAgo(rooms.bedroom?.minutes_ago ?? null)}
          </p>
        </div>

        {/* Living Room */}
        <div className="p-4 rounded-xl border border-slate-800 bg-black/20 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm text-slate-200">🛋️ Living Room (PIR 2)</span>
            <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
              GPIO 26
            </span>
          </div>
          <p className="text-xs text-emerald-400 font-medium">
            {formatTimeAgo(rooms.livingroom?.minutes_ago ?? null)}
          </p>
        </div>
      </div>

      <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/60">
        <span>Hardware: ESP32 DevKit V1</span>
        <span>Firmware: v{device.firmware || "1.0.0"}</span>
      </div>
    </div>
  );
};
