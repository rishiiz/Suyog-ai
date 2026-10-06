"use client";

import React, { useState } from "react";

interface MedicineLogItem {
  id: number;
  medicine_name: string;
  dosage: string;
  due_ts: string;
  status: string;
  confirmed_ts: string | null;
  method: string | null;
  compartment: number;
}

interface AdherenceStats {
  today_adherence_pct: number;
  today_total_doses: number;
  today_taken_doses: number;
  week_adherence_pct: number;
  week_total_doses: number;
  week_taken_doses: number;
}

interface MedicineCardProps {
  logs: MedicineLogItem[];
  adherence: AdherenceStats | null;
  onConfirm: (logId: number) => Promise<void>;
}

export const MedicineCard: React.FC<MedicineCardProps> = ({ logs, adherence, onConfirm }) => {
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  const handleConfirm = async (id: number) => {
    setConfirmingId(id);
    try {
      await onConfirm(id);
    } finally {
      setConfirmingId(null);
    }
  };

  const statusBadge = (status: string) => {
    if (status === "taken")
      return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">TAKEN</span>;
    if (status === "late")
      return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">TAKEN LATE</span>;
    if (status === "missed")
      return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">MISSED</span>;
    return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 animate-pulse">PENDING</span>;
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-md shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <span>💊 Medicine Schedule & Confirmation</span>
        </h3>
        {adherence && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Today's Adherence:</span>
            <span className="px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {adherence.today_adherence_pct}%
            </span>
          </div>
        )}
      </div>

      <div className="space-y-2.5">
        {logs.length === 0 ? (
          <p className="text-xs text-slate-400 p-3 bg-black/20 rounded-xl">No scheduled doses logged yet today.</p>
        ) : (
          logs.slice(0, 4).map((log) => (
            <div
              key={log.id}
              className="p-3.5 rounded-xl border border-slate-800 bg-black/30 flex items-center justify-between gap-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-white">{log.medicine_name}</span>
                  <span className="text-xs text-slate-400">({log.dosage})</span>
                  {statusBadge(log.status)}
                </div>
                <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-3">
                  <span>Scheduled: {new Date(log.due_ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  <span>Box Lid: #{log.compartment}</span>
                  {log.method && <span>Confirmed via: {log.method}</span>}
                </div>
              </div>

              {log.status === "pending" && (
                <button
                  onClick={() => handleConfirm(log.id)}
                  disabled={confirmingId === log.id}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all disabled:opacity-50"
                >
                  {confirmingId === log.id ? "Confirming..." : "Confirm Intake"}
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
        <span>Dual Confirmation: Green Button (Hub) or Pill-box Lid (Reed Switch)</span>
        <span className="text-emerald-400">Auto-synced</span>
      </div>
    </div>
  );
};
