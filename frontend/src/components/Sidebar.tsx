"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface SidebarProps {
  activeTab: "dashboard" | "medicines" | "rooms" | "alerts" | "settings";
  alertCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, alertCount = 0 }) => {
  const router = useRouter();
  const [userName, setUserName] = useState("Rohit Kulkarni");
  const [userRole, setUserRole] = useState("Caregiver");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("suyog_user");
      if (stored) {
        const u = JSON.parse(stored);
        if (u.name) setUserName(u.name);
        if (u.role) setUserRole(u.role);
      }
    } catch {}
  }, []);

  const handleSignOut = () => {
    localStorage.clear();
    router.push("/");
  };

  const navItems = [
    { key: "dashboard", label: "Dashboard", icon: "⊞", href: "/dashboard" },
    { key: "medicines", label: "Medicines", icon: "💊", href: "/medicines" },
    { key: "rooms", label: "Rooms", icon: "🏠", href: "/rooms" },
    { key: "alerts", label: "Alerts", icon: "🔔", href: "/alerts", badge: alertCount > 0 ? alertCount : undefined },
  ];

  return (
    <aside style={s.sidebar}>
      <div style={s.sidebarTop}>
        <Link href="/dashboard" style={{ textDecoration: "none" }}>
          <div style={s.sidebarLogo}>
            <div style={s.logoIcon}>S</div>
            <div>
              <div style={s.logoName}>Suyog AI</div>
              <div style={s.logoSub}>Elder Care Monitor</div>
            </div>
          </div>
        </Link>

        <nav style={s.nav}>
          {navItems.map((item) => {
            const isActive = activeTab === item.key;
            return (
              <Link
                key={item.key}
                href={item.href}
                style={{
                  ...s.navItem,
                  ...(isActive ? s.navItemActive : {}),
                }}
              >
                <span style={s.navIcon}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge !== undefined && (
                  <span style={s.badgePill}>{item.badge}</span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div style={s.sidebarBottom}>
        <div style={s.sidebarUser}>
          <div style={s.avatar}>{userName.charAt(0).toUpperCase()}</div>
          <div style={{ overflow: "hidden" }}>
            <div style={s.userName}>{userName}</div>
            <div style={s.userRole}>{userRole}</div>
          </div>
        </div>
        <button style={s.signOutBtn} onClick={handleSignOut}>
          Sign out
        </button>
      </div>
    </aside>
  );
};

const s: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 220,
    backgroundColor: "#ffffff",
    borderRight: "1px solid #e2e8f0",
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    minHeight: "100vh",
    userSelect: "none",
  },
  sidebarTop: {
    flex: 1,
    padding: "24px 0",
  },
  sidebarLogo: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0 20px 24px",
    borderBottom: "1px solid #f1f5f9",
    cursor: "pointer",
  },
  logoIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "#2563eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 16,
    color: "#fff",
    flexShrink: 0,
  },
  logoName: {
    fontSize: 14,
    fontWeight: 700,
    color: "#1e293b",
  },
  logoSub: {
    fontSize: 10,
    color: "#94a3b8",
  },
  nav: {
    marginTop: 14,
    display: "flex",
    flexDirection: "column",
    gap: 3,
    padding: "0 10px",
  },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "9px 12px",
    borderRadius: 8,
    fontSize: 13,
    color: "#64748b",
    textDecoration: "none",
    transition: "background-color 0.15s, color 0.15s",
  },
  navItemActive: {
    color: "#2563eb",
    backgroundColor: "#eff6ff",
    fontWeight: 600,
  },
  navIcon: {
    fontSize: 16,
    width: 20,
    textAlign: "center",
  },
  badgePill: {
    backgroundColor: "#ef4444",
    color: "#ffffff",
    fontSize: 11,
    fontWeight: 700,
    padding: "1px 6px",
    borderRadius: 10,
    marginLeft: 6,
  },
  sidebarBottom: {
    padding: "16px 20px",
    borderTop: "1px solid #f1f5f9",
  },
  sidebarUser: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    backgroundColor: "#dbeafe",
    color: "#1d4ed8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 600,
    fontSize: 13,
    flexShrink: 0,
  },
  userName: {
    fontSize: 12,
    fontWeight: 600,
    color: "#1e293b",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  userRole: {
    fontSize: 11,
    color: "#94a3b8",
  },
  signOutBtn: {
    width: "100%",
    padding: "7px 0",
    backgroundColor: "transparent",
    border: "1px solid #e2e8f0",
    borderRadius: 7,
    fontSize: 12,
    color: "#64748b",
    cursor: "pointer",
    transition: "background-color 0.15s",
  },
};
