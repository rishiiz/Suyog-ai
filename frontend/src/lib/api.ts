/**
 * Suyog AI API Client
 * Interfaces with the FastAPI backend at http://localhost:8000/api/v1
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

export async function fetchJson(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = typeof window !== "undefined" ? localStorage.getItem("suyog_token") : null;
  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`API error ${res.status}: ${errBody}`);
    }
    return await res.json();
  } catch (err) {
    console.error(`Fetch failed for ${endpoint}:`, err);
    throw err;
  }
}

export const api = {
  // Auth & Profile
  getMe: () => fetchJson(`/auth/me`),
  updateProfile: (data: any) =>
    fetchJson(`/auth/me`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Elder registration & status
  getElders: () => fetchJson(`/elders`),
  createElder: (data: any) =>
    fetchJson(`/elders`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getElderStatus: (elderId: number) => fetchJson(`/elders/${elderId}/status`),
  getElderTimeline: (elderId: number) => fetchJson(`/elders/${elderId}/timeline`),
  getElderAdherence: (elderId: number) => fetchJson(`/elders/${elderId}/adherence`),

  // Alerts & Escalation
  getAlerts: (elderId: number) => fetchJson(`/elders/${elderId}/alerts`),
  acknowledgeAlert: (alertId: number, responderName: string = "Caregiver Dashboard") =>
    fetchJson(`/alerts/${alertId}/acknowledge`, {
      method: "POST",
      body: JSON.stringify({ responder_name: responderName }),
    }),
  clearAllAlerts: (elderId: number) =>
    fetchJson(`/elders/${elderId}/alerts/clear`, {
      method: "POST",
    }),
  deleteAlert: (alertId: number) =>
    fetchJson(`/alerts/${alertId}`, {
      method: "DELETE",
    }),
  triggerTestAlert: (elderId: number = 1, testType: string = "panic") =>
    fetchJson(`/alerts/test`, {
      method: "POST",
      body: JSON.stringify({ elder_id: elderId, test_type: testType }),
    }),
  getLiveNotifications: () => fetchJson(`/alerts/notifications/live`),

  // Medicines
  getMedicines: (elderId: number) => fetchJson(`/elders/${elderId}/medicines`),
  createMedicine: (elderId: number, data: any) =>
    fetchJson(`/elders/${elderId}/medicines`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getMedicineLogs: (elderId: number) => fetchJson(`/elders/${elderId}/medicine-logs`),
  confirmMedicine: (logId: number) =>
    fetchJson(`/medicine-logs/${logId}/confirm`, {
      method: "POST",
      body: JSON.stringify({ notes: "Confirmed by caregiver via web dashboard" }),
    }),

  // Away Mode & Consent
  toggleAwayMode: (elderId: number, away: boolean) =>
    fetchJson(`/elders/${elderId}/away-mode?away=${away}`, {
      method: "POST",
    }),
  acceptConsent: (elderId: number) =>
    fetchJson(`/elders/${elderId}/consent`, {
      method: "POST",
    }),

  // Device health
  getDeviceHealth: (deviceId: string = "cg_device_001") =>
    fetchJson(`/devices/${deviceId}/health`),
};
