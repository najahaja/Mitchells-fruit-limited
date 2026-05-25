import React, { useRef, useState, useEffect, useCallback } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { VaxisLogo } from "./VaxisLogo";
import {
  ChartBarIncreasing,
  ChartNoAxesColumnIncreasing,
  PhoneCall,
  Settings,
  SquareMenu,
  LogOut,
  ChevronUp,
  Menu,
  X,
  RefreshCw,
  Pause,
  Play,
  ShoppingBag,
  Bot,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../hooks/useAuth";
import {
  getSettingsApi,
  updateSettingsApi,
  getDashboardStatsApi,
} from "../api/api";
import type { DashboardStats } from "../type";

// Palette
const C = {
  white: "#FFFFFF",
  bg: "#F8F8FC",
  purple: "#534AB7",
  purpleAlt: "#7F77DD",
  purpleLight: "rgba(83,74,183,0.08)",
  green: "#1DB87A",
  greenLight: "rgba(29,184,122,0.09)",
  red: "#E54545",
  border: "#EAEAF2",
  text: "#0F0F1A",
  textSub: "#525270",
  textMuted: "#8888A8",
  textLight: "#C0C0D0",
  font: "'Sora', sans-serif",
};

const SIDEBAR_CSS = `
  @keyframes vxDropIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
  @keyframes ldot     { 0%,100%{box-shadow:0 0 0 0 rgba(29,184,122,.5)} 50%{box-shadow:0 0 0 5px rgba(29,184,122,0)} }
  @keyframes spin     { to{transform:rotate(360deg)} }
  @keyframes vxSkeleton { 0%,100%{opacity:.4} 50%{opacity:.9} }

  .vx-nav-link {
    display:flex; align-items:center; gap:10px; padding:9px 11px; border-radius:10px;
    text-decoration:none; font-family:'Sora',sans-serif; font-size:.84rem; font-weight:600;
    color:${C.textSub}; background:transparent; transition:background .15s, color .15s;
    white-space:nowrap; overflow:hidden; box-sizing:border-box;
  }
  .vx-nav-link:hover  { background:rgba(15,15,26,.045); color:${C.text}; }
  .vx-nav-link.active { background:${C.purpleLight}; color:${C.purple}; font-weight:700; }

  .vx-profile-btn {
    display:flex; align-items:center; gap:9px; padding:8px 8px; border-radius:10px;
    background:transparent; border:none; cursor:pointer; width:100%; box-sizing:border-box;
    transition:background .15s;
  }
  .vx-profile-btn:hover { background:${C.purpleLight}; }

  .vx-profile-popup { animation:vxDropIn .18s cubic-bezier(.22,1,.36,1) both; }

  .vx-popup-row {
    display:flex; align-items:center; gap:9px; padding:10px 16px;
    background:none; border:none; width:100%; cursor:pointer;
    font-family:'Sora',sans-serif; font-size:.82rem; font-weight:600; color:${C.textSub};
    transition:background .12s, color .12s; text-align:left; box-sizing:border-box;
  }
  .vx-popup-row:hover { background:${C.bg}; color:${C.text}; }

  .vx-popup-logout {
    display:flex; align-items:center; gap:9px; padding:10px 16px;
    background:none; border:none; width:100%; cursor:pointer;
    font-family:'Sora',sans-serif; font-size:.82rem; font-weight:700; color:${C.red};
    transition:background .12s; text-align:left; box-sizing:border-box;
  }
  .vx-popup-logout:hover { background:rgba(229,69,69,.06); }

  .vx-agent-toggle {
    display:flex; align-items:center; gap:5px;
    font-family:'Sora',sans-serif; font-size:.72rem; font-weight:700;
    border:none; border-radius:7px; padding:5px 10px; cursor:pointer;
    transition:background .15s, color .15s, box-shadow .15s; flex-shrink:0;
  }

  .vx-refresh-btn {
    background:none; border:none; cursor:pointer; padding:2px;
    color:${C.textMuted}; display:flex; align-items:center; transition:color .15s;
    border-radius:4px;
  }
  .vx-refresh-btn:hover { color:${C.purple}; }
  .vx-refresh-btn.spinning svg { animation:spin .6s linear infinite; }

  .vx-stat-cell {
    flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center;
    padding:10px 8px; border-radius:10px; background:${C.bg}; border:1px solid ${C.border};
    gap:2px; min-width:0;
  }
`;

// ─── Nav items (active routes only) ──────────────────────────────────────────
const NAV_ITEMS: { icon: React.ReactElement; label: string; to: string; end?: boolean; badge?: string }[] = [
  { icon: <ChartNoAxesColumnIncreasing size={16} />, label: "Overview", to: "/dashboard", end: true },
  { icon: <Bot size={16} />, label: "Agents", to: "/dashboard/agents" },
  { icon: <PhoneCall size={16} />, label: "Calls & Orders", to: "/dashboard/calls" },
  { icon: <SquareMenu size={16} />, label: "Products", to: "/dashboard/menu", },
  { icon: <ChartBarIncreasing size={16} />, label: "Reports", to: "/dashboard/report" },
  { icon: <Settings size={16} />, label: "Settings", to: "/dashboard/settings" },
];

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ initial, size = 28 }: { initial: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "linear-gradient(135deg,#534AB7,#7F77DD)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: C.font, fontSize: size * 0.3, fontWeight: 800, color: "#fff",
    }}>
      {initial}
    </div>
  );
}

// ─── SidebarContent ───────────────────────────────────────────────────────────
type Props = { collapsed: boolean; onCollapse: () => void; onClose: () => void; isMobile?: boolean };

function SidebarContent({ collapsed, onCollapse, onClose, isMobile }: Props) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // ── Profile popup state ──────────────────────────────────────────────────
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const initial = user?.email?.[0]?.toUpperCase() ?? "?";
  const displayEmail = user?.email ?? "";

  useEffect(() => {
    if (!profileOpen) return;
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node))
        setProfileOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [profileOpen]);

  // ── Agent status ─────────────────────────────────────────────────────────
  const [agentActive, setAgentActive] = useState<boolean | null>(null);
  const [agentToggling, setAgentToggling] = useState(false);

  const fetchAgent = useCallback(async () => {
    try {
      const s = await getSettingsApi();
      setAgentActive(s.is_active);
    } catch { /* silent */ }
  }, []);

  const toggleAgent = async () => {
    if (agentActive === null || agentToggling) return;
    const next = !agentActive;
    setAgentToggling(true);
    setAgentActive(next); // optimistic
    try {
      await updateSettingsApi({ is_active: next });
      toast.success(next ? "Agent is now live" : "Agent paused");
    } catch {
      setAgentActive(!next); // revert on failure
      toast.error("Failed to update agent status");
    } finally {
      setAgentToggling(false);
    }
  };

  // ── Today's stats ─────────────────────────────────────────────────────────
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState(false);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(false);
    try {
      setStats(await getDashboardStatsApi());
    } catch {
      setStatsError(true);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // ── Live clock ────────────────────────────────────────────────────────────
  const [clock, setClock] = useState(() =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );

  // ── Mount: fetch everything, set up refresh intervals ────────────────────
  useEffect(() => {
    fetchAgent();
    fetchStats();
    const clockTick = setInterval(() => setClock(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })), 30_000);
    const agentPoll = setInterval(fetchAgent, 30_000);
    const statsPoll = setInterval(fetchStats, 60_000);
    return () => { clearInterval(clockTick); clearInterval(agentPoll); clearInterval(statsPoll); };
  }, [fetchAgent, fetchStats]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const w = collapsed ? 64 : 240;
  const isActive = agentActive === true;

  return (
    <>
      <style>{SIDEBAR_CSS}</style>
      <aside style={{
        fontFamily: C.font, width: w, minWidth: w, flexShrink: 0,
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        background: C.white, borderRight: `1px solid ${C.border}`,
        padding: "14px 10px",
        transition: "width .25s cubic-bezier(.4,0,.2,1), min-width .25s cubic-bezier(.4,0,.2,1)",
        minHeight: "100vh", height: "100vh", overflowY: "auto", overflowX: "hidden",
        boxSizing: "border-box",
      }}>

        {/* ══ TOP SECTION ════════════════════════════════════════════════════ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>

          {/* Logo row */}
          <div style={{
            display: "flex", alignItems: "center",
            justifyContent: collapsed ? "center" : "space-between",
            padding: "2px 2px 14px",
            borderBottom: `1px solid ${C.border}`, marginBottom: 10,
          }}>
            {!collapsed && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => navigate("/dashboard")}>
                <VaxisLogo height={24} color="#0F0F1A" />
                <span style={{ fontFamily: "Sora,sans-serif", fontSize: "1.1rem", fontWeight: 800, letterSpacing: "-.03em", color: "#0F0F1A" }}>Mitchell's</span>
              </div>
            )}
            {isMobile ? (
              <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: C.textMuted, display: "flex", alignItems: "center", borderRadius: 7, marginLeft: collapsed ? 0 : "auto" }}>
                <X size={17} />
              </button>
            ) : (
              <button onClick={onCollapse} style={{
                background: "none", border: `1px solid ${C.border}`, cursor: "pointer",
                width: 26, height: 26, borderRadius: 7,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: C.textMuted, flexShrink: 0, marginLeft: collapsed ? 0 : "auto",
                fontFamily: C.font, fontSize: "1rem", lineHeight: 1,
                transition: "background .15s, border-color .15s, color .15s",
              }}
                onMouseOver={(e) => { e.currentTarget.style.background = C.purpleLight; e.currentTarget.style.borderColor = C.purpleAlt; e.currentTarget.style.color = C.purple; }}
                onMouseOut={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textMuted; }}
              >
                {collapsed ? "›" : "‹"}
              </button>
            )}
          </div>

          {/* ── Agent Status Card ─────────────────────────────────────────── */}
          {collapsed ? (
            /* Collapsed: just a pulsing dot */
            <div
              title={agentActive === null ? "Loading…" : isActive ? "Agent is live" : "Agent is paused"}
              style={{ display: "flex", justifyContent: "center", padding: "8px 0 10px" }}
            >
              <div style={{
                width: 10, height: 10, borderRadius: "50%",
                background: agentActive === null ? C.textLight : isActive ? C.green : C.textLight,
                animation: isActive ? "ldot 1.8s ease-in-out infinite" : "none",
                flexShrink: 0,
              }} />
            </div>
          ) : (
            /* Expanded: full status card */
            <div style={{
              borderRadius: 12, padding: "12px 13px", marginBottom: 6,
              border: `1.5px solid ${agentActive === null ? C.border : isActive ? "rgba(29,184,122,.28)" : C.border}`,
              background: agentActive === null ? C.bg : isActive ? "rgba(29,184,122,.06)" : C.bg,
              transition: "border-color .3s, background .3s",
            }}>
              {/* Row 1: status + clock */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {agentActive === null ? (
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.textLight, animation: "vxSkeleton 1.2s ease infinite" }} />
                  ) : (
                    <div style={{
                      width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                      background: isActive ? C.green : C.textLight,
                      animation: isActive ? "ldot 1.8s ease-in-out infinite" : "none",
                    }} />
                  )}
                  <span style={{
                    fontFamily: C.font, fontSize: ".7rem", fontWeight: 800,
                    letterSpacing: ".07em", textTransform: "uppercase",
                    color: agentActive === null ? C.textLight : isActive ? C.green : C.textMuted,
                  }}>
                    {agentActive === null ? "Loading" : isActive ? "Live" : "Paused"}
                  </span>
                </div>
                <span style={{ fontFamily: C.font, fontSize: ".72rem", fontWeight: 600, color: C.textMuted }}>
                  {clock}
                </span>
              </div>

              {/* Row 2: description + toggle button */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{
                  fontFamily: C.font, fontSize: ".75rem", fontWeight: 500,
                  color: isActive ? C.textSub : C.textMuted, lineHeight: 1.4,
                }}>
                  {agentActive === null ? "Fetching status…" : isActive ? "Answering all calls" : "Not answering calls"}
                </span>

                <button
                  className="vx-agent-toggle"
                  onClick={toggleAgent}
                  disabled={agentActive === null || agentToggling}
                  style={{
                    background: agentToggling
                      ? C.bg
                      : isActive
                        ? "rgba(229,69,69,.10)"
                        : "rgba(29,184,122,.12)",
                    color: agentToggling
                      ? C.textMuted
                      : isActive ? C.red : C.green,
                    opacity: agentActive === null ? 0.5 : 1,
                  }}
                >
                  {agentToggling ? (
                    <div style={{ width: 10, height: 10, border: `2px solid ${C.textMuted}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin .6s linear infinite" }} />
                  ) : isActive ? (
                    <><Pause size={10} /> Pause</>
                  ) : (
                    <><Play size={10} /> Go Live</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── Nav items ─────────────────────────────────────────────────── */}
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={isMobile ? onClose : undefined}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) => `vx-nav-link${isActive ? " active" : ""}`}
              style={{ justifyContent: collapsed ? "center" : "flex-start" }}
            >
              <span style={{ flexShrink: 0, width: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {item.icon}
              </span>
              {!collapsed && (
                <>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span>
                  {item.badge && (
                    <span style={{
                      fontFamily: C.font, fontSize: ".62rem", fontWeight: 700, letterSpacing: ".04em",
                      padding: "2px 7px", borderRadius: 100, flexShrink: 0,
                      background: C.purpleLight, color: C.purple,
                    }}>{item.badge}</span>
                  )}
                </>
              )}
            </NavLink>
          ))}

          {/* ── Today's stats ──────────────────────────────────────────────── */}
          {!collapsed && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 7 }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 2px" }}>
                <span style={{ fontFamily: C.font, fontSize: ".7rem", fontWeight: 700, color: C.textMuted, letterSpacing: ".05em", textTransform: "uppercase" }}>
                  Today
                </span>
                <button
                  className={`vx-refresh-btn${statsLoading ? " spinning" : ""}`}
                  onClick={fetchStats}
                  title="Refresh stats"
                >
                  <RefreshCw size={11} />
                </button>
              </div>

              {/* Stat cells */}
              <div style={{ display: "flex", gap: 7 }}>
                <div className="vx-stat-cell">
                  <span style={{ fontFamily: C.font, fontSize: "1.1rem", fontWeight: 800, color: C.text, lineHeight: 1 }}>
                    {statsError ? "—" : stats === null ? <span style={{ display: "inline-block", width: 24, height: 14, borderRadius: 4, background: C.border, animation: "vxSkeleton 1.2s ease infinite" }} /> : stats.orders.today}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 3 }}>
                    <ShoppingBag size={9} style={{ color: C.textMuted, flexShrink: 0 }} />
                    <span style={{ fontFamily: C.font, fontSize: ".65rem", fontWeight: 600, color: C.textMuted }}>Orders</span>
                  </div>
                </div>
                <div className="vx-stat-cell">
                  <span style={{ fontFamily: C.font, fontSize: "1.1rem", fontWeight: 800, color: C.text, lineHeight: 1 }}>
                    {statsError ? "—" : stats === null ? <span style={{ display: "inline-block", width: 24, height: 14, borderRadius: 4, background: C.border, animation: "vxSkeleton 1.2s ease infinite" }} /> : stats.calls.total}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 3 }}>
                    <PhoneCall size={9} style={{ color: C.textMuted, flexShrink: 0 }} />
                    <span style={{ fontFamily: C.font, fontSize: ".65rem", fontWeight: 600, color: C.textMuted }}>Total Calls</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ══ BOTTOM SECTION ═════════════════════════════════════════════════ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ height: 1, background: C.border }} />

          {/* Profile button */}
          <div ref={profileRef} style={{ position: "relative" }}>
            <button
              className="vx-profile-btn"
              onClick={() => setProfileOpen(!profileOpen)}
              style={{ justifyContent: collapsed ? "center" : "flex-start" }}
            >
              <Avatar initial={initial} size={30} />
              {!collapsed && (
                <>
                  <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    <p style={{ margin: 0, fontFamily: C.font, fontSize: ".78rem", fontWeight: 600, color: C.textSub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {displayEmail}
                    </p>
                    <span style={{
                      fontFamily: C.font, fontSize: ".62rem", fontWeight: 700,
                      letterSpacing: ".05em", textTransform: "uppercase",
                      color: user?.role === "admin" ? C.purple : C.green,
                    }}>
                      {user?.role ?? "user"}
                    </span>
                  </div>
                  <ChevronUp size={13} style={{
                    color: C.textMuted, flexShrink: 0,
                    transition: "transform .2s",
                    transform: profileOpen ? "rotate(0deg)" : "rotate(180deg)",
                  }} />
                </>
              )}
            </button>

            {/* Profile popup */}
            {profileOpen && (
              <div className="vx-profile-popup" style={{
                position: "absolute",
                bottom: "calc(100% + 8px)",
                left: collapsed ? 48 : 0,
                right: collapsed ? "auto" : 0,
                width: collapsed ? 230 : undefined,
                background: C.white,
                border: `1px solid ${C.border}`,
                borderRadius: 14,
                boxShadow: "0 8px 32px rgba(15,15,26,.10), 0 2px 6px rgba(15,15,26,.06)",
                overflow: "hidden",
                zIndex: 50,
              }}>
                {/* User info */}
                <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Avatar initial={initial} size={36} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontFamily: C.font, fontSize: ".8rem", fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {displayEmail}
                      </p>
                      <span style={{
                        display: "inline-block", marginTop: 3,
                        fontFamily: C.font, fontSize: ".62rem", fontWeight: 700,
                        letterSpacing: ".06em", textTransform: "uppercase",
                        padding: "2px 8px", borderRadius: 100,
                        background: user?.role === "admin" ? C.purpleLight : C.greenLight,
                        color: user?.role === "admin" ? C.purple : C.green,
                      }}>
                        {user?.role ?? "user"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Settings */}
                <button className="vx-popup-row" onClick={() => { navigate("/dashboard/settings"); setProfileOpen(false); }}>
                  <Settings size={14} style={{ flexShrink: 0, color: C.textMuted }} />
                  Settings
                </button>

                <div style={{ height: 1, background: C.border, margin: "0 12px" }} />

                {/* Sign out */}
                <button className="vx-popup-logout" onClick={() => logout(navigate)}>
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>

      </aside>
    </>
  );
}

// ─── Exported Sidebar ─────────────────────────────────────────────────────────
export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="vx-mobile-trigger"
        style={{
          display: "none", position: "fixed", top: 14, left: 14, zIndex: 50,
          background: C.white, border: `1px solid ${C.border}`,
          borderRadius: 9, padding: "7px 8px", cursor: "pointer",
          color: C.textSub, boxShadow: "0 2px 8px rgba(15,15,26,.08)",
        }}
      >
        <Menu size={18} />
      </button>

      <style>{`
        @media(max-width:767px){
          .vx-mobile-trigger{ display:flex !important; align-items:center; }
          .vx-desktop-sidebar{ display:none !important; }
        }
        @media(min-width:768px){ .vx-mobile-trigger{ display:none !important; } }
      `}</style>

      {/* Desktop */}
      <div className="vx-desktop-sidebar" style={{ display: "flex" }}>
        <SidebarContent
          collapsed={collapsed}
          onCollapse={() => setCollapsed(!collapsed)}
          onClose={() => { }}
          isMobile={false}
        />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 40, display: "flex" }}>
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(15,15,26,.35)", backdropFilter: "blur(2px)" }}
            onClick={() => setMobileOpen(false)}
          />
          <div style={{ position: "relative", zIndex: 50, display: "flex" }}>
            <SidebarContent collapsed={false} onCollapse={() => { }} onClose={() => setMobileOpen(false)} isMobile />
          </div>
        </div>
      )}
    </>
  );
}
