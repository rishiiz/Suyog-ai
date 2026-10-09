"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username: email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        let errorMsg = "Login failed. Please check your credentials.";
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

      const data = await res.json();
      localStorage.setItem("suyog_token", data.access_token);
      localStorage.setItem("suyog_user", JSON.stringify(data.user));
      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.leftPanel}>
        <div style={styles.brand}>
          <div style={styles.logo}>S</div>
          <span style={styles.brandName}>Suyog AI</span>
        </div>
        <div style={styles.leftContent}>
          <h1 style={styles.leftHeading}>Caring for your<br />loved ones, always.</h1>
          <p style={styles.leftSubtext}>
            Monitor activity, track medicines, and receive instant safety alerts —
            so you can have peace of mind even when you're away.
          </p>
          <div style={styles.features}>
            {["Medicine reminders with physical confirmation", "Room motion monitoring via IoT sensors", "Staged emergency alerts to family contacts"].map((f, i) => (
              <div key={i} style={styles.featureItem}>
                <div style={styles.featureDot} />
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={styles.leftFooter}>

        </div>
      </div>

      <div style={styles.rightPanel}>
        <div style={styles.formCard}>
          <div style={styles.formHeader}>
            <h2 style={styles.formTitle}>Welcome back</h2>
            <p style={styles.formSubtitle}>Sign in to your caregiver account</p>
          </div>

          {error && (
            <div style={styles.errorBox}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.input}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div style={styles.field}>
              <div style={styles.labelRow}>
                <label style={styles.label}>Password</label>
                <a href="#" style={styles.forgotLink}>Forgot password?</a>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
              />
            </div>

            <button type="submit" style={loading ? styles.buttonDisabled : styles.button} disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div style={styles.divider}>
            <span style={styles.dividerLine} />
            <span style={styles.dividerText}>or continue with demo</span>
            <span style={styles.dividerLine} />
          </div>

          <button
            style={styles.demoButton}
            onClick={() => {
              setEmail("rohit.kulkarni@example.com");
              setPassword("caregiver123");
            }}
          >
            Use Demo Account
          </button>

          <p style={styles.signupPrompt}>
            Don't have an account?{" "}
            <Link href="/signup" style={styles.signupLink}>Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: "flex",
    minHeight: "100vh",
    backgroundColor: "#f8fafc",
  },
  leftPanel: {
    flex: "0 0 45%",
    backgroundColor: "#1e3a5f",
    color: "#fff",
    display: "flex",
    flexDirection: "column",
    padding: "40px 48px",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "auto",
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#3b82f6",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 18,
    color: "#fff",
  },
  brandName: {
    fontSize: 18,
    fontWeight: 600,
    color: "#fff",
  },
  leftContent: {
    marginBottom: 48,
  },
  leftHeading: {
    fontSize: 36,
    fontWeight: 700,
    lineHeight: 1.3,
    marginBottom: 16,
    color: "#fff",
  },
  leftSubtext: {
    fontSize: 15,
    color: "#93c5fd",
    lineHeight: 1.7,
    marginBottom: 32,
  },
  features: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  featureItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    fontSize: 14,
    color: "#bfdbfe",
  },
  featureDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    backgroundColor: "#60a5fa",
    marginTop: 6,
    flexShrink: 0,
  },
  leftFooter: {
    fontSize: 12,
    color: "#60a5fa",
    marginTop: "auto",
    paddingTop: 24,
    borderTop: "1px solid rgba(255,255,255,0.1)",
  },
  rightPanel: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 24px",
  },
  formCard: {
    width: "100%",
    maxWidth: 420,
  },
  formHeader: {
    marginBottom: 28,
  },
  formTitle: {
    fontSize: 26,
    fontWeight: 700,
    color: "#1e293b",
    marginBottom: 6,
  },
  formSubtitle: {
    fontSize: 14,
    color: "#64748b",
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
  },
  labelRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: 13,
    fontWeight: 500,
    color: "#374151",
  },
  forgotLink: {
    fontSize: 12,
    color: "#2563eb",
    cursor: "pointer",
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
    transition: "border-color 0.15s",
  },
  button: {
    marginTop: 6,
    width: "100%",
    padding: "11px 0",
    backgroundColor: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    transition: "background-color 0.15s",
  },
  buttonDisabled: {
    marginTop: 6,
    width: "100%",
    padding: "11px 0",
    backgroundColor: "#93c5fd",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "not-allowed",
  },
  divider: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    margin: "24px 0",
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e5e7eb",
  },
  dividerText: {
    fontSize: 12,
    color: "#9ca3af",
    whiteSpace: "nowrap",
  },
  demoButton: {
    width: "100%",
    padding: "10px 0",
    backgroundColor: "#f1f5f9",
    color: "#475569",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    marginBottom: 20,
    transition: "background-color 0.15s",
  },
  signupPrompt: {
    textAlign: "center",
    fontSize: 13,
    color: "#64748b",
  },
  signupLink: {
    color: "#2563eb",
    fontWeight: 500,
    textDecoration: "underline",
    cursor: "pointer",
  },
};
