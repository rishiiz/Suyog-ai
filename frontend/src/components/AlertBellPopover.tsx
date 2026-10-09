"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

export const AlertBellPopover: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeElderId, setActiveElderId] = useState<number | null>(null);
  const [acknowledgingId, setAcknowledgingId] = useState<number | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  async function fetchActiveAlerts() {
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
        const list = await api.getAlerts(targetId).catch(() => []);
        const active = (list || []).filter((a: any) => a.status === "active");
        setAlerts(active);
      } else {
        setAlerts([]);
      }
    } catch (err) {
      console.error("AlertBell fetch error:", err);
    }
  }

  useEffect(() => {
    fetchActiveAlerts();
    const interval = setInterval(fetchActiveAlerts, 5_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAcknowledge = async (e: React.MouseEvent, alertId: number) => {
    e.stopPropagation();
    setAcknowledgingId(alertId);
    try {
      await api.acknowledgeAlert(alertId, currentUser?.name || "Caregiver");
      // Immediately remove from list
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
      fetchActiveAlerts();
    } catch (err) {
      console.error("Failed to acknowledge alert:", err);
    } finally {
      setAcknowledgingId(null);
    }
  };

  const handleClearAll = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeElderId) return;
    try {
      await api.clearAllAlerts(activeElderId);
      setAlerts([]);
      fetchActiveAlerts();
    } catch (err) {
      console.error("Failed to clear alerts:", err);
    }
  };

  const count = alerts.length;

  return (
    <div ref={popoverRef} style={styles.container}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          ...styles.bellBtn,
          borderColor: count > 0 ? "#fecaca" : "#e2e8f0",
          backgroundColor: count > 0 ? "#fef2f2" : "#ffffff",
        }}
        title={count > 0 ? `${count} Active Alerts` : "No Active Alerts"}
        aria-label="Alerts"
      >
        <span style={styles.bellIcon}>🔔</span>
        {count > 0 && (
          <span style={styles.badge}>{count > 9 ? "9+" : count}</span>
        )}
      </button>

      {open && (
        <div style={styles.popover}>
          {/* Header */}
          <div style={styles.header}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={styles.headerTitle}>Active Alerts</span>
              {count > 0 && (
                <span style={styles.countBadge}>{count}</span>
              )}
            </div>
            {count > 0 && (
              <button onClick={handleClearAll} style={styles.clearAllBtn}>
                Clear All
              </button>
            )}
          </div>

          <div style={styles.divider} />

          {/* Alert List */}
          <div style={styles.list}>
            {count === 0 ? (
              <div style={styles.emptyState}>
                <div style={styles.emptyIcon}>✓</div>
                <div style={styles.emptyTitle}>All Clear</div>
                <div style={styles.emptySubtitle}>No pending emergency or safety alarms.</div>
              </div>
            ) : (
              alerts.map((alert) => {
                const isCrit = alert.severity === "critical" || alert.severity === "high";
                return (
                  <div key={alert.id} style={styles.alertCard}>
                    <div style={styles.alertTop}>
                      <span
                        style={{
                          ...styles.sevDot,
                          backgroundColor: isCrit ? "#dc2626" : "#f59e0b",
                        }}
                      />
                      <span style={styles.alertType}>
                        {alert.type.toUpperCase().replace(/_/g, " ")}
                      </span>
                      <span style={styles.stageTag}>Stage {alert.stage}</span>
                    </div>

                    <div style={styles.alertNote}>
                      {alert.note || "Motion or safety anomaly detected."}
                    </div>

                    <div style={styles.alertActions}>
                      <button
                        onClick={(e) => handleAcknowledge(e, alert.id)}
                        disabled={acknowledgingId === alert.id}
                        style={styles.ackBtn}
                      >
                        {acknowledgingId === alert.id ? "Acknowledging..." : "✓ Acknowledge (Remove)"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div style={styles.divider} />

          {/* Footer */}
          <div style={styles.footer}>
            <Link
              href="/alerts"
              onClick={() => setOpen(false)}
              style={styles.viewAllLink}
            >
              Open Full Alerts & Escalation Console ➔
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "relative",
    display: "inline-block",
  },
  bellBtn: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    border: "1px solid #e2e8f0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    position: "relative",
    transition: "all 0.15s ease",
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  },
  bellIcon: {
    fontSize: 16,
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#dc2626",
    color: "#ffffff",
    fontSize: 10,
    fontWeight: 700,
    width: 18,
    height: 18,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "2px solid #ffffff",
    boxShadow: "0 1px 3px rgba(220, 38, 38, 0.4)",
  },
  popover: {
    position: "absolute",
    top: "calc(100% + 8px)",
    right: 0,
    width: 320,
    maxHeight: 460,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05)",
    zIndex: 1000,
    display: "flex",
    flexDirection: "column",
    animation: "fadeIn 0.15s ease",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: "#1e293b",
  },
  countBadge: {
    backgroundColor: "#fee2e2",
    color: "#dc2626",
    fontSize: 11,
    fontWeight: 700,
    padding: "1px 6px",
    borderRadius: 10,
  },
  clearAllBtn: {
    backgroundColor: "transparent",
    border: "none",
    color: "#64748b",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
    textDecoration: "underline",
  },
  divider: {
    height: 1,
    backgroundColor: "#f1f5f9",
  },
  list: {
    padding: "8px 12px",
    overflowY: "auto",
    maxHeight: 320,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  emptyState: {
    textAlign: "center",
    padding: "24px 12px",
  },
  emptyIcon: {
    fontSize: 22,
    color: "#16a34a",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "#1e293b",
    marginBottom: 2,
  },
  emptySubtitle: {
    fontSize: 11,
    color: "#94a3b8",
  },
  alertCard: {
    backgroundColor: "#fafafa",
    borderRadius: 8,
    border: "1px solid #f1f5f9",
    padding: "10px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  alertTop: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  sevDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    flexShrink: 0,
  },
  alertType: {
    fontSize: 12,
    fontWeight: 700,
    color: "#1e293b",
    flex: 1,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  stageTag: {
    fontSize: 10,
    fontWeight: 600,
    color: "#b45309",
    backgroundColor: "#fef3c7",
    padding: "1px 5px",
    borderRadius: 4,
  },
  alertNote: {
    fontSize: 11,
    color: "#64748b",
    lineHeight: 1.4,
  },
  alertActions: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: 4,
  },
  ackBtn: {
    backgroundColor: "#dc2626",
    color: "#ffffff",
    border: "none",
    borderRadius: 6,
    padding: "4px 10px",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
    transition: "background-color 0.15s",
  },
  footer: {
    padding: "10px 14px",
    textAlign: "center",
    backgroundColor: "#f8fafc",
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  viewAllLink: {
    fontSize: 12,
    fontWeight: 600,
    color: "#2563eb",
    textDecoration: "none",
  },
};
