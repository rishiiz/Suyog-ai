"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export const UserProfileMenu: React.FC = () => {
  const router = useRouter();
  const [user, setUser] = useState<{ id?: number; name?: string; email?: string; role?: string } | null>(null);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1. Try local storage first for quick render
    try {
      const stored = localStorage.getItem("suyog_user");
      if (stored) setUser(JSON.parse(stored));
    } catch {}

    // 2. Fetch fresh profile from API
    api.getMe()
      .then((me) => {
        if (me) {
          setUser(me);
          localStorage.setItem("suyog_user", JSON.stringify(me));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = () => {
    localStorage.clear();
    router.push("/");
  };

  const name = user?.name || "Caregiver";
  const email = user?.email || "caregiver@example.com";
  const initial = (name.trim().charAt(0) || "C").toUpperCase();

  return (
    <div ref={menuRef} style={styles.container}>
      <button
        onClick={() => setOpen(!open)}
        style={styles.triggerButton}
        title="Account Profile"
        aria-label="User Profile Menu"
      >
        <div style={styles.avatar}>{initial}</div>
        <div style={styles.textContainer}>
          <span style={styles.userName}>{name}</span>
          <span style={styles.userRole}>Caregiver</span>
        </div>
        <span style={styles.chevron}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={styles.dropdown}>
          <div style={styles.dropdownHeader}>
            <div style={styles.dropdownAvatar}>{initial}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={styles.dropdownName}>{name}</div>
              <div style={styles.dropdownEmail}>{email}</div>
            </div>
          </div>

          <div style={styles.dropdownDivider} />

          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            style={styles.dropdownItem}
          >
            <span style={styles.itemIcon}>👤</span>
            <div>
              <div style={styles.itemTitle}>Profile & Settings</div>
              <div style={styles.itemSub}>Manage personal info & password</div>
            </div>
          </Link>

          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            style={styles.dropdownItem}
          >
            <span style={styles.itemIcon}>📊</span>
            <div>
              <div style={styles.itemTitle}>Elder Dashboard</div>
              <div style={styles.itemSub}>Return to monitoring console</div>
            </div>
          </Link>

          <div style={styles.dropdownDivider} />

          <button onClick={handleSignOut} style={styles.signOutButton}>
            <span style={styles.itemIcon}>🚪</span>
            <span>Sign out</span>
          </button>
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
  triggerButton: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "6px 12px 6px 8px",
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 30,
    cursor: "pointer",
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
    transition: "all 0.15s ease",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 14,
    flexShrink: 0,
  },
  textContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    textAlign: "left",
    lineHeight: 1.2,
  },
  userName: {
    fontSize: 13,
    fontWeight: 600,
    color: "#1e293b",
    maxWidth: 130,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  userRole: {
    fontSize: 10,
    color: "#64748b",
  },
  chevron: {
    fontSize: 9,
    color: "#94a3b8",
    marginLeft: 2,
  },
  dropdown: {
    position: "absolute",
    top: "calc(100% + 8px)",
    right: 0,
    width: 250,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05)",
    padding: "8px 0",
    zIndex: 1000,
    animation: "fadeIn 0.15s ease",
  },
  dropdownHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 16px",
  },
  dropdownAvatar: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    backgroundColor: "#dbeafe",
    color: "#1d4ed8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 15,
    flexShrink: 0,
  },
  dropdownName: {
    fontSize: 13,
    fontWeight: 700,
    color: "#1e293b",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  dropdownEmail: {
    fontSize: 11,
    color: "#64748b",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: "#f1f5f9",
    margin: "6px 0",
  },
  dropdownItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 16px",
    textDecoration: "none",
    color: "#334155",
    transition: "background-color 0.15s",
    cursor: "pointer",
  },
  itemIcon: {
    fontSize: 16,
    width: 20,
    textAlign: "center",
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "#1e293b",
  },
  itemSub: {
    fontSize: 11,
    color: "#94a3b8",
  },
  signOutButton: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 16px",
    backgroundColor: "transparent",
    border: "none",
    textAlign: "left",
    fontSize: 13,
    fontWeight: 600,
    color: "#dc2626",
    cursor: "pointer",
    transition: "background-color 0.15s",
  },
};
