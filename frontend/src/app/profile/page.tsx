"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import { AlertBellPopover } from "@/components/AlertBellPopover";
import { api } from "@/lib/api";

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Profile fields state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Password fields state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Elder registration modal
  const [showAddElderModal, setShowAddElderModal] = useState(false);
  const [elderForm, setElderForm] = useState({
    name: "",
    age: "",
    phone: "",
    address: "",
    conditions: "",
  });
  const [savingElder, setSavingElder] = useState(false);

  async function loadUserData() {
    try {
      const me = await api.getMe();
      setUser(me);
      setName(me.name || "");
      setPhone(me.phone || "");
      setEmail(me.email || "");
      localStorage.setItem("suyog_user", JSON.stringify(me));
    } catch (err: any) {
      console.error("Failed to load user profile:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUserData();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const res = await api.updateProfile({ name, phone, email });
      if (res?.user) {
        setUser((prev: any) => ({ ...prev, ...res.user }));
        localStorage.setItem("suyog_user", JSON.stringify(res.user));
      }
      setProfileMsg({ type: "success", text: "Your profile information has been successfully updated!" });
      setTimeout(() => setProfileMsg(null), 5000);
    } catch (err: any) {
      setProfileMsg({ type: "error", text: err.message || "Failed to update profile. Please try again." });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "error", text: "New passwords do not match." });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMsg({ type: "error", text: "New password must be at least 8 characters." });
      return;
    }

    setSavingPassword(true);
    try {
      await api.updateProfile({ current_password: currentPassword, new_password: newPassword });
      setPasswordMsg({ type: "success", text: "Password changed successfully!" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordMsg(null), 5000);
    } catch (err: any) {
      setPasswordMsg({ type: "error", text: err.message || "Failed to change password. Check your current password." });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleCreateElder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!elderForm.name || !elderForm.age) {
      alert("Please fill in the elder name and age.");
      return;
    }
    setSavingElder(true);
    try {
      await api.createElder({
        name: elderForm.name,
        age: parseInt(elderForm.age, 10) || 70,
        phone: elderForm.phone || undefined,
        address: elderForm.address || "Home",
        conditions: elderForm.conditions || undefined,
        user_id: user?.id,
      });
      setShowAddElderModal(false);
      setElderForm({ name: "", age: "", phone: "", address: "", conditions: "" });
      await loadUserData();
    } catch (err: any) {
      alert(err.message || "Failed to add elder profile.");
    } finally {
      setSavingElder(false);
    }
  };

  const initial = (name.trim().charAt(0) || "U").toUpperCase();

  return (
    <div style={s.page}>
      <Sidebar activeTab="settings" />

      <main style={s.main}>
        {/* Top Header */}
        <header style={s.header}>
          <div>
            <h1 style={s.pageTitle}>Account & Profile</h1>
            <p style={s.pageSubtitle}>Manage your caregiver credentials, contact info, and linked elder profiles</p>
          </div>
          <div style={s.headerRight}>
            <AlertBellPopover />
            <UserProfileMenu />
          </div>
        </header>

        {loading ? (
          <div style={s.loadingBox}>Loading your profile...</div>
        ) : (
          <div style={s.content}>
            {/* User Overview Card */}
            <div style={s.overviewCard}>
              <div style={s.avatarLarge}>{initial}</div>
              <div style={s.overviewInfo}>
                <h2 style={s.overviewName}>{user?.name || "Caregiver"}</h2>
                <div style={s.overviewRole}>
                  <span>Verified Caregiver</span> · <span>Account #{user?.id || 1}</span>
                </div>
                <div style={s.overviewMeta}>
                  <span>✉ {user?.email}</span>
                  {user?.phone && <span>📞 {user?.phone}</span>}
                </div>
              </div>
            </div>

            <div style={s.grid}>
              {/* Form 1: Personal Info */}
              <div style={s.card}>
                <div style={s.cardHeader}>
                  <h3 style={s.cardTitle}>Personal Information</h3>
                  <p style={s.cardSubtitle}>Update your name, contact phone number, and notification email</p>
                </div>

                {profileMsg && (
                  <div style={profileMsg.type === "success" ? s.successBanner : s.errorBanner}>
                    {profileMsg.text}
                  </div>
                )}

                <form onSubmit={handleUpdateProfile} style={s.form}>
                  <div style={s.field}>
                    <label style={s.label}>Full Name</label>
                    <input
                      type="text"
                      required
                      style={s.input}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Full name"
                    />
                  </div>

                  <div style={s.field}>
                    <label style={s.label}>Email Address</label>
                    <input
                      type="email"
                      required
                      style={s.input}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your.email@example.com"
                    />
                  </div>

                  <div style={s.field}>
                    <label style={s.label}>
                      Phone Number <span style={s.labelHint}>(receives emergency SMS alerts)</span>
                    </label>
                    <input
                      type="tel"
                      style={s.input}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 00000 00000"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={savingProfile}
                    style={savingProfile ? s.submitBtnDisabled : s.submitBtn}
                  >
                    {savingProfile ? "Saving changes..." : "Save Profile Information"}
                  </button>
                </form>
              </div>

              {/* Form 2: Password & Security */}
              <div style={s.card}>
                <div style={s.cardHeader}>
                  <h3 style={s.cardTitle}>Security & Password</h3>
                  <p style={s.cardSubtitle}>Ensure your caregiver dashboard is secured with a strong password</p>
                </div>

                {passwordMsg && (
                  <div style={passwordMsg.type === "success" ? s.successBanner : s.errorBanner}>
                    {passwordMsg.text}
                  </div>
                )}

                <form onSubmit={handleUpdatePassword} style={s.form}>
                  <div style={s.field}>
                    <label style={s.label}>Current Password</label>
                    <input
                      type="password"
                      required
                      style={s.input}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                    />
                  </div>

                  <div style={s.field}>
                    <label style={s.label}>New Password</label>
                    <input
                      type="password"
                      required
                      style={s.input}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                    />
                  </div>

                  <div style={s.field}>
                    <label style={s.label}>Confirm New Password</label>
                    <input
                      type="password"
                      required
                      style={s.input}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                      autoComplete="new-password"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={savingPassword}
                    style={savingPassword ? s.submitBtnDisabled : s.submitBtn}
                  >
                    {savingPassword ? "Updating password..." : "Update Password"}
                  </button>
                </form>
              </div>
            </div>

            {/* Linked Elders Section */}
            <div style={s.eldersSection}>
              <div style={s.sectionHeader}>
                <div>
                  <h3 style={s.sectionTitle}>Linked Elder Profiles</h3>
                  <p style={s.sectionSubtitle}>Loved ones assigned to your caregiver monitoring account</p>
                </div>
                <button onClick={() => setShowAddElderModal(true)} style={s.addElderBtn}>
                  + Add Elder Profile
                </button>
              </div>

              {(!user?.elders || user.elders.length === 0) ? (
                <div style={s.emptyEldersCard}>
                  <div style={s.emptyIcon}>👴👵</div>
                  <h4 style={s.emptyTitle}>No Elder Profile Linked Yet</h4>
                  <p style={s.emptyDesc}>
                    You haven't linked an elder profile to your account yet. Add an elder to begin receiving motion alerts, scheduling medicines, and tracking IoT telemetry.
                  </p>
                  <button onClick={() => setShowAddElderModal(true)} style={s.primaryActionBtn}>
                    Link Your First Elder
                  </button>
                </div>
              ) : (
                <div style={s.elderList}>
                  {user.elders.map((elder: any) => (
                    <div key={elder.id} style={s.elderCard}>
                      <div style={s.elderAvatar}>{elder.name.charAt(0)}</div>
                      <div style={{ flex: 1 }}>
                        <div style={s.elderNameRow}>
                          <h4 style={s.elderName}>{elder.name}</h4>
                          <span style={s.elderRelationBadge}>{elder.relationship || "Family"}</span>
                        </div>
                        <div style={s.elderDetails}>
                          <span>Age: {elder.age} yrs</span>
                          {elder.phone && <span>· Phone: {elder.phone}</span>}
                          <span>· Priority #{elder.priority || 1}</span>
                        </div>
                      </div>
                      <Link href="/dashboard" style={s.viewDashboardLink}>
                        View in Dashboard ➔
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal for adding elder */}
        {showAddElderModal && (
          <div style={s.modalOverlay}>
            <div style={s.modalBox}>
              <div style={s.modalHeader}>
                <h3 style={s.modalTitle}>Link New Elder Profile</h3>
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
                    disabled={savingElder}
                    style={s.submitBtn}
                  >
                    {savingElder ? "Saving..." : "Save & Link Elder"}
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
    backgroundColor: "#fff",
    borderBottom: "1px solid #f1f5f9",
  },
  pageTitle: { fontSize: 20, fontWeight: 700, color: "#1e293b", margin: 0 },
  pageSubtitle: { fontSize: 12, color: "#94a3b8", marginTop: 2, margin: 0 },
  headerRight: { display: "flex", alignItems: "center", gap: 14 },
  loadingBox: { padding: "40px 32px", color: "#64748b", fontSize: 14 },
  content: { padding: "28px 32px", maxWidth: 1100, display: "flex", flexDirection: "column", gap: 24 },

  overviewCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    padding: "24px 28px",
    display: "flex",
    alignItems: "center",
    gap: 20,
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  avatarLarge: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    backgroundColor: "#2563eb",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 26,
    fontWeight: 700,
  },
  overviewInfo: { flex: 1 },
  overviewName: { fontSize: 20, fontWeight: 700, color: "#1e293b", margin: "0 0 4px" },
  overviewRole: { fontSize: 13, color: "#64748b", fontWeight: 500, marginBottom: 6 },
  overviewMeta: { display: "flex", gap: 16, fontSize: 13, color: "#475569" },

  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    padding: "24px 26px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  cardHeader: { marginBottom: 20 },
  cardTitle: { fontSize: 16, fontWeight: 700, color: "#1e293b", margin: "0 0 4px" },
  cardSubtitle: { fontSize: 12, color: "#64748b", margin: 0 },

  form: { display: "flex", flexDirection: "column", gap: 16 },
  field: { display: "flex", flexDirection: "column", gap: 6, flex: 1 },
  fieldRow: { display: "flex", gap: 12 },
  label: { fontSize: 13, fontWeight: 600, color: "#334155" },
  labelHint: { fontSize: 11, color: "#94a3b8", fontWeight: 400 },
  input: {
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    fontSize: 14,
    color: "#1e293b",
    outline: "none",
  },
  submitBtn: {
    padding: "11px 18px",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 6,
    transition: "background-color 0.15s",
  },
  submitBtnDisabled: {
    padding: "11px 18px",
    backgroundColor: "#93c5fd",
    color: "#ffffff",
    border: "none",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: "not-allowed",
    marginTop: 6,
  },
  successBanner: {
    backgroundColor: "#dcfce7",
    color: "#15803d",
    border: "1px solid #bbf7d0",
    padding: "10px 14px",
    borderRadius: 8,
    fontSize: 13,
    marginBottom: 16,
  },
  errorBanner: {
    backgroundColor: "#fef2f2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
    padding: "10px 14px",
    borderRadius: 8,
    fontSize: 13,
    marginBottom: 16,
  },

  // Elders section
  eldersSection: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    padding: "24px 26px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: "#1e293b", margin: "0 0 4px" },
  sectionSubtitle: { fontSize: 12, color: "#64748b", margin: 0 },
  addElderBtn: {
    backgroundColor: "#eff6ff",
    color: "#2563eb",
    border: "1px solid #bfdbfe",
    padding: "8px 16px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },

  emptyEldersCard: {
    textAlign: "center",
    padding: "36px 20px",
    border: "2px dashed #e2e8f0",
    borderRadius: 10,
  },
  emptyIcon: { fontSize: 36, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: 700, color: "#1e293b", margin: "0 0 6px" },
  emptyDesc: { fontSize: 13, color: "#64748b", maxWidth: 460, margin: "0 auto 20px", lineHeight: 1.5 },
  primaryActionBtn: {
    backgroundColor: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "9px 20px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },

  elderList: { display: "flex", flexDirection: "column", gap: 12 },
  elderCard: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "16px 20px",
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
  },
  elderAvatar: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    backgroundColor: "#dbeafe",
    color: "#1d4ed8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    fontWeight: 700,
  },
  elderNameRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 4 },
  elderName: { fontSize: 15, fontWeight: 700, color: "#1e293b", margin: 0 },
  elderRelationBadge: {
    backgroundColor: "#e0e7ff",
    color: "#3730a3",
    fontSize: 11,
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: 12,
  },
  elderDetails: { fontSize: 12, color: "#64748b" },
  viewDashboardLink: {
    fontSize: 13,
    fontWeight: 600,
    color: "#2563eb",
    textDecoration: "none",
  },

  // Modal
  modalOverlay: {
    position: "fixed",
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
  modalTitle: { fontSize: 18, fontWeight: 700, color: "#1e293b", margin: 0 },
  modalClose: { border: "none", background: "transparent", fontSize: 16, cursor: "pointer", color: "#94a3b8" },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 },
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
};
