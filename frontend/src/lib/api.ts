/**
 * Suyog AI API Client
 * Interfaces with the FastAPI backend at http://localhost:8000/api/v1
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

export async function fetchJson(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      throw new Error(`API error ${res.status}: ${await res.text()}`);
    }
    return await res.json();
  } catch (err) {
    console.error(`Fetch failed for ${endpoint}:`, err);
    throw err;
  }
}

export const api = {
  // Elder status & timeline
  getElderStatus: (elderId: number = 1) => fetchJson(`/elders/${elderId}/status`),
  getElderTimeline: (elderId: number = 1) => fetchJson(`/elders/${elderId}/timeline`),
  getElderAdherence: (elderId: number = 1) => fetchJson(`/elders/${elderId}/adherence`),

  // Alerts & Escalation
  getAlerts: (elderId: number = 1) => fetchJson(`/elders/${elderId}/alerts`),
  acknowledgeAlert: (alertId: number, responderName: string = "Caregiver Dashboard") =>
    fetchJson(`/alerts/${alertId}/acknowledge`, {
      method: "POST",
      body: JSON.stringify({ responder_name: responderName }),
    }),
  triggerTestAlert: (elderId: number = 1, testType: string = "panic") =>
    fetchJson(`/alerts/test`, {
      method: "POST",
      body: JSON.stringify({ elder_id: elderId, test_type: testType }),
    }),
  getLiveNotifications: () => fetchJson(`/alerts/notifications/live`),

  // Medicines
  getMedicines: (elderId: number = 1) => fetchJson(`/elders/${elderId}/medicines`),
  createMedicine: (elderId: number = 1, data: any) =>
    fetchJson(`/elders/${elderId}/medicines`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getMedicineLogs: (elderId: number = 1) => fetchJson(`/elders/${elderId}/medicine-logs`),
  confirmMedicine: (logId: number) =>
    fetchJson(`/medicine-logs/${logId}/confirm`, {
      method: "POST",
      body: JSON.stringify({ notes: "Confirmed by caregiver via web dashboard" }),
    }),

  // Away Mode & Consent
  toggleAwayMode: (elderId: number = 1, away: boolean) =>
    fetchJson(`/elders/${elderId}/away-mode?away=${away}`, {
      method: "POST",
    }),
  acceptConsent: (elderId: number = 1) =>
    fetchJson(`/elders/${elderId}/consent`, {
      method: "POST",
    }),

  // Device health
  getDeviceHealth: (deviceId: string = "cg_device_001") =>
    fetchJson(`/devices/${deviceId}/health`),
};
