"use client";

import React, { useState } from "react";

interface AlertActionItem {
  id: number;
  stage: number;
  channel: string;
  target: string;
  result: string;
  message?: string;
  ts: string;
}

interface AlertItem {
  id: number;
  elder_id: number;
  type: string;
  severity: string;
  stage: number;
  status: string;
  created_ts: string;
  acknowledged_by?: string;
  note?: string;
  actions: AlertActionItem[];
}

interface AlertModalProps {
  alerts: AlertItem[];
  onAcknowledge: (alertId: number) => Promise<void>;
  onTriggerTest: () => Promise<void>;
}

export const AlertModal: React.FC<AlertModalProps> = ({
  alerts,
  onAcknowledge,
  onTriggerTest,
}) => {
  const [ackingId, setAckingId] = useState<number | null>(null);

  const activeAlerts = alerts.filter((a) => a.status === "active");

  const stageDescriptions = [
    { stage: 0, label: "Stage 0: Hub Local Alarm", desc: "Buzzer & OLED 'Are you OK?' (60s cancel window)" },
    { stage: 1, label: "Stage 1: Primary Caregiver", desc: "SMS & Voice call to primary emergency contact" },
    { stage: 2, label: "Stage 2: Secondary Contacts", desc: "Priority order fallback to family & doctor" },
    { stage: 3, label: "Stage 3: Emergency Services", desc: "Call 112 guidance & hospital dispatch" },
  ];

  const handleAck = async (id: number) => {
    setAckingId(id);
    try {
      await onAcknowledge(id);
    } finally {
      setAckingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span>Active Alerts & Escalation</span>
          {activeAlerts.length > 0 && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500 text-white animate-pulse">
              {activeAlerts.length} Active
            </span>
          )}
        </h2>

        <button
          onClick={onTriggerTest}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-600/80 hover:bg-violet-600 text-white border border-violet-400/40 transition-all flex items-center gap-1.5"
        >
          <span>⚡</span> Trigger Test Alert
        </button>
      </div>

      {activeAlerts.length === 0 ? (
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 text-slate-400 text-sm flex items-center gap-3">
          <span className="text-emerald-400 text-xl">✓</span>
          <span>No active emergency alerts at this time. All systems nominal.</span>
        </div>
      ) : (
        activeAlerts.map((alert) => (
          <div
            key={alert.id}
            className="rounded-xl border border-rose-500/40 bg-rose-950/20 p-5 backdrop-blur-sm space-y-4"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded text-xs font-black tracking-wider uppercase bg-rose-600 text-white">
                    {alert.type.replace("_", " ")}
                  </span>
                  <span className="text-xs text-slate-400">
                    Triggered at {new Date(alert.created_ts).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm text-slate-200 mt-1">{alert.note || "Immediate safety check requested."}</p>
              </div>

              <button
                onClick={() => handleAck(alert.id)}
                disabled={ackingId === alert.id}
                className="px-5 py-2.5 rounded-xl font-bold text-sm bg-emerald-500 hover:bg-emerald-400 text-emerald-950 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
              >
                {ackingId === alert.id ? "Acknowledging..." : "✓ Acknowledge & Stop Alert"}
              </button>
            </div>

            {/* Escalation Stage Progression Bar */}
            <div className="border-t border-white/10 pt-4">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Escalation State Machine (Current: Stage {alert.stage})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                {stageDescriptions.map((s) => {
                  const isPassed = alert.stage > s.stage;
                  const isCurrent = alert.stage === s.stage;
                  return (
                    <div
                      key={s.stage}
                      className={`p-3 rounded-lg border text-xs transition-all ${
                        isCurrent
                          ? "bg-amber-500/20 border-amber-500 text-amber-200 font-semibold ring-1 ring-amber-500"
                          : isPassed
                          ? "bg-rose-900/30 border-rose-800 text-rose-300 opacity-60"
                          : "bg-slate-900/40 border-slate-800 text-slate-500"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{s.label}</span>
                        {isPassed && <span>✓</span>}
                        {isCurrent && <span className="animate-ping text-amber-400">●</span>}
                      </div>
                      <p className="text-[10px] mt-1 opacity-80">{s.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Outbound Actions Log */}
            {alert.actions && alert.actions.length > 0 && (
              <div className="border-t border-white/5 pt-3">
                <span className="text-[11px] font-semibold text-slate-400">Transmitted Notifications:</span>
                <div className="mt-1 space-y-1">
                  {alert.actions.map((act) => (
                    <div
                      key={act.id}
                      className="text-xs font-mono bg-black/40 px-3 py-1.5 rounded border border-white/5 text-slate-300 flex items-center justify-between"
                    >
                      <span>
                        [{act.channel.toUpperCase()}] {act.target}: {act.message}
                      </span>
                      <span className="text-[10px] text-slate-400">{new Date(act.ts).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};
