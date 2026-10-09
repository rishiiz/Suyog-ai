"use client";

import React, { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import { AlertBellPopover } from "@/components/AlertBellPopover";
import { api } from "@/lib/api";

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
  acknowledged_ts?: string;
  resolved_ts?: string;
  note?: string;
  actions: AlertActionItem[];
}

interface NotificationItem {
  id?: string;
  timestamp: string;
  type: "sms" | "voice";
  recipient: string;
  message: string;
  status: string;
}

export default function AlertsPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeElderId, setActiveElderId] = useState<number | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [ackingId, setAckingId] = useState<number | null>(null);
  const [testing, setTesting] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "resolved">("active");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function loadData() {
    try {
      const me = await api.getMe().catch(() => null);
      setCurrentUser(me);

      const simFlag = typeof window !== "undefined" && localStorage.getItem("suyog_simulation_mode") === "true";
      let targetId: number | null = null;

      if (me?.elders && me.elders.length > 0) {
        targetId = me.elders[0].id;
      } else if (me?.is_demo || simFlag) {
        targetId = 1;
      }

      setActiveElderId(targetId);

      if (targetId) {
        const [alertsData, notifsData] = await Promise.all([
          api.getAlerts(targetId).catch(() => []),
          api.getLiveNotifications().catch(() => []),
        ]);
        setAlerts(alertsData || []);
        setNotifications(notifsData || []);
      } else {
        setAlerts([]);
        setNotifications([]);
      }
    } catch (err) {
      console.error("Error loading alerts:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5_000);
    return () => clearInterval(interval);
  }, []);

  const handleAcknowledge = async (alertId: number) => {
    setAckingId(alertId);
    try {
      await api.acknowledgeAlert(alertId, currentUser?.name || "Caregiver");
      // Immediately remove from active alerts list
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
      setMsg({ type: "success", text: "Alert acknowledged and removed from active list!" });
      setTimeout(() => setMsg(null), 4000);
      await loadData();
    } catch (err) {
      setMsg({ type: "error", text: "Failed to acknowledge alert. Please try again." });
    } finally {
      setAckingId(null);
    }
  };

  const handleClearAll = async () => {
    if (!activeElderId) return;
    try {
      await api.clearAllAlerts(activeElderId);
      setAlerts([]);
      setMsg({ type: "success", text: "All alerts cleared successfully." });
      setTimeout(() => setMsg(null), 4000);
      await loadData();
    } catch (err) {
      setMsg({ type: "error", text: "Failed to clear alerts." });
    }
  };

  const handleTriggerTest = async (testType: string = "panic") => {
    setTesting(true);
    try {
      await api.triggerTestAlert(1, testType);
      setMsg({
        type: "success",
        text: `Test Alert (${testType}) triggered. Check the notification feed below for outgoing SMS/Voice calls.`,
      });
      setTimeout(() => setMsg(null), 5000);
      await loadData();
    } catch (err) {
      setMsg({ type: "error", text: "Failed to trigger test alert." });
    } finally {
      setTesting(false);
    }
  };

  const activeAlerts = alerts.filter((a) => a.status === "active");
  const filteredAlerts = alerts.filter((a) => {
    if (filter === "active") return a.status === "active";
    if (filter === "resolved") return a.status !== "active";
    return true;
  });

  const getSeverityBadge = (severity: string) => {
    const sev = severity.toLowerCase();
    if (sev === "critical")
      return <span style={{ ...s.badge, backgroundColor: "#fee2e2", color: "#dc2626" }}>CRITICAL</span>;
    if (sev === "high")
      return <span style={{ ...s.badge, backgroundColor: "#ffedd5", color: "#c2410c" }}>HIGH</span>;
    if (sev === "medium")
      return <span style={{ ...s.badge, backgroundColor: "#fef9c3", color: "#854d0e" }}>MEDIUM</span>;
    return <span style={{ ...s.badge, backgroundColor: "#f1f5f9", color: "#475569" }}>LOW</span>;
  };

  const getStageBadge = (stage: number) => {
    switch (stage) {
      case 0:
        return <span style={{ ...s.stageBadge, backgroundColor: "#e0f2fe", color: "#0369a1" }}>Stage 0: Hub Buzzer (0-60s)</span>;
      case 1:
        return <span style={{ ...s.stageBadge, backgroundColor: "#ffedd5", color: "#c2410c" }}>Stage 1: Primary SMS & Call</span>;
      case 2:
        return <span style={{ ...s.stageBadge, backgroundColor: "#fef3c7", color: "#b45309" }}>Stage 2: Secondary Contacts</span>;
      case 3:
        return <span style={{ ...s.stageBadge, backgroundColor: "#fee2e2", color: "#dc2626" }}>Stage 3: 112 Dispatch Call</span>;
      default:
        return <span style={{ ...s.stageBadge, backgroundColor: "#f1f5f9", color: "#64748b" }}>Stage {stage}</span>;
    }
  };

  return (
    <div style={s.page}>
      <Sidebar activeTab="alerts" alertCount={activeAlerts.length} />

      <main style={s.main}>
        {/* Header */}
        <header style={s.header}>
          <div>
            <h1 style={s.pageTitle}>Alerts & Staged Escalation Engine</h1>
            <p style={s.pageSubtitle}>
              Multi-tiered safety protocol with automatic fall-through escalation and 1-click caregiver acknowledgement
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button
              style={s.testBtn}
              onClick={() => handleTriggerTest("panic")}
              disabled={testing}
            >
              {testing ? "Triggering..." : "⚡ Trigger Test Alert"}
            </button>
            <AlertBellPopover />
            <UserProfileMenu />
          </div>
        </header>

        {msg && (
          <div
            style={{
              ...s.msgBanner,
              backgroundColor: msg.type === "success" ? "#f0fdf4" : "#fef2f2",
              borderColor: msg.type === "success" ? "#bbf7d0" : "#fecaca",
              color: msg.type === "success" ? "#166534" : "#991b1b",
            }}
          >
            {msg.text}
          </div>
        )}

        {/* Stats Row */}
        <div style={s.statsRow}>
          <div style={s.statCard}>
            <div style={s.statLabel}>Active Alerts</div>
            <div style={{ ...s.statValue, color: activeAlerts.length > 0 ? "#dc2626" : "#16a34a" }}>
              {activeAlerts.length}
            </div>
            <div style={s.statSub}>
              {activeAlerts.length > 0 ? "Requires acknowledgement" : "All systems normal"}
            </div>
          </div>

          <div style={s.statCard}>
            <div style={s.statLabel}>Current Escalation Stage</div>
            <div style={{ ...s.statValue, color: activeAlerts.length > 0 ? "#ea580c" : "#64748b" }}>
              {activeAlerts.length > 0 ? `Stage ${Math.max(...activeAlerts.map((a) => a.stage))}` : "None"}
            </div>
            <div style={s.statSub}>Max level reached</div>
          </div>

          <div style={s.statCard}>
            <div style={s.statLabel}>Total Resolved Alerts</div>
            <div style={{ ...s.statValue, color: "#2563eb" }}>
              {alerts.filter((a) => a.status !== "active").length}
            </div>
            <div style={s.statSub}>Successfully handled</div>
          </div>

          <div style={s.statCard}>
            <div style={s.statLabel}>Notification Channels</div>
            <div style={{ ...s.statValue, color: "#0891b2" }}>SMS + Voice</div>
            <div style={s.statSub}>Twilio / Mock fallback</div>
          </div>
        </div>

        {/* Escalation Pipeline Visual Banner */}
        <div style={s.pipelineContainer}>
          <div style={s.pipelineTitle}>Staged Escalation Flow</div>
          <div style={s.pipelineStages}>
            <div style={s.pipelineStep}>
              <div style={s.stepNum}>0</div>
              <div style={s.stepName}>Local Alarm (0-60s)</div>
              <div style={s.stepDesc}>Hub buzzer & screen "Are you OK?"</div>
            </div>
            <div style={s.pipelineArrow}>➔</div>
            <div style={s.pipelineStep}>
              <div style={s.stepNum}>1</div>
              <div style={s.stepName}>Primary Caregiver</div>
              <div style={s.stepDesc}>Automated SMS & Phone Call</div>
            </div>
            <div style={s.pipelineArrow}>➔</div>
            <div style={s.pipelineStep}>
              <div style={s.stepNum}>2</div>
              <div style={s.stepName}>Secondary Contacts</div>
              <div style={s.stepDesc}>Family members & doctor escalation</div>
            </div>
            <div style={s.pipelineArrow}>➔</div>
            <div style={s.pipelineStep}>
              <div style={s.stepNum}>3</div>
              <div style={s.stepName}>Emergency 112</div>
              <div style={s.stepDesc}>Address & hospital guidance SMS</div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={s.contentGrid}>
          {/* Alerts List */}
          <section style={s.card}>
            <div style={s.cardHeader}>
              <div>
                <h2 style={s.cardTitle}>Alert History & Live Queue ({filteredAlerts.length})</h2>
                <p style={s.cardSub}>Review alerts and take emergency actions</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {activeAlerts.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    style={{
                      backgroundColor: "#fee2e2",
                      color: "#dc2626",
                      border: "1px solid #fecaca",
                      borderRadius: 8,
                      padding: "6px 14px",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Clear All Active Alerts
                  </button>
                )}
                <div style={s.filterTabs}>
                  {(["active", "resolved", "all"] as const).map((tab) => (
                    <button
                      key={tab}
                      style={{
                        ...s.filterBtn,
                        ...(filter === tab ? s.filterBtnActive : {}),
                      }}
                      onClick={() => setFilter(tab)}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {loading ? (
              <div style={s.emptyState}>Loading alerts...</div>
            ) : filteredAlerts.length === 0 ? (
              <div style={s.emptyState}>
                <div style={{ fontSize: 28, color: "#16a34a", marginBottom: 8 }}>✓</div>
                <div style={s.emptyTitle}>No alerts matching filter</div>
                <div style={s.emptyDesc}>
                  Click "⚡ Trigger Test Alert" to test the escalation pipeline and send mock SMS/voice calls.
                </div>
              </div>
            ) : (
              <div style={s.alertList}>
                {filteredAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    style={{
                      ...s.alertCard,
                      borderLeft:
                        alert.status === "active"
                          ? "4px solid #dc2626"
                          : "4px solid #cbd5e1",
                    }}
                  >
                    <div style={s.alertCardHeader}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {getSeverityBadge(alert.severity)}
                        <span style={s.alertTypeTitle}>
                          {alert.type.toUpperCase()} ALARM
                        </span>
                        {getStageBadge(alert.stage)}
                      </div>
                      <span style={{ fontSize: 12, color: "#94a3b8" }}>
                        {new Date(alert.created_ts).toLocaleTimeString()}
                      </span>
                    </div>

                    <div style={s.alertNote}>{alert.note || "No specific note provided"}</div>

                    {alert.status === "active" && (
                      <div style={s.actionRow}>
                        <button
                          style={s.ackBtn}
                          disabled={ackingId === alert.id}
                          onClick={() => handleAcknowledge(alert.id)}
                        >
                          {ackingId === alert.id ? "Stopping Escalation..." : "✓ Acknowledge (Stop Escalation)"}
                        </button>
                      </div>
                    )}

                    {alert.acknowledged_by && (
                      <div style={s.ackInfo}>
                        ✓ Acknowledged by <strong>{alert.acknowledged_by}</strong>
                        {alert.acknowledged_ts && ` at ${new Date(alert.acknowledged_ts).toLocaleTimeString()}`}
                      </div>
                    )}

                    {/* Action audit trail */}
                    {alert.actions && alert.actions.length > 0 && (
                      <div style={s.actionsAuditBox}>
                        <div style={s.actionsAuditTitle}>Escalation Audit Trail:</div>
                        {alert.actions.map((act) => (
                          <div key={act.id} style={s.actionItem}>
                            <span>
                              Stage {act.stage} · {act.channel.toUpperCase()} to {act.target}:
                            </span>
                            <span style={{ color: "#16a34a", fontWeight: 600 }}>{act.result}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Real-time Notification Feed */}
          <section style={s.card}>
            <div style={s.cardHeader}>
              <div>
                <h2 style={s.cardTitle}>Live Notification Dispatch Feed</h2>
                <p style={s.cardSub}>Outbound SMS & Voice Calls sent to caregivers</p>
              </div>
            </div>

            {notifications.length === 0 ? (
              <div style={s.emptyState}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📱</div>
                <div style={s.emptyTitle}>No outgoing notifications yet</div>
                <div style={s.emptyDesc}>
                  SMS and voice phone alerts sent to caregivers will display here.
                </div>
              </div>
            ) : (
              <div style={s.notificationList}>
                {notifications.slice(0, 20).map((n, idx) => (
                  <div key={idx} style={s.notificationItem}>
                    <div style={s.notifHeader}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
                        {n.type === "voice" ? "📞 Voice Call" : "💬 SMS Message"}
                      </span>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>
                        {new Date(n.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div style={s.notifRecipient}>To: {n.recipient}</div>
                    <div style={s.notifMessage}>{n.message}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { display: "flex", minHeight: "100vh", backgroundColor: "#f8fafc" },
  main: { flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh", overflow: "auto" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "24px 32px",
    backgroundColor: "#ffffff",
    borderBottom: "1px solid #f1f5f9",
  },
  pageTitle: { fontSize: 20, fontWeight: 700, color: "#1e293b", margin: 0 },
  pageSubtitle: { fontSize: 12, color: "#94a3b8", marginTop: 4, margin: 0 },
  testBtn: {
    backgroundColor: "#ea580c",
    color: "#ffffff",
    border: "none",
    borderRadius: 8,
    padding: "9px 18px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  msgBanner: {
    margin: "16px 32px 0",
    padding: "10px 16px",
    borderRadius: 8,
    border: "1px solid",
    fontSize: 13,
    fontWeight: 500,
  },
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 16,
    padding: "24px 32px 0",
  },
  statCard: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    padding: "18px 20px",
  },
  statLabel: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: 6,
  },
  statValue: { fontSize: 26, fontWeight: 700, marginBottom: 4 },
  statSub: { fontSize: 12, color: "#64748b" },
  pipelineContainer: {
    margin: "20px 32px 0",
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    padding: "16px 20px",
  },
  pipelineTitle: { fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 },
  pipelineStages: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
  pipelineStep: { flex: 1, backgroundColor: "#f8fafc", padding: "10px 14px", borderRadius: 8, border: "1px solid #f1f5f9" },
  stepNum: { fontSize: 11, fontWeight: 700, color: "#2563eb", marginBottom: 2 },
  stepName: { fontSize: 13, fontWeight: 600, color: "#1e293b" },
  stepDesc: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  pipelineArrow: { color: "#cbd5e1", fontSize: 16, fontWeight: 700 },
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "1.1fr 0.9fr",
    gap: 20,
    padding: "20px 32px 32px",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottom: "1px solid #f1f5f9",
  },
  cardTitle: { fontSize: 15, fontWeight: 700, color: "#1e293b", margin: 0 },
  cardSub: { fontSize: 12, color: "#94a3b8", marginTop: 2, margin: 0 },
  filterTabs: { display: "flex", gap: 4, backgroundColor: "#f1f5f9", padding: 3, borderRadius: 6 },
  filterBtn: {
    background: "none",
    border: "none",
    fontSize: 11,
    padding: "4px 10px",
    borderRadius: 4,
    cursor: "pointer",
    color: "#64748b",
  },
  filterBtnActive: { backgroundColor: "#ffffff", color: "#1e293b", fontWeight: 600, boxShadow: "0 1px 2px rgba(0,0,0,0.05)" },
  alertList: { display: "flex", flexDirection: "column", gap: 12 },
  alertCard: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    padding: "16px",
  },
  alertCardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  alertTypeTitle: { fontSize: 13, fontWeight: 700, color: "#1e293b" },
  badge: { fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4 },
  stageBadge: { fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10 },
  alertNote: { fontSize: 13, color: "#475569", marginBottom: 12, lineHeight: 1.4 },
  actionRow: { marginTop: 12 },
  ackBtn: {
    backgroundColor: "#dc2626",
    color: "#ffffff",
    border: "none",
    borderRadius: 6,
    padding: "8px 16px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  ackInfo: { fontSize: 12, color: "#16a34a", marginTop: 8 },
  actionsAuditBox: {
    marginTop: 12,
    backgroundColor: "#f8fafc",
    padding: "8px 12px",
    borderRadius: 6,
    fontSize: 11,
    color: "#64748b",
  },
  actionsAuditTitle: { fontWeight: 600, marginBottom: 4, color: "#475569" },
  actionItem: { display: "flex", justifyContent: "space-between", marginTop: 2 },
  notificationList: { display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", maxHeight: 540 },
  notificationItem: {
    backgroundColor: "#f8fafc",
    border: "1px solid #f1f5f9",
    borderRadius: 8,
    padding: "12px 14px",
  },
  notifHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  notifRecipient: { fontSize: 11, color: "#2563eb", fontWeight: 600, marginBottom: 4 },
  notifMessage: { fontSize: 12, color: "#334155", lineHeight: 1.4, whiteSpace: "pre-wrap" },
  emptyState: { textAlign: "center", padding: "48px 16px" },
  emptyTitle: { fontSize: 14, fontWeight: 600, color: "#475569", marginBottom: 4 },
  emptyDesc: { fontSize: 12, color: "#94a3b8", maxWidth: 280, margin: "0 auto" },
};
