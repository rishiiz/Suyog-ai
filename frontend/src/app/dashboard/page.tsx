"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { api } from "@/lib/api";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function timeAgo(iso?: string | null): string {
  if (!iso) return "No activity recorded";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function severityColor(severity: string) {
  return severity === "critical" ? "#dc2626" : severity === "high" ? "#ea580c" : "#d97706";
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [elderName, setElderName] = useState("Ramchandra Kulkarni");
  const [alerts, setAlerts] = useState<any[]>([]);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [medicineLogs, setMedicineLogs] = useState<any[]>([]);
  const [rooms, setRooms] = useState<Record<string, any>>({});
  const [status, setStatus] = useState<"ok" | "warning" | "critical">("ok");
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  async function fetchData() {
    try {
      const [statusRes, alertsRes, medsRes, logsRes] = await Promise.all([
        api.getElderStatus(1).catch(() => null),
        api.getAlerts(1).catch(() => []),
        api.getMedicines(1).catch(() => []),
        api.getMedicineLogs(1).catch(() => []),
      ]);

      if (statusRes) {
        if (statusRes.name) setElderName(statusRes.name);
        if (statusRes.rooms) setRooms(statusRes.rooms);
      }
      setAlerts(alertsRes || []);
      setMedicines(medsRes || []);
      setMedicineLogs(logsRes || []);

      const activeAlerts = (alertsRes || []).filter((a: any) => a.status === "active");
      if (activeAlerts.some((a: any) => a.severity === "critical" || a.severity === "high")) {
        setStatus("critical");
      } else if (activeAlerts.length > 0) {
        setStatus("warning");
      } else {
        setStatus("ok");
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    const dataInterval = setInterval(fetchData, 10_000);
    const clockInterval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => {
      clearInterval(dataInterval);
      clearInterval(clockInterval);
    };
  }, []);

  const activeAlerts = alerts.filter((a) => a.status === "active");
  const confirmedLogs = medicineLogs.filter((m) => m.status === "taken" || m.status === "late");

  const roomList = [
    { name: "Bedroom 1", key: "bedroom", data: rooms["bedroom"] },
    { name: "Hall & Living Room", key: "livingroom", data: rooms["livingroom"] || rooms["hall"] },
    { name: "Kitchen", key: "kitchen", data: rooms["kitchen"] },
    { name: "Bathroom", key: "bathroom", data: rooms["bathroom"] },
  ];

  return (
    <div style={s.page}>
      <Sidebar activeTab="dashboard" alertCount={activeAlerts.length} />

      {/* Main Content */}
      <main style={s.main}>
        {/* Header */}
        <header style={s.header}>
          <div>
            <h1 style={s.pageTitle}>Dashboard</h1>
            <p style={s.pageSubtitle}>Monitoring: {elderName} · Bedroom 1, Hall</p>
          </div>
          <div style={s.headerRight}>
            <div
              style={{
                ...s.statusBadge,
                backgroundColor:
                  status === "ok" ? "#dcfce7" : status === "warning" ? "#fef9c3" : "#fee2e2",
                color:
                  status === "ok" ? "#15803d" : status === "warning" ? "#854d0e" : "#dc2626",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  backgroundColor: "currentColor",
                  display: "inline-block",
                  marginRight: 6,
                }}
              />
              {status === "ok" ? "All clear" : status === "warning" ? "Attention needed" : "Critical alert"}
            </div>
            <div style={s.clock}>
              {currentTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        </header>

        {loading && <div style={s.loadingBar}>Syncing real-time elder telemetry...</div>}

        {/* Stats Row */}
        <div style={s.statsRow}>
          <Link href="/alerts" style={{ textDecoration: "none" }}>
            <div style={s.statCard}>
              <div style={s.statLabel}>Active Alerts</div>
              <div
                style={{
                  ...s.statValue,
                  color: activeAlerts.length > 0 ? "#dc2626" : "#15803d",
                }}
              >
                {activeAlerts.length}
              </div>
              <div
                style={{
                  ...s.statUnit,
                  color: activeAlerts.length > 0 ? "#dc2626" : "#15803d",
                  backgroundColor: activeAlerts.length > 0 ? "#fee2e2" : "#dcfce7",
                }}
              >
                {activeAlerts.length > 0 ? "Requires action" : "All safe"}
              </div>
            </div>
          </Link>

          <Link href="/medicines" style={{ textDecoration: "none" }}>
            <div style={s.statCard}>
              <div style={s.statLabel}>Medicines Today</div>
              <div style={{ ...s.statValue, color: "#1d4ed8" }}>
                {confirmedLogs.length}/{medicineLogs.length > 0 ? medicineLogs.length : medicines.length}
              </div>
              <div style={{ ...s.statUnit, color: "#1d4ed8", backgroundColor: "#dbeafe" }}>
                taken
              </div>
            </div>
          </Link>

          <Link href="/rooms" style={{ textDecoration: "none" }}>
            <div style={s.statCard}>
              <div style={s.statLabel}>Rooms Active</div>
              <div style={{ ...s.statValue, color: "#6d28d9" }}>
                {roomList.filter((r) => r.data && r.data.minutes_ago !== null && r.data.minutes_ago < 30).length}
              </div>
              <div style={{ ...s.statUnit, color: "#6d28d9", backgroundColor: "#ede9fe" }}>
                of {roomList.length} rooms
              </div>
            </div>
          </Link>

          <div style={s.statCard}>
            <div style={s.statLabel}>Monitoring Hub</div>
            <div style={{ ...s.statValue, color: "#059669" }}>Live</div>
            <div style={{ ...s.statUnit, color: "#059669", backgroundColor: "#d1fae5" }}>
              IoT ESP32 Online
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div style={s.contentGrid}>
          {/* Active Alerts */}
          <section style={s.section}>
            <div style={s.sectionHeader}>
              <h2 style={s.sectionTitle}>Active Alerts</h2>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {activeAlerts.length > 0 && <span style={s.badge}>{activeAlerts.length}</span>}
                <Link href="/alerts" style={{ fontSize: 12, color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>
                  View All & Test ➔
                </Link>
              </div>
            </div>
            {activeAlerts.length === 0 ? (
              <div style={s.emptyState}>
                <div style={s.emptyIcon}>✓</div>
                <div style={s.emptyText}>No active alerts. Everything looks good.</div>
              </div>
            ) : (
              <div style={s.alertList}>
                {activeAlerts.map((alert) => (
                  <div key={alert.id} style={s.alertItem}>
                    <div
                      style={{
                        ...s.alertSeverityDot,
                        backgroundColor: severityColor(alert.severity),
                      }}
                    />
                    <div style={s.alertBody}>
                      <div style={s.alertTitle}>
                        {alert.type.toUpperCase()} ALARM (Stage {alert.stage})
                      </div>
                      <div style={s.alertDesc}>{alert.note || "Emergency event in progress"}</div>
                    </div>
                    <Link
                      href="/alerts"
                      style={{
                        backgroundColor: "#dc2626",
                        color: "#fff",
                        padding: "4px 10px",
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                    >
                      Acknowledge
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Room Presence */}
          <section style={s.section}>
            <div style={s.sectionHeader}>
              <h2 style={s.sectionTitle}>Room Presence</h2>
              <Link href="/rooms" style={{ fontSize: 12, color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>
                Sensor Details ➔
              </Link>
            </div>
            <div style={s.roomList}>
              {roomList.map((room) => {
                const isActive = room.data && room.data.minutes_ago !== null && room.data.minutes_ago < 15;
                return (
                  <div key={room.name} style={s.roomItem}>
                    <div style={s.roomInfo}>
                      <div style={s.roomName}>{room.name}</div>
                      <div style={s.roomTime}>
                        {room.data && room.data.minutes_ago !== null
                          ? `Motion ${room.data.minutes_ago}m ago`
                          : "No recent motion recorded"}
                      </div>
                    </div>
                    <div
                      style={{
                        ...s.roomStatus,
                        backgroundColor: isActive ? "#dcfce7" : "#f1f5f9",
                        color: isActive ? "#15803d" : "#94a3b8",
                      }}
                    >
                      {isActive ? "Active" : "Idle"}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Medicines */}
          <section style={{ ...s.section, gridColumn: "1 / -1" }}>
            <div style={s.sectionHeader}>
              <div>
                <h2 style={s.sectionTitle}>Today's Medicines & Adherence</h2>
                <span style={s.sectionSub}>
                  {confirmedLogs.length} confirmed · {medicines.length} prescriptions scheduled
                </span>
              </div>
              <Link href="/medicines" style={{ fontSize: 12, color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>
                Manage Prescriptions ➔
              </Link>
            </div>

            {medicines.length === 0 ? (
              <div style={s.emptyState}>
                <div style={s.emptyText}>No medicines scheduled for today.</div>
              </div>
            ) : (
              <div style={s.medGrid}>
                {medicines.map((med) => {
                  const log = medicineLogs.find((l) => l.medicine_name === med.name);
                  const isTaken = log && (log.status === "taken" || log.status === "late");
                  return (
                    <div
                      key={med.id}
                      style={{
                        ...s.medCard,
                        borderLeftColor: isTaken ? "#16a34a" : "#cbd5e1",
                      }}
                    >
                      <div style={s.medName}>{med.name}</div>
                      <div style={s.medDosage}>{med.dosage}</div>
                      <div style={s.medTime}>
                        Time: {med.schedules?.[0]?.time || "09:00"} · Slot {med.schedules?.[0]?.compartment || 1}
                      </div>
                      <div
                        style={{
                          ...s.medStatus,
                          color: isTaken ? "#15803d" : "#6b7280",
                        }}
                      >
                        {isTaken ? "✓ Dose Confirmed" : "⏳ Pending scheduled dose"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  page: { display: "flex", minHeight: "100vh", backgroundColor: "#f8fafc" },
  main: { flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh", overflow: "auto" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "24px 32px",
    backgroundColor: "#fff",
    borderBottom: "1px solid #f1f5f9",
  },
  pageTitle: { fontSize: 20, fontWeight: 700, color: "#1e293b", margin: 0 },
  pageSubtitle: { fontSize: 12, color: "#94a3b8", marginTop: 2, margin: 0 },
  headerRight: { display: "flex", alignItems: "center", gap: 16 },
  statusBadge: { display: "flex", alignItems: "center", padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500 },
  clock: { fontSize: 14, fontWeight: 600, color: "#475569", fontVariantNumeric: "tabular-nums" },
  loadingBar: { backgroundColor: "#eff6ff", color: "#1d4ed8", fontSize: 12, padding: "8px 32px", textAlign: "center" as const },

  // Stats
  statsRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, padding: "24px 32px 0" },
  statCard: { backgroundColor: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", padding: "18px 20px", cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s" },
  statLabel: { fontSize: 11, color: "#94a3b8", fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 8 },
  statValue: { fontSize: 26, fontWeight: 700, marginBottom: 6 },
  statUnit: { display: "inline-block", fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 10 },

  // Content
  contentGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, padding: "20px 32px 32px" },
  section: { backgroundColor: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", padding: "20px 24px" },
  sectionHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: "#1e293b", margin: 0 },
  sectionSub: { fontSize: 12, color: "#94a3b8" },
  badge: { backgroundColor: "#fef2f2", color: "#dc2626", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10 },

  // Alerts
  alertList: { display: "flex", flexDirection: "column", gap: 10 },
  alertItem: { display: "flex", alignItems: "center", gap: 12, padding: "12px", backgroundColor: "#fafafa", borderRadius: 8, border: "1px solid #f1f5f9" },
  alertSeverityDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  alertBody: { flex: 1, minWidth: 0 },
  alertTitle: { fontSize: 13, fontWeight: 600, color: "#1e293b" },
  alertDesc: { fontSize: 12, color: "#64748b", marginTop: 2, lineHeight: 1.4 },

  // Empty State
  emptyState: { textAlign: "center" as const, padding: "28px 0" },
  emptyIcon: { fontSize: 24, color: "#16a34a", marginBottom: 8 },
  emptyText: { fontSize: 13, color: "#94a3b8" },

  // Rooms
  roomList: { display: "flex", flexDirection: "column", gap: 8 },
  roomItem: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", backgroundColor: "#fafafa", borderRadius: 8, border: "1px solid #f1f5f9" },
  roomInfo: {},
  roomName: { fontSize: 13, fontWeight: 600, color: "#1e293b" },
  roomTime: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  roomStatus: { fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 10 },

  // Medicines
  medGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 },
  medCard: { borderLeft: "3px solid", backgroundColor: "#fafafa", borderRadius: 8, padding: "14px 16px", border: "1px solid #f1f5f9" },
  medName: { fontSize: 13, fontWeight: 600, color: "#1e293b", marginBottom: 4 },
  medDosage: { fontSize: 12, color: "#64748b" },
  medTime: { fontSize: 11, color: "#94a3b8", marginTop: 6 },
  medStatus: { fontSize: 11, fontWeight: 500, marginTop: 6 },
};
