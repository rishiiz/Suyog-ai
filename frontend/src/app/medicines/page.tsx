"use client";

import React, { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { api } from "@/lib/api";

interface Schedule {
  id: number;
  time: string;
  days_of_week: string;
  compartment: number;
}

interface MedicineItem {
  id: number;
  name: string;
  dosage: string;
  instructions?: string;
  critical: boolean;
  stock: number;
  schedules: Schedule[];
}

interface MedicineLogItem {
  id: number;
  medicine_name: string;
  dosage: string;
  due_ts: string;
  status: string;
  confirmed_ts: string | null;
  method: string | null;
  repeat_count: number;
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

export default function MedicinesPage() {
  const [medicines, setMedicines] = useState<MedicineItem[]>([]);
  const [logs, setLogs] = useState<MedicineLogItem[]>([]);
  const [adherence, setAdherence] = useState<AdherenceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [alertCount, setAlertCount] = useState(0);

  // New med form state
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [instructions, setInstructions] = useState("");
  const [time, setTime] = useState("09:00");
  const [compartment, setCompartment] = useState(1);
  const [critical, setCritical] = useState(false);
  const [stock, setStock] = useState(30);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function loadData() {
    try {
      const [medsData, logsData, adhData, alertsData] = await Promise.all([
        api.getMedicines(1).catch(() => []),
        api.getMedicineLogs(1).catch(() => []),
        api.getElderAdherence(1).catch(() => null),
        api.getAlerts(1).catch(() => []),
      ]);
      setMedicines(medsData || []);
      setLogs(logsData || []);
      setAdherence(adhData);
      const activeAlerts = (alertsData || []).filter((a: any) => a.status === "active");
      setAlertCount(activeAlerts.length);
    } catch (err) {
      console.error("Error loading medicines:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 20_000);
    return () => clearInterval(interval);
  }, []);

  const handleConfirm = async (logId: number) => {
    setConfirmingId(logId);
    try {
      await api.confirmMedicine(logId);
      setMsg({ type: "success", text: "Medicine intake manually verified!" });
      setTimeout(() => setMsg(null), 4000);
      await loadData();
    } catch (err) {
      setMsg({ type: "error", text: "Could not confirm medicine. Please try again." });
    } finally {
      setConfirmingId(null);
    }
  };

  const handleAddMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !dosage.trim() || !time.trim()) {
      alert("Please fill in the required fields");
      return;
    }
    setSubmitting(true);
    try {
      await api.createMedicine(1, {
        name,
        dosage,
        instructions: instructions || "Take with water",
        critical,
        stock: Number(stock) || 30,
        time,
        compartment: Number(compartment) || 1,
        days_of_week: "daily",
      });
      setShowAddModal(false);
      setName("");
      setDosage("");
      setInstructions("");
      setTime("09:00");
      setStock(30);
      setMsg({ type: "success", text: "New medicine schedule added successfully!" });
      setTimeout(() => setMsg(null), 4000);
      await loadData();
    } catch (err) {
      setMsg({ type: "error", text: "Failed to add medicine. Make sure backend is running." });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "taken":
        return <span style={{ ...s.badge, backgroundColor: "#dcfce7", color: "#15803d" }}>✓ Taken</span>;
      case "late":
        return <span style={{ ...s.badge, backgroundColor: "#fef9c3", color: "#854d0e" }}>⚠ Taken Late</span>;
      case "missed":
        return <span style={{ ...s.badge, backgroundColor: "#fee2e2", color: "#dc2626" }}>✕ Missed</span>;
      default:
        return <span style={{ ...s.badge, backgroundColor: "#eff6ff", color: "#2563eb" }}>⏳ Pending</span>;
    }
  };

  return (
    <div style={s.page}>
      <Sidebar activeTab="medicines" alertCount={alertCount} />

      <main style={s.main}>
        {/* Header */}
        <header style={s.header}>
          <div>
            <h1 style={s.pageTitle}>Medicine Management</h1>
            <p style={s.pageSubtitle}>
              Schedules, physical smart dispenser compartments, and intake adherence for Ramchandra Kulkarni
            </p>
          </div>
          <button style={s.primaryBtn} onClick={() => setShowAddModal(true)}>
            + Add Medicine Schedule
          </button>
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
            <div style={s.statLabel}>Today's Adherence</div>
            <div style={{ ...s.statValue, color: "#16a34a" }}>
              {adherence ? `${adherence.today_adherence_pct}%` : "100%"}
            </div>
            <div style={s.statSub}>
              {adherence ? `${adherence.today_taken_doses} of ${adherence.today_total_doses} doses taken` : "0 scheduled"}
            </div>
          </div>

          <div style={s.statCard}>
            <div style={s.statLabel}>7-Day Adherence</div>
            <div style={{ ...s.statValue, color: "#2563eb" }}>
              {adherence ? `${adherence.week_adherence_pct}%` : "100%"}
            </div>
            <div style={s.statSub}>
              {adherence ? `${adherence.week_taken_doses} of ${adherence.week_total_doses} total weekly doses` : "Tracked weekly"}
            </div>
          </div>

          <div style={s.statCard}>
            <div style={s.statLabel}>Active Prescriptions</div>
            <div style={{ ...s.statValue, color: "#1e293b" }}>{medicines.length}</div>
            <div style={s.statSub}>
              {medicines.filter((m) => m.critical).length} marked as critical
            </div>
          </div>

          <div style={s.statCard}>
            <div style={s.statLabel}>Dispenser Device</div>
            <div style={{ ...s.statValue, color: "#0891b2" }}>IoT Hub</div>
            <div style={s.statSub}>GPIO Buzzer + Physical Button</div>
          </div>
        </div>

        {/* Grid Content */}
        <div style={s.contentGrid}>
          {/* Active Medicines */}
          <section style={s.card}>
            <div style={s.cardHeader}>
              <div>
                <h2 style={s.cardTitle}>Scheduled Prescriptions ({medicines.length})</h2>
                <p style={s.cardSub}>Configured on elder's smart dispenser device</p>
              </div>
            </div>

            {loading ? (
              <div style={s.emptyState}>Loading medicines...</div>
            ) : medicines.length === 0 ? (
              <div style={s.emptyState}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>💊</div>
                <div style={s.emptyTitle}>No medicines configured yet</div>
                <div style={s.emptyDesc}>Click "+ Add Medicine Schedule" above to add the first prescription.</div>
              </div>
            ) : (
              <div style={s.medList}>
                {medicines.map((m) => (
                  <div key={m.id} style={s.medItem}>
                    <div style={s.medItemTop}>
                      <div>
                        <div style={s.medItemName}>
                          {m.name}
                          {m.critical && <span style={s.criticalTag}>CRITICAL</span>}
                        </div>
                        <div style={s.medItemDosage}>{m.dosage}</div>
                      </div>
                      <div style={s.compartmentBadge}>
                        Slot {m.schedules?.[0]?.compartment || 1}
                      </div>
                    </div>

                    {m.instructions && (
                      <div style={s.instructions}>ℹ {m.instructions}</div>
                    )}

                    <div style={s.medMeta}>
                      <div>
                        <span style={s.metaLabel}>Schedule: </span>
                        <strong>{m.schedules?.map((s) => s.time).join(", ") || "Daily"}</strong>
                      </div>
                      <div>
                        <span style={s.metaLabel}>Inventory: </span>
                        <span style={{ color: m.stock < 7 ? "#dc2626" : "#475569", fontWeight: 600 }}>
                          {m.stock} pills remaining
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Dose Logs & Actions */}
          <section style={s.card}>
            <div style={s.cardHeader}>
              <div>
                <h2 style={s.cardTitle}>Dose Confirmation & History</h2>
                <p style={s.cardSub}>Physical button press or caregiver manual override</p>
              </div>
            </div>

            {logs.length === 0 ? (
              <div style={s.emptyState}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
                <div style={s.emptyTitle}>No dose logs recorded yet</div>
                <div style={s.emptyDesc}>
                  Logs appear automatically when medication reminders fire or when the simulator runs.
                </div>
              </div>
            ) : (
              <div style={s.logList}>
                {logs.map((log) => (
                  <div key={log.id} style={s.logItem}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: "#1e293b" }}>
                          {log.medicine_name} ({log.dosage})
                        </span>
                        {getStatusBadge(log.status)}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>
                        Due: {new Date(log.due_ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {" · "}Slot {log.compartment}
                        {log.confirmed_ts && (
                          <span>
                            {" · "}Confirmed: {new Date(log.confirmed_ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            {log.method ? ` (${log.method})` : ""}
                          </span>
                        )}
                      </div>
                    </div>

                    {log.status === "pending" || log.status === "missed" ? (
                      <button
                        style={s.confirmBtn}
                        disabled={confirmingId === log.id}
                        onClick={() => handleConfirm(log.id)}
                      >
                        {confirmingId === log.id ? "Saving..." : "Confirm Intake"}
                      </button>
                    ) : (
                      <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>✓ Verified</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Modal for Adding Medicine */}
        {showAddModal && (
          <div style={s.modalOverlay}>
            <div style={s.modalBox}>
              <div style={s.modalHeader}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                  Add New Medicine & Schedule
                </h3>
                <button style={s.closeBtn} onClick={() => setShowAddModal(false)}>✕</button>
              </div>

              <form onSubmit={handleAddMedicine} style={s.form}>
                <div style={s.formGroup}>
                  <label style={s.label}>Medicine Name *</label>
                  <input
                    style={s.input}
                    placeholder="e.g. Metformin, Amlodipine"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div style={s.formRow}>
                  <div style={{ flex: 1 }}>
                    <label style={s.label}>Dosage *</label>
                    <input
                      style={s.input}
                      placeholder="e.g. 500mg, 1 tablet"
                      value={dosage}
                      onChange={(e) => setDosage(e.target.value)}
                      required
                    />
                  </div>
                  <div style={{ width: 120 }}>
                    <label style={s.label}>Time *</label>
                    <input
                      type="time"
                      style={s.input}
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={s.formRow}>
                  <div style={{ flex: 1 }}>
                    <label style={s.label}>Dispenser Slot</label>
                    <select
                      style={s.input}
                      value={compartment}
                      onChange={(e) => setCompartment(Number(e.target.value))}
                    >
                      <option value={1}>Slot 1 (Morning)</option>
                      <option value={2}>Slot 2 (Afternoon)</option>
                      <option value={3}>Slot 3 (Evening)</option>
                      <option value={4}>Slot 4 (Night)</option>
                    </select>
                  </div>
                  <div style={{ width: 120 }}>
                    <label style={s.label}>Stock (Pills)</label>
                    <input
                      type="number"
                      style={s.input}
                      value={stock}
                      onChange={(e) => setStock(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div style={s.formGroup}>
                  <label style={s.label}>Instructions</label>
                  <input
                    style={s.input}
                    placeholder="e.g. Take with warm water after meals"
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                  />
                </div>

                <div style={s.checkboxRow}>
                  <input
                    type="checkbox"
                    id="crit"
                    checked={critical}
                    onChange={(e) => setCritical(e.target.checked)}
                  />
                  <label htmlFor="crit" style={{ fontSize: 13, color: "#1e293b", cursor: "pointer" }}>
                    Mark as <strong>Critical Medication</strong> (triggers faster escalation if missed)
                  </label>
                </div>

                <div style={s.modalActions}>
                  <button type="button" style={s.cancelBtn} onClick={() => setShowAddModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" style={s.primaryBtn} disabled={submitting}>
                    {submitting ? "Saving..." : "Save Medicine"}
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
  primaryBtn: {
    backgroundColor: "#2563eb",
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
  medList: { display: "flex", flexDirection: "column", gap: 12 },
  medItem: {
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: "14px 16px",
    backgroundColor: "#fafafa",
  },
  medItemTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  medItemName: {
    fontSize: 14,
    fontWeight: 700,
    color: "#1e293b",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  criticalTag: {
    backgroundColor: "#fee2e2",
    color: "#dc2626",
    fontSize: 10,
    fontWeight: 700,
    padding: "2px 6px",
    borderRadius: 4,
  },
  medItemDosage: { fontSize: 12, color: "#64748b", marginTop: 2 },
  compartmentBadge: {
    backgroundColor: "#dbeafe",
    color: "#1d4ed8",
    fontSize: 11,
    fontWeight: 600,
    padding: "3px 8px",
    borderRadius: 6,
  },
  instructions: {
    fontSize: 12,
    color: "#475569",
    backgroundColor: "#f1f5f9",
    padding: "6px 10px",
    borderRadius: 6,
    marginBottom: 8,
  },
  medMeta: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 12,
    color: "#64748b",
  },
  metaLabel: { color: "#94a3b8" },
  logList: { display: "flex", flexDirection: "column", gap: 10 },
  logItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 14px",
    border: "1px solid #f1f5f9",
    backgroundColor: "#fafafa",
    borderRadius: 8,
  },
  badge: {
    fontSize: 11,
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: 10,
  },
  confirmBtn: {
    backgroundColor: "#16a34a",
    color: "#ffffff",
    border: "none",
    borderRadius: 6,
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  emptyState: { textAlign: "center", padding: "36px 16px" },
  emptyTitle: { fontSize: 14, fontWeight: 600, color: "#475569", marginBottom: 4 },
  emptyDesc: { fontSize: 12, color: "#94a3b8", maxWidth: 280, margin: "0 auto" },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  modalBox: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: "24px",
    width: "100%",
    maxWidth: 480,
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 12,
    borderBottom: "1px solid #f1f5f9",
  },
  closeBtn: {
    background: "none",
    border: "none",
    fontSize: 16,
    color: "#94a3b8",
    cursor: "pointer",
  },
  form: { display: "flex", flexDirection: "column", gap: 14 },
  formGroup: { display: "flex", flexDirection: "column", gap: 6 },
  formRow: { display: "flex", gap: 12 },
  label: { fontSize: 12, fontWeight: 600, color: "#475569" },
  input: {
    padding: "9px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: 7,
    fontSize: 13,
    color: "#1e293b",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  checkboxRow: { display: "flex", alignItems: "center", gap: 8, marginTop: 4 },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 },
  cancelBtn: {
    padding: "9px 16px",
    backgroundColor: "transparent",
    border: "1px solid #cbd5e1",
    borderRadius: 7,
    fontSize: 13,
    color: "#64748b",
    cursor: "pointer",
  },
};
