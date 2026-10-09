"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function SignupPage() {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone_number: "",
    password: "",
    confirm: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.full_name,
          full_name: form.full_name,
          email: form.email,
          phone: form.phone_number,
          phone_number: form.phone_number,
          password: form.password,
          role: "caregiver",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        let errorMsg = "Registration failed. Please try again.";
        if (data?.detail) {
          if (typeof data.detail === "string") {
            errorMsg = data.detail;
          } else if (Array.isArray(data.detail)) {
            errorMsg = data.detail.map((d: any) => d.msg || JSON.stringify(d)).join(", ");
          } else if (typeof data.detail === "object") {
            errorMsg = JSON.stringify(data.detail);
          }
        }
        throw new Error(errorMsg);
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={styles.page}>
        <div style={styles.successCard}>
          <div style={styles.successIcon}>✓</div>
          <h2 style={styles.successTitle}>Account created!</h2>
          <p style={styles.successText}>
            Your caregiver account is ready. Sign in to start monitoring.
          </p>
          <Link href="/" style={styles.button as React.CSSProperties}>
            Go to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.topBar}>
          <Link href="/" style={styles.logoLink}>
            <div style={styles.logoIcon}>S</div>
            <span style={styles.logoText}>Suyog AI</span>
          </Link>
        </div>

        <div style={styles.formCard}>
          <div style={styles.formHeader}>
            <h2 style={styles.formTitle}>Create your account</h2>
            <p style={styles.formSubtitle}>
              Register as a caregiver to monitor your loved one's safety
            </p>
          </div>

          {error && <div style={styles.errorBox}>{error}</div>}

          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>Full name</label>
              <input
                type="text"
                value={form.full_name}
                onChange={(e) => update("full_name", e.target.value)}
                style={styles.input}
                placeholder="Full name"
                required
                autoComplete="name"
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Email address</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                style={styles.input}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>
                Phone number{" "}
                <span style={styles.optionalTag}>for SMS alerts</span>
              </label>
              <input
                type="tel"
                value={form.phone_number}
                onChange={(e) => update("phone_number", e.target.value)}
                style={styles.input}
                placeholder="+91 00000 00000"
                autoComplete="tel"
              />
            </div>

            <div style={styles.twoCol}>
              <div style={styles.field}>
                <label style={styles.label}>Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  style={styles.input}
                  placeholder="Min. 8 characters"
                  required
                  autoComplete="new-password"
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Confirm password</label>
                <input
                  type="password"
                  value={form.confirm}
                  onChange={(e) => update("confirm", e.target.value)}
                  style={styles.input}
                  placeholder="Repeat password"
                  required
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div style={styles.notice}>
              <strong>Note:</strong> After registration, an admin will link your account to an elder's device.
              You'll receive a confirmation email within 24 hours.
            </div>

            <button
              type="submit"
              style={loading ? styles.buttonDisabled : styles.button}
              disabled={loading}
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p style={styles.loginPrompt}>
            Already have an account?{" "}
            <Link href="/" style={styles.loginLink}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#f8fafc",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
  },
  container: {
    width: "100%",
    maxWidth: 520,
  },
  topBar: {
    marginBottom: 24,
    display: "flex",
    justifyContent: "center",
  },
  logoLink: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    textDecoration: "none",
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#2563eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 18,
    color: "#fff",
  },
  logoText: {
    fontSize: 18,
    fontWeight: 700,
    color: "#1e293b",
  },
  formCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    padding: "36px 40px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  },
  formHeader: {
    marginBottom: 28,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: "#1e293b",
    marginBottom: 6,
  },
  formSubtitle: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 1.5,
  },
  errorBox: {
    backgroundColor: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    borderRadius: 8,
    padding: "12px 16px",
    fontSize: 13,
    marginBottom: 20,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    flex: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: 500,
    color: "#374151",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  optionalTag: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: 400,
    backgroundColor: "#f1f5f9",
    borderRadius: 4,
    padding: "1px 6px",
  },
  twoCol: {
    display: "flex",
    gap: 16,
  },
  input: {
    width: "100%",
    padding: "10px 14px",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    fontSize: 14,
    color: "#1e293b",
    backgroundColor: "#fff",
    outline: "none",
  },
  notice: {
    backgroundColor: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: 8,
    padding: "12px 16px",
    fontSize: 12,
    color: "#1d4ed8",
    lineHeight: 1.6,
  },
  button: {
    display: "block",
    textAlign: "center",
    width: "100%",
    padding: "11px 0",
    backgroundColor: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 4,
    textDecoration: "none",
  },
  buttonDisabled: {
    width: "100%",
    padding: "11px 0",
    backgroundColor: "#93c5fd",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "not-allowed",
    marginTop: 4,
  },
  loginPrompt: {
    textAlign: "center",
    fontSize: 13,
    color: "#64748b",
    marginTop: 24,
  },
  loginLink: {
    color: "#2563eb",
    fontWeight: 500,
    textDecoration: "underline",
  },
  successCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    padding: "48px 40px",
    maxWidth: 400,
    width: "100%",
    textAlign: "center",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  },
  successIcon: {
    width: 56,
    height: 56,
    borderRadius: "50%",
    backgroundColor: "#dcfce7",
    color: "#16a34a",
    fontSize: 24,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 20px",
    fontWeight: 700,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: "#1e293b",
    marginBottom: 10,
  },
  successText: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 1.6,
    marginBottom: 24,
  },
};
