"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import { AlertBellPopover } from "@/components/AlertBellPopover";
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
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeElder, setActiveElder] = useState<any>(null);
  const [isSimulationMode, setIsSimulationMode] = useState(false);
  const [elderName, setElderName] = useState("");
  const [alerts, setAlerts] = useState<any[]>([]);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [medicineLogs, setMedicineLogs] = useState<any[]>([]);
  const [rooms, setRooms] = useState<Record<string, any>>({});
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  const [status, setStatus] = useState<"ok" | "warning" | "critical">("ok");
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Modal for adding a new elder
  const [showAddElderModal, setShowAddElderModal] = useState(false);
  const [elderForm, setElderForm] = useState({
    name: "",
    age: "",
    phone: "",
    address: "",
    conditions: "",
  });
  const [creatingElder, setCreatingElder] = useState(false);

  async function initAndFetchData() {
    try {
      const me = await api.getMe().catch(() => null);
      setCurrentUser(me);

      const simFlag = typeof window !== "undefined" && localStorage.getItem("suyog_simulation_mode") === "true";
      setIsSimulationMode(simFlag);

      let targetElderId: number | null = null;
      let targetElderName = "";

      if (me?.elders && me.elders.length > 0) {
        targetElderId = me.elders[0].id;
        targetElderName = me.elders[0].name;
        setActiveElder(me.elders[0]);
      } else if (me?.is_demo || simFlag) {
        targetElderId = 1;
        targetElderName = "Ramchandra Kulkarni (Demo)";
        setActiveElder({ id: 1, name: targetElderName });
      } else {
        setActiveElder(null);
      }

      if (targetElderId) {
        const [statusRes, alertsRes, medsRes, logsRes] = await Promise.all([
          api.getElderStatus(targetElderId).catch(() => null),
          api.getAlerts(targetElderId).catch(() => []),
          api.getMedicines(targetElderId).catch(() => []),
          api.getMedicineLogs(targetElderId).catch(() => []),
        ]);

        if (statusRes) {
          setElderName(statusRes.name || targetElderName);
          if (statusRes.rooms) setRooms(statusRes.rooms);
          if (statusRes.device) setDeviceInfo(statusRes.device);
        } else {
          setElderName(targetElderName);
        }

        setAlerts(alertsRes || []);
        setMedicines(medsRes || []);
        setMedicineLogs(logsRes || []);

        const activeList = (alertsRes || []).filter((a: any) => a.status === "active");
        if (activeList.some((a: any) => a.severity === "critical" || a.severity === "high")) {
          setStatus("critical");
        } else if (activeList.length > 0) {
          setStatus("warning");
        } else {
          setStatus("ok");
        }
      } else {
        // New account with no linked elder
        setElderName("No Elder Profile Linked");
        setAlerts([]);
        setMedicines([]);
        setMedicineLogs([]);
        setRooms({});
        setDeviceInfo(null);
        setStatus("ok");
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    initAndFetchData();
    const dataInterval = setInterval(initAndFetchData, 10_000);
    const clockInterval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => {
      clearInterval(dataInterval);
      clearInterval(clockInterval);
    };
  }, []);

  const handleCreateElder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!elderForm.name || !elderForm.age) {
      alert("Please enter at least elder name and age.");
      return;
    }
    setCreatingElder(true);
    try {
      await api.createElder({
        name: elderForm.name,
        age: parseInt(elderForm.age, 10) || 70,
        phone: elderForm.phone || undefined,
        address: elderForm.address || "Home",
        conditions: elderForm.conditions || undefined,
        user_id: currentUser?.id,
      });
      setShowAddElderModal(false);
      setElderForm({ name: "", age: "", phone: "", address: "", conditions: "" });
      await initAndFetchData();
    } catch (err: any) {
      alert(err.message || "Failed to create elder profile");
    } finally {
      setCreatingElder(false);
    }
  };

  const toggleSimulation = () => {
    const nextVal = !isSimulationMode;
    setIsSimulationMode(nextVal);
    if (nextVal) {
      localStorage.setItem("suyog_simulation_mode", "true");
    } else {
      localStorage.removeItem("suyog_simulation_mode");
    }
    initAndFetchData();
  };

  const handleAcknowledgeAlert = async (alertId: number) => {
    try {
      await api.acknowledgeAlert(alertId, currentUser?.name || "Caregiver");
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
      initAndFetchData();
    } catch (err) {
      console.error("Failed to acknowledge alert:", err);
    }
  };

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
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 style={s.pageTitle}>Dashboard</h1>
              {isSimulationMode && (
                <span style={s.simTag}>SIMULATION MODE</span>
              )}
            </div>
            <p style={s.pageSubtitle}>
              {activeElder ? `Monitoring: ${elderName}` : "No elder profile linked to this account"}
            </p>
          </div>
          <div style={s.headerRight}>
            <button
              onClick={toggleSimulation}
              style={{
                ...s.simBtn,
                backgroundColor: isSimulationMode ? "#fef3c7" : "#f1f5f9",
                color: isSimulationMode ? "#92400e" : "#475569",
              }}
            >
              {isSimulationMode ? "Exit Simulation" : "Try Simulation Mode"}
            </button>
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
            <AlertBellPopover />
            <UserProfileMenu />
          </div>
        </header>

        {loading && <div style={s.loadingBar}>Syncing real-time elder telemetry...</div>}

        {/* New User Onboarding Banner when no elder is linked and not in simulation */}
        {!activeElder && !loading && (
          <div style={s.welcomeCard}>
            <div style={s.welcomeHeader}>
              <div style={s.welcomeIcon}>👋</div>
              <div>
                <h3 style={s.welcomeTitle}>Welcome to Suyog AI Caregiver Monitor!</h3>
                <p style={s.welcomeText}>
                  Your account is created. To start monitoring motion, scheduling medicines, and receiving emergency alerts, link your elder's profile.
                </p>
              </div>
            </div>
            <div style={s.welcomeActions}>
              <button
                onClick={() => setShowAddElderModal(true)}
                style={s.primaryActionBtn}
              >
                + Add Elder Profile
              </button>
              <button
                onClick={toggleSimulation}
                style={s.secondaryActionBtn}
              >
                Explore with Simulation Mode
              </button>
            </div>
          </div>
        )}

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
                of {activeElder ? roomList.length : 0} rooms
              </div>
            </div>
          </Link>

          <div style={s.statCard}>
            <div style={s.statLabel}>Monitoring Hub</div>
            <div style={{ ...s.statValue, color: deviceInfo?.status === "online" ? "#059669" : "#64748b" }}>
              {deviceInfo?.status === "online" ? "Online" : activeElder ? "Offline" : "Unlinked"}
            </div>
            <div
              style={{
                ...s.statUnit,
                color: deviceInfo?.status === "online" ? "#059669" : "#64748b",
                backgroundColor: deviceInfo?.status === "online" ? "#d1fae5" : "#f1f5f9",
              }}
            >
              {deviceInfo?.device_id || (activeElder ? "cg_device_pending" : "No device")}
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
                    <button
                      onClick={() => handleAcknowledgeAlert(alert.id)}
                      style={{
                        backgroundColor: "#dc2626",
                        color: "#fff",
                        padding: "6px 12px",
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        border: "none",
                        cursor: "pointer",
                        transition: "background-color 0.15s",
                      }}
                    >
                      Acknowledge
                    </button>
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
            {!activeElder ? (
              <div style={s.emptyState}>
                <div style={s.emptyText}>Add an elder profile to configure and monitor room sensors.</div>
              </div>
            ) : (
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
            )}
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
                <div style={s.emptyText}>
                  {activeElder ? "No medicines scheduled for today." : "Link an elder profile to schedule and monitor prescriptions."}
                </div>
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

        {/* Add Elder Modal */}
        {showAddElderModal && (
          <div style={s.modalOverlay}>
            <div style={s.modalBox}>
              <div style={s.modalHeader}>
                <h3 style={s.modalTitle}>Link Elder Profile</h3>
                <button style={s.modalClose} onClick={() => setShowAddElderModal(false)}>✕</button>
              </div>
              <form onSubmit={handleCreateElder} style={s.form}>
                <div style={s.field}>
                  <label style={s.label}>Elder's Full Name *</label>
                  <input
                    type="text"
                    required
                    style={s.input}
                    placeholder="Full name"
                    value={elderForm.name}
                    onChange={(e) => setElderForm({ ...elderForm, name: e.target.value })}
                  />
                </div>
                <div style={s.fieldRow}>
                  <div style={s.field}>
                    <label style={s.label}>Age *</label>
                    <input
                      type="number"
                      required
                      style={s.input}
                      placeholder="Age (years)"
                      value={elderForm.age}
                      onChange={(e) => setElderForm({ ...elderForm, age: e.target.value })}
                    />
                  </div>
                  <div style={s.field}>
                    <label style={s.label}>Phone Number</label>
                    <input
                      type="tel"
                      style={s.input}
                      placeholder="+91 00000 00000"
                      value={elderForm.phone}
                      onChange={(e) => setElderForm({ ...elderForm, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div style={s.field}>
                  <label style={s.label}>Residential Address</label>
                  <input
                    type="text"
                    style={s.input}
                    placeholder="Flat / House No, Street, City"
                    value={elderForm.address}
                    onChange={(e) => setElderForm({ ...elderForm, address: e.target.value })}
                  />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Medical Conditions (Optional)</label>
                  <input
                    type="text"
                    style={s.input}
                    placeholder="Conditions, allergies (comma separated)"
                    value={elderForm.conditions}
                    onChange={(e) => setElderForm({ ...elderForm, conditions: e.target.value })}
                  />
                </div>
                <div style={s.modalActions}>
                  <button
                    type="button"
                    style={s.cancelBtn}
                    onClick={() => setShowAddElderModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingElder}
                    style={s.submitBtn}
                  >
                    {creatingElder ? "Creating..." : "Save & Link Elder"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
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
  headerRight: { display: "flex", alignItems: "center", gap: 14 },
  simTag: {
    backgroundColor: "#fef3c7",
    color: "#b45309",
    fontSize: 10,
    fontWeight: 700,
    padding: "3px 8px",
    borderRadius: 6,
    letterSpacing: "0.05em",
  },
  simBtn: {
    border: "1px solid #e2e8f0",
    padding: "6px 14px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.15s",
  },
  statusBadge: { display: "flex", alignItems: "center", padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500 },
  clock: { fontSize: 14, fontWeight: 600, color: "#475569", fontVariantNumeric: "tabular-nums" },
  loadingBar: { backgroundColor: "#eff6ff", color: "#1d4ed8", fontSize: 12, padding: "8px 32px", textAlign: "center" as const },

  // Welcome Card
  welcomeCard: {
    margin: "24px 32px 0",
    backgroundColor: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: 12,
    padding: "24px 28px",
  },
  welcomeHeader: {
    display: "flex",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 16,
  },
  welcomeIcon: {
    fontSize: 28,
  },
  welcomeTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: "#1e3a8a",
    margin: "0 0 6px",
  },
  welcomeText: {
    fontSize: 13,
    color: "#3b82f6",
    lineHeight: 1.5,
    margin: 0,
  },
  welcomeActions: {
    display: "flex",
    gap: 12,
  },
  primaryActionBtn: {
    backgroundColor: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "8px 18px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  secondaryActionBtn: {
    backgroundColor: "#fff",
    color: "#1e3a8a",
    border: "1px solid #bfdbfe",
    borderRadius: 8,
    padding: "8px 18px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },

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

  // Modal
  modalOverlay: {
    position: "fixed" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  modalBox: {
    backgroundColor: "#fff",
    borderRadius: 12,
    width: "100%",
    maxWidth: 480,
    padding: "24px 28px",
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "#1e293b",
    margin: 0,
  },
  modalClose: {
    border: "none",
    background: "transparent",
    fontSize: 16,
    cursor: "pointer",
    color: "#94a3b8",
  },
  form: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 14,
  },
  field: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
    flex: 1,
  },
  fieldRow: {
    display: "flex",
    gap: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: "#475569",
  },
  input: {
    padding: "9px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    fontSize: 13,
    color: "#1e293b",
    outline: "none",
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 10,
  },
  cancelBtn: {
    padding: "8px 16px",
    backgroundColor: "#f1f5f9",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    color: "#475569",
    cursor: "pointer",
  },
  submitBtn: {
    padding: "8px 18px",
    backgroundColor: "#2563eb",
    border: "none",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    color: "#fff",
    cursor: "pointer",
  },
};
