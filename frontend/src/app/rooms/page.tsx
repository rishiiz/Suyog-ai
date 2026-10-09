"use client";

import React, { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import { AlertBellPopover } from "@/components/AlertBellPopover";
import { api } from "@/lib/api";

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

interface TimelineEvent {
  id: number;
  type: string;
  ts: string;
  details: Record<string, any>;
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Record<string, RoomInfo>>({});
  const [device, setDevice] = useState<DeviceInfo>({
    device_id: "cg_device_001",
    status: "offline",
    rssi: null,
    firmware: "1.0.0-esp32",
    last_seen: null,
  });
  const [activeElderId, setActiveElderId] = useState<number | null>(null);
  const [awayMode, setAwayMode] = useState(false);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertCount, setAlertCount] = useState(0);
  const [togglingAway, setTogglingAway] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function loadData() {
    try {
      const me = await api.getMe().catch(() => null);
      const simFlag = typeof window !== "undefined" && localStorage.getItem("suyog_simulation_mode") === "true";
      let targetId: number | null = null;

      if (me?.elders && me.elders.length > 0) {
        targetId = me.elders[0].id;
      } else if (me?.is_demo || simFlag) {
        targetId = 1;
      }

      setActiveElderId(targetId);

      if (targetId) {
        const [statusData, timelineData, alertsData] = await Promise.all([
          api.getElderStatus(targetId).catch(() => null),
          api.getElderTimeline(targetId).catch(() => []),
          api.getAlerts(targetId).catch(() => []),
        ]);

        if (statusData) {
          setRooms(statusData.rooms || {});
          setDevice(statusData.device || {});
          setAwayMode(!!statusData.away_mode);
        }
        setTimeline(timelineData || []);
        const activeAlerts = (alertsData || []).filter((a: any) => a.status === "active");
        setAlertCount(activeAlerts.length);
      } else {
        setRooms({});
        setDevice({
          device_id: null,
          status: "unlinked",
          rssi: null,
          firmware: null,
          last_seen: null,
        });
        setAwayMode(false);
        setTimeline([]);
        setAlertCount(0);
      }
    } catch (err) {
      console.error("Error loading room data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10_000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleAway = async () => {
    if (!activeElderId) return;
    setTogglingAway(true);
    try {
      const nextAway = !awayMode;
      await api.toggleAwayMode(activeElderId, nextAway);
      setAwayMode(nextAway);
      setMsg({
        type: "success",
        text: nextAway
          ? "Away Mode activated. Inactivity alarms are temporarily paused."
          : "Away Mode deactivated. Normal room motion monitoring resumed.",
      });
      setTimeout(() => setMsg(null), 4000);
    } catch (err) {
      setMsg({ type: "error", text: "Failed to update Away Mode." });
    } finally {
      setTogglingAway(false);
    }
  };

  const roomDisplayList = [
    {
      key: "bedroom",
      name: "Bedroom 1 (Master)",
      icon: "🛏️",
      pin: "GPIO 27",
      info: rooms["bedroom"] || { last_motion_ts: null, minutes_ago: null },
    },
    {
      key: "livingroom",
      name: "Hall & Living Room",
      icon: "🛋️",
      pin: "GPIO 14",
      info: rooms["livingroom"] || rooms["hall"] || { last_motion_ts: null, minutes_ago: null },
    },
    {
      key: "kitchen",
      name: "Kitchen Area",
      icon: "🍳",
      pin: "GPIO 12",
      info: rooms["kitchen"] || { last_motion_ts: null, minutes_ago: null },
    },
    {
      key: "bathroom",
      name: "Bathroom",
      icon: "🚿",
      pin: "GPIO 13",
      info: rooms["bathroom"] || { last_motion_ts: null, minutes_ago: null },
    },
  ];

  const formatTimeAgo = (mins: number | null) => {
    if (mins === null) return "No motion recorded today";
    if (mins === 0) return "Active just now (< 1 min)";
    if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return `${hrs}h ${rem}m ago`;
  };

  const getEventBadge = (type: string) => {
    switch (type) {
      case "motion":
        return <span style={{ ...s.badge, backgroundColor: "#dcfce7", color: "#15803d" }}>🏃 Motion</span>;
      case "button_press":
      case "panic":
        return <span style={{ ...s.badge, backgroundColor: "#fee2e2", color: "#dc2626" }}>🚨 SOS Button</span>;
      case "med_confirm":
        return <span style={{ ...s.badge, backgroundColor: "#eff6ff", color: "#2563eb" }}>💊 Med Taken</span>;
      case "heartbeat":
        return <span style={{ ...s.badge, backgroundColor: "#f1f5f9", color: "#475569" }}>💓 Heartbeat</span>;
      default:
        return <span style={{ ...s.badge, backgroundColor: "#f3e8ff", color: "#7e22ce" }}>{type}</span>;
    }
  };

  return (
    <div style={s.page}>
      <Sidebar activeTab="rooms" alertCount={alertCount} />

      <main style={s.main}>
        {/* Header */}
        <header style={s.header}>
          <div>
            <h1 style={s.pageTitle}>Room Presence & Motion Activity</h1>
            <p style={s.pageSubtitle}>
              Low-cost PIR motion sensors with zero video cameras — 100% privacy preserving
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              style={{
                ...s.awayBtn,
                backgroundColor: awayMode ? "#fef3c7" : "#f1f5f9",
                color: awayMode ? "#b45309" : "#475569",
                borderColor: awayMode ? "#fde68a" : "#cbd5e1",
              }}
              onClick={handleToggleAway}
              disabled={togglingAway}
            >
              {awayMode ? "🏖️ Away Mode (Active)" : "🚶 Toggle Away Mode"}
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
            <div style={s.statLabel}>IoT Hub Status</div>
            <div style={{ ...s.statValue, color: device.status === "online" ? "#16a34a" : "#ea580c" }}>
              {device.status ? device.status.toUpperCase() : "ONLINE"}
            </div>
            <div style={s.statSub}>
              {device.rssi ? `WiFi RSSI: ${device.rssi} dBm` : "ESP32 Controller"}
            </div>
          </div>

          <div style={s.statCard}>
            <div style={s.statLabel}>Active Rooms</div>
            <div style={{ ...s.statValue, color: "#2563eb" }}>
              {roomDisplayList.filter((r) => r.info.minutes_ago !== null && r.info.minutes_ago < 30).length} / {roomDisplayList.length}
            </div>
            <div style={s.statSub}>Motion detected in last 30m</div>
          </div>

          <div style={s.statCard}>
            <div style={s.statLabel}>Privacy Protection</div>
            <div style={{ ...s.statValue, color: "#16a34a" }}>No Cameras</div>
            <div style={s.statSub}>PIR Passive Infrared only</div>
          </div>

          <div style={s.statCard}>
            <div style={s.statLabel}>Inactivity Guard</div>
            <div style={{ ...s.statValue, color: awayMode ? "#b45309" : "#0284c7" }}>
              {awayMode ? "Paused" : "Active (2h limit)"}
            </div>
            <div style={s.statSub}>Auto-escalation enabled</div>
          </div>
        </div>

        {/* Content */}
        <div style={s.contentGrid}>
          {/* Room Cards Grid */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", margin: "4px 0" }}>
              Monitored Rooms & Sensors
            </h2>

            <div style={s.roomCardsGrid}>
              {roomDisplayList.map((room) => {
                const isRecentlyActive = room.info.minutes_ago !== null && room.info.minutes_ago <= 10;
                return (
                  <div
                    key={room.key}
                    style={{
                      ...s.roomCard,
                      borderLeft: isRecentlyActive ? "4px solid #16a34a" : "4px solid #cbd5e1",
                    }}
                  >
                    <div style={s.roomCardTop}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 20 }}>{room.icon}</span>
                        <div>
                          <div style={s.roomName}>{room.name}</div>
                          <div style={s.pinLabel}>{room.pin} · PIR Sensor</div>
                        </div>
                      </div>
                      <span
                        style={{
                          ...s.statusBadge,
                          backgroundColor: isRecentlyActive ? "#dcfce7" : "#f1f5f9",
                          color: isRecentlyActive ? "#15803d" : "#64748b",
                        }}
                      >
                        {isRecentlyActive ? "🟢 Active" : "⚪ Idle"}
                      </span>
                    </div>

                    <div style={s.roomStatusBox}>
                      <div style={s.lastMotionText}>
                        {formatTimeAgo(room.info.minutes_ago)}
                      </div>
                      {room.info.last_motion_ts && (
                        <div style={s.exactTime}>
                          Recorded at {new Date(room.info.last_motion_ts).toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Hub Hardware Telemetry */}
            <div style={s.hardwareCard}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", margin: "0 0 12px" }}>
                📡 Hardware & Diagnostic Telemetry
              </h3>
              <div style={s.telemetryGrid}>
                <div style={s.telemetryItem}>
                  <span style={s.telemetryLabel}>Device ID</span>
                  <span style={s.telemetryVal}>{device.device_id || "cg_device_001"}</span>
                </div>
                <div style={s.telemetryItem}>
                  <span style={s.telemetryLabel}>Firmware</span>
                  <span style={s.telemetryVal}>{device.firmware || "v1.2.0-esp32-s3"}</span>
                </div>
                <div style={s.telemetryItem}>
                  <span style={s.telemetryLabel}>MQTT Broker</span>
                  <span style={s.telemetryVal}>Active (Local / HiveMQ)</span>
                </div>
                <div style={s.telemetryItem}>
                  <span style={s.telemetryLabel}>Last Ping</span>
                  <span style={s.telemetryVal}>
                    {device.last_seen ? new Date(device.last_seen).toLocaleTimeString() : "Just now"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Activity Timeline */}
          <section style={s.card}>
            <div style={s.cardHeader}>
              <div>
                <h2 style={s.cardTitle}>Live Activity Timeline</h2>
                <p style={s.cardSub}>Chronological sensor & button events</p>
              </div>
            </div>

            {loading ? (
              <div style={s.emptyState}>Loading activity events...</div>
            ) : timeline.length === 0 ? (
              <div style={s.emptyState}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🕒</div>
                <div style={s.emptyTitle}>Waiting for telemetry events</div>
                <div style={s.emptyDesc}>
                  Sensor triggers from the ESP32 hardware or simulator will stream here in real time.
                </div>
              </div>
            ) : (
              <div style={s.timelineList}>
                {timeline.slice(0, 25).map((ev) => (
                  <div key={ev.id} style={s.timelineItem}>
                    <div style={s.timelineDot} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {getEventBadge(ev.type)}
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
                            {ev.details.room ? `Motion in ${ev.details.room}` : ev.type.replace("_", " ").toUpperCase()}
                          </span>
                        </div>
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>
                          {new Date(ev.ts).toLocaleTimeString()}
                        </span>
                      </div>
                      {Object.keys(ev.details).length > 0 && (
                        <div style={s.eventDetails}>
                          {JSON.stringify(ev.details)}
                        </div>
                      )}
                    </div>
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
  awayBtn: {
    padding: "8px 16px",
    borderRadius: 8,
    border: "1px solid",
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
  statValue: { fontSize: 24, fontWeight: 700, marginBottom: 4 },
  statSub: { fontSize: 12, color: "#64748b" },
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "1.1fr 0.9fr",
    gap: 20,
    padding: "20px 32px 32px",
  },
  roomCardsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
  },
  roomCard: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    padding: "16px",
  },
  roomCardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  roomName: { fontSize: 14, fontWeight: 700, color: "#1e293b" },
  pinLabel: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  statusBadge: {
    fontSize: 11,
    fontWeight: 600,
    padding: "3px 8px",
    borderRadius: 12,
  },
  roomStatusBox: {
    backgroundColor: "#fafafa",
    borderRadius: 8,
    padding: "10px 12px",
    border: "1px solid #f1f5f9",
  },
  lastMotionText: { fontSize: 13, fontWeight: 600, color: "#334155" },
  exactTime: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  hardwareCard: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    padding: "18px 20px",
  },
  telemetryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 12,
  },
  telemetryItem: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    backgroundColor: "#f8fafc",
    padding: "10px 12px",
    borderRadius: 6,
  },
  telemetryLabel: { fontSize: 11, color: "#94a3b8", fontWeight: 500 },
  telemetryVal: { fontSize: 12, fontWeight: 600, color: "#1e293b" },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
  },
  cardHeader: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottom: "1px solid #f1f5f9",
  },
  cardTitle: { fontSize: 15, fontWeight: 700, color: "#1e293b", margin: 0 },
  cardSub: { fontSize: 12, color: "#94a3b8", marginTop: 2, margin: 0 },
  timelineList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    overflowY: "auto",
    maxHeight: 520,
  },
  timelineItem: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    paddingBottom: 12,
    borderBottom: "1px solid #f8fafc",
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    backgroundColor: "#2563eb",
    marginTop: 6,
    flexShrink: 0,
  },
  badge: {
    fontSize: 10,
    fontWeight: 700,
    padding: "2px 6px",
    borderRadius: 4,
  },
  eventDetails: {
    fontSize: 11,
    color: "#94a3b8",
    fontFamily: "monospace",
    marginTop: 4,
    backgroundColor: "#f8fafc",
    padding: "4px 8px",
    borderRadius: 4,
    wordBreak: "break-all",
  },
  emptyState: { textAlign: "center", padding: "48px 16px" },
  emptyTitle: { fontSize: 14, fontWeight: 600, color: "#475569", marginBottom: 4 },
  emptyDesc: { fontSize: 12, color: "#94a3b8", maxWidth: 280, margin: "0 auto" },
};
