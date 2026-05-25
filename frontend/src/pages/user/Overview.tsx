import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Clock,
  MapPin,
  Loader2,
  RefreshCw,
  Zap,
  ZapOff,
  BookOpen,
  DollarSign,
  ShoppingBag,
  Timer,
  Database,
  RotateCcw,
  ArrowRight,
  PhoneOff,
  TrendingUp,
  Activity,
} from "lucide-react";
import {
  getDashboardStatsApi,
  getCallsApi,
  getReportApi,
  getSettingsApi,
  updateSettingsApi,
  getMenuPreviewApi,
} from "../../api/api";
import type {
  DashboardStats,
  CallRecord,
  ReportData,
  Settings,
  MenuPreview,
} from "../../type";

// ── Light-theme colour tokens ──────────────────────────────────────────────────
const C = {
  pageBg:      "#F8F8FC",
  topBar:      "rgba(255,255,255,.98)",
  card:        "#ffffff",
  border:      "#EAEAF2",
  borderFaint: "#F2F2F8",
  text:        "#0F0F1A",
  textSub:     "#525270",
  textMuted:   "#8888A8",
  textGhost:   "#C0C0D0",
  inputBg:     "#F4F4FA",
  purple:      "#534AB7",
  purpleText:  "#534AB7",
  purpleBg:    "rgba(83,74,183,.08)",
  purpleBdr:   "rgba(83,74,183,.18)",
  green:       "#1DB87A",
  greenBg:     "rgba(29,184,122,.08)",
  greenBdr:    "rgba(29,184,122,.2)",
  gold:        "#C8973A",
  goldBg:      "rgba(200,151,58,.08)",
  goldBdr:     "rgba(200,151,58,.2)",
  red:         "#E54545",
  redBg:       "rgba(229,69,69,.08)",
  redBdr:      "rgba(229,69,69,.2)",
};

// ── Helpers ────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatTime(ts: number | null | undefined, fallback?: string) {
  const raw = ts ?? (fallback ? new Date(fallback).getTime() : null);
  if (!raw) return "—";
  return new Date(raw).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function isStoreOpen(s: Settings | null): boolean {
  if (!s) return false;
  if (s.force_store_open) return true;
  const tz =
    s.restaurant_timezone ||
    Intl.DateTimeFormat().resolvedOptions().timeZone;
  const nowStr = new Date().toLocaleTimeString("en-US", {
    hour12: false,
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
  });
  const toMin = (t: string) => {
    if (!t) return 0;
    const [h, m] = t.split(":").map(Number);
    return h * 60 + (m || 0);
  };
  const cur = toMin(nowStr);
  return cur >= toMin(s.store_open_time) && cur < toMin(s.store_close_time);
}

const SENTIMENT: Record<string, { label: string; color: string; bg: string }> = {
  positive: { label: "Positive",   color: C.green, bg: C.greenBg  },
  neutral:  { label: "Neutral",    color: C.gold,  bg: C.goldBg   },
  negative: { label: "Frustrated", color: C.red,   bg: C.redBg    },
};

function hasOrder(c: { order_booked: boolean; order_items: any; order_details: any }): boolean {
  if (c.order_booked) return true;
  if (c.order_details) return true;
  if (!c.order_items) return false;
  if (typeof c.order_items === "string") return c.order_items.trim().length > 0;
  if (Array.isArray(c.order_items)) return c.order_items.length > 0;
  if (typeof c.order_items === "object") return Object.keys(c.order_items).length > 0;
  return false;
}

function getOrderRevenue(c: { order_details: any; order_items: any }): number | null {
  const fromDetails = c.order_details?.total_amount;
  if (fromDetails != null && fromDetails > 0) return fromDetails;
  const items = c.order_details?.order_items;
  if (Array.isArray(items) && items.length > 0) {
    const sum = items.reduce((s: number, item: any) => {
      const price = item.price ?? item.unit_price ?? item.item_price ?? 0;
      const qty   = item.quantity ?? item.qty ?? 1;
      return s + price * qty;
    }, 0);
    if (sum > 0) return sum;
  }
  return null;
}

// ── Period config ──────────────────────────────────────────────
type PeriodKey = "today" | "7d" | "30d" | "90d" | "180d" | "365d";

const PERIOD_OPTIONS: { key: PeriodKey; label: string; days: number }[] = [
  { key: "today", label: "Today",     days: 1   },
  { key: "7d",    label: "7 Days",    days: 7   },
  { key: "30d",   label: "Month",     days: 30  },
  { key: "90d",   label: "3 Months",  days: 90  },
  { key: "180d",  label: "6 Months",  days: 180 },
  { key: "365d",  label: "Year",      days: 365 },
];

// ── Overview ───────────────────────────────────────────────────
export default function Overview() {
  const navigate = useNavigate();

  const [settings, setSettings]           = useState<Settings | null>(null);
  const [stats, setStats]                 = useState<DashboardStats | null>(null);
  const [report, setReport]               = useState<ReportData | null>(null);
  const [calls, setCalls]                 = useState<CallRecord[]>([]);
  const [menuPreview, setMenuPreview]     = useState<MenuPreview | null>(null);
  const [loading, setLoading]             = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [aiToggling, setAiToggling]       = useState(false);
  const [syncing, setSyncing]             = useState(false);
  const [posOk, setPosOk]                 = useState(false);
  const [lastSync, setLastSync]           = useState<Date | null>(null);
  const [metricPeriod, setMetricPeriod]   = useState<PeriodKey>("today");
  const [mounted, setMounted]             = useState(false);

  const email    = localStorage.getItem("email") ?? "";
  const username = email.split("@")[0];

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [s, st, c, r, mp] = await Promise.all([
        getSettingsApi(),
        getDashboardStatsApi(),
        getCallsApi(0, 200),
        getReportApi(1),
        getMenuPreviewApi().catch(() => null),
      ]);
      setSettings(s);
      setStats(st);
      setCalls(c);
      setReport(r);
      if (mp !== null) {
        setMenuPreview(mp as MenuPreview);
        setPosOk(true);
      } else {
        setPosOk(false);
      }
      setLastSync(new Date());
    } catch {
      /* handled by interceptor */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => {
    if (!loading) requestAnimationFrame(() => setMounted(true));
  }, [loading]);

  const switchPeriod = async (key: PeriodKey) => {
    if (key === metricPeriod) return;
    setMetricPeriod(key);
    const days = PERIOD_OPTIONS.find((p) => p.key === key)!.days;
    setReportLoading(true);
    try { setReport(await getReportApi(days)); } catch { /* swallow */ }
    finally { setReportLoading(false); }
  };

  const toggleAI = async () => {
    if (!settings || aiToggling) return;
    setAiToggling(true);
    try {
      const updated = await updateSettingsApi({ is_active: !settings.is_active });
      setSettings(updated);
    } catch { /* swallow */ }
    finally { setAiToggling(false); }
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      const mp = await getMenuPreviewApi();
      setMenuPreview(mp);
      setPosOk(true);
      setLastSync(new Date());
    } catch { setPosOk(false); }
    finally { setSyncing(false); }
  };

  // ── Derived values ──────────────────────────────────────────
  const cutoffMs = (() => {
    if (metricPeriod === "today") {
      // Use the restaurant's configured timezone so midnight matches the
      // user's clock, not the server's UTC clock.
      const tz = settings?.restaurant_timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
      try {
        // Build a "YYYY-MM-DD" string for today in the target timezone
        const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
        // Parse that as local midnight in that timezone via a formatter trick
        const midnightLocal = new Date(
          new Date(`${todayStr}T00:00:00`).toLocaleString("en-US", { timeZone: tz })
        );
        return midnightLocal.getTime();
      } catch {
        const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime();
      }
    }
    const days = PERIOD_OPTIONS.find((p) => p.key === metricPeriod)?.days ?? 1;
    return Date.now() - days * 86400000;
  })();

  const periodCalls  = calls.filter((c) => {
    const callTime = c.start_timestamp ?? new Date(c.created_at).getTime();
    const orderTime = c.order_details?.created_at ? new Date(c.order_details.created_at).getTime() : 0;
    return Math.max(callTime, orderTime) >= cutoffMs;
  });
  const aiRevenue    = periodCalls.filter(hasOrder)
    .reduce((sum, c) => sum + (getOrderRevenue(c) ?? 0), 0);
  const missedCount  = report
    ? report.summary.total_calls - report.summary.successful_calls
    : 0;
  const missedPct    = report && report.summary.total_calls > 0
    ? ((missedCount / report.summary.total_calls) * 100).toFixed(1)
    : null;
  const storeOpen    = isStoreOpen(settings);
  const recentOrders = calls.filter(hasOrder).slice(0, 5);
  const recentCalls  = calls.slice(0, 5);
  const kbReady      = !!(settings?.prompt_instructions || settings?.locked_prompt_tail);
  const periodLabel  = PERIOD_OPTIONS.find((p) => p.key === metricPeriod)?.label ?? "";

  // ── Loading screen ──────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", minHeight: "100vh", background: C.pageBg }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: C.purpleBg, border: `1px solid ${C.purpleBdr}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Loader2 size={22} style={{ color: C.purple, animation: "spin .8s linear infinite" }} />
          </div>
          <p style={{ fontFamily: "Sora,sans-serif", fontSize: ".82rem", color: C.textMuted, margin: 0, letterSpacing: ".02em" }}>
            Loading dashboard…
          </p>
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes fadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes vxOrb   { 0%,100%{transform:scale(1) translateY(0)} 50%{transform:scale(1.06) translateY(-20px)} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        @keyframes pulse   { 0%,100%{box-shadow:0 0 0 0 rgba(226,80,76,.38)} 70%{box-shadow:0 0 0 10px rgba(226,80,76,0)} }
        @keyframes ldot    { 0%,100%{opacity:1} 50%{opacity:.25} }
        .vx-row:hover     { background: rgba(0,0,0,.025) !important; }
        .vx-btn:hover     { opacity:.7 !important; }
        .vx-qa            { transition: border-color .18s, background .18s, transform .18s, box-shadow .18s !important; }
        .vx-qa:hover      { border-color: rgba(83,74,183,.3) !important; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(83,74,183,.10) !important; }
        .vx-card          { transition: border-color .18s, box-shadow .18s !important; }
        .vx-card:hover    { border-color: rgba(83,74,183,.22) !important; box-shadow: 0 4px 20px rgba(83,74,183,.08) !important; }
        .vx-period        { transition: background .14s, color .14s, box-shadow .14s !important; }
        .vx-period:hover  { background: rgba(255,255,255,.7) !important; }
        *::-webkit-scrollbar       { width: 4px; }
        *::-webkit-scrollbar-track { background: transparent; }
        *::-webkit-scrollbar-thumb { background: rgba(0,0,0,.1); border-radius: 99px; }
      `}</style>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          overflow: "hidden",
          background: C.pageBg,
          position: "relative",
          fontFamily: "'Sora',sans-serif",
          WebkitFontSmoothing: "antialiased",
        }}
      >
        {/* Ambient orbs — very subtle on light bg */}
        <div style={{ position: "absolute", top: -260, right: -200, width: 660, height: 660, background: "radial-gradient(circle,rgba(83,74,183,.06) 0%,transparent 66%)", borderRadius: "50%", animation: "vxOrb 18s ease-in-out infinite", pointerEvents: "none", zIndex: 0 }} />
        <div style={{ position: "absolute", bottom: -220, left: -180, width: 560, height: 560, background: "radial-gradient(circle,rgba(29,184,122,.04) 0%,transparent 66%)", borderRadius: "50%", animation: "vxOrb 22s ease-in-out infinite reverse", pointerEvents: "none", zIndex: 0 }} />
        <div style={{ position: "absolute", top: "38%", left: "48%", width: 380, height: 380, background: "radial-gradient(circle,rgba(83,74,183,.03) 0%,transparent 70%)", borderRadius: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none", zIndex: 0 }} />

        {/* ── Top Bar ─────────────────────────────────────────── */}
        <div
          style={{
            background: C.topBar,
            borderBottom: `1px solid ${C.border}`,
            padding: "11px 28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
            position: "relative",
            zIndex: 2,
            gap: 14,
            flexWrap: "wrap",
            boxShadow: "0 1px 8px rgba(0,0,0,.05)",
            opacity: mounted ? 1 : 0,
            animation: mounted ? "fadeIn .4s ease both" : "none",
          }}
        >
          {/* Identity */}
          <div>
            <h1
              style={{
                fontFamily: "Sora,sans-serif",
                fontSize: "1.02rem",
                fontWeight: 800,
                margin: 0,
                letterSpacing: "-.03em",
                color: C.text,
              }}
            >
              {getGreeting()}, {username}
            </h1>
            <p style={{ fontFamily: "Sora,sans-serif", fontSize: ".67rem", color: C.textMuted, margin: "2px 0 0", display: "flex", alignItems: "center", gap: 4 }}>
              <MapPin size={9} style={{ color: C.textGhost, flexShrink: 0 }} />
              {settings?.restaurant_name ?? "Mitchell's"}
            </p>
          </div>

          {/* Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {/* Office status badge */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: storeOpen ? C.greenBg : C.inputBg,
                border: `1px solid ${storeOpen ? C.greenBdr : C.border}`,
                borderRadius: 100,
                padding: "5px 13px 5px 9px",
                fontFamily: "Sora,sans-serif",
                fontSize: ".71rem",
                fontWeight: 700,
                color: storeOpen ? C.green : C.textMuted,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: storeOpen ? C.green : "rgba(0,0,0,.2)",
                  animation: storeOpen ? "ldot 1.4s ease-in-out infinite" : "none",
                  flexShrink: 0,
                }}
              />
              {storeOpen ? "Office Open" : "Office Closed"}
            </div>

            {/* AI panic button */}
            <button
              className="vx-btn"
              onClick={toggleAI}
              disabled={aiToggling}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                fontFamily: "Sora,sans-serif",
                fontSize: ".79rem",
                fontWeight: 800,
                letterSpacing: "-.01em",
                padding: "7px 18px",
                borderRadius: 100,
                border: "none",
                cursor: aiToggling ? "not-allowed" : "pointer",
                background: settings?.is_active
                  ? "linear-gradient(135deg,#21c87c,#19a568)"
                  : "linear-gradient(135deg,#e6524e,#c2403d)",
                color: "#fff",
                boxShadow: settings?.is_active
                  ? "0 2px 14px rgba(15,168,98,.3), inset 0 1px 0 rgba(255,255,255,.14)"
                  : "0 2px 14px rgba(217,65,64,.3), inset 0 1px 0 rgba(255,255,255,.1)",
                animation: !settings?.is_active && !aiToggling ? "pulse 2s ease-in-out infinite" : "none",
                transition: "opacity .2s",
              }}
            >
              {aiToggling
                ? <Loader2 size={13} style={{ animation: "spin .7s linear infinite" }} />
                : settings?.is_active
                  ? <Zap size={13} fill="currentColor" strokeWidth={1.5} />
                  : <ZapOff size={13} />
              }
              {settings?.is_active ? "AI Active" : "AI Paused"}
            </button>

            {/* Refresh */}
            <button
              className="vx-btn"
              onClick={fetchAll}
              title="Refresh dashboard"
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                border: `1px solid ${C.border}`,
                background: C.inputBg,
                color: C.textMuted,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "opacity .2s",
                flexShrink: 0,
              }}
            >
              <RefreshCw size={13} />
            </button>
          </div>
        </div>

        {/* ── Scrollable content ───────────────────────────────── */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px 28px 32px",
            display: "flex",
            flexDirection: "column",
            gap: 18,
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* ── Quick Actions ──────────────────────────────────── */}
          <div
            style={{
              opacity: mounted ? 1 : 0,
              animation: mounted ? "fadeIn .35s ease both" : "none",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: 10,
              }}
            >
              {[
                {
                  label: "Update Product Availability",
                  sub: "Manage stock and product catalog",
                  icon: <ShoppingBag size={16} />,
                  accent: C.purple,
                  rawAccent: "#534AB7",
                  path: "/dashboard/menu",
                },
                {
                  label: "Block a Number",
                  sub: "Ban a spam or problem caller",
                  icon: <PhoneOff size={16} />,
                  accent: C.red,
                  rawAccent: "#E54545",
                  path: "/dashboard/calls",
                },
                {
                  label: "Edit AI Greeting",
                  sub: "Change prompt or hours announcement",
                  icon: <BookOpen size={16} />,
                  accent: C.gold,
                  rawAccent: "#C8973A",
                  path: "/dashboard/settings",
                },
              ].map((qa) => (
                <button
                  key={qa.label}
                  className="vx-qa"
                  onClick={() => navigate(qa.path)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    background: C.card,
                    border: `1px solid ${C.border}`,
                    borderRadius: 15,
                    padding: "13px 16px",
                    cursor: "pointer",
                    textAlign: "left",
                    width: "100%",
                    boxShadow: "0 1px 8px rgba(0,0,0,.05)",
                  }}
                >
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 11,
                      background: `${qa.rawAccent}14`,
                      border: `1px solid ${qa.rawAccent}28`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: qa.accent,
                      flexShrink: 0,
                    }}
                  >
                    {qa.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: "Sora,sans-serif", fontSize: ".79rem", fontWeight: 700, color: C.text, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {qa.label}
                    </p>
                    <p style={{ fontFamily: "Sora,sans-serif", fontSize: ".65rem", color: C.textMuted, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {qa.sub}
                    </p>
                  </div>
                  <ArrowRight size={13} style={{ color: C.textGhost, flexShrink: 0 }} />
                </button>
              ))}
            </div>
          </div>

          {/* ── At a Glance Metrics ───────────────────────────── */}
          <div
            style={{
              opacity: mounted ? 1 : 0,
              animation: mounted ? "fadeUp .45s .07s ease both" : "none",
            }}
          >
            {/* Section header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <Activity size={13} style={{ color: C.purple }} />
                <span style={{ fontFamily: "Sora,sans-serif", fontSize: ".69rem", fontWeight: 700, color: C.textMuted, letterSpacing: ".06em", textTransform: "uppercase" }}>
                  Performance
                </span>
                {reportLoading && (
                  <Loader2 size={11} style={{ color: C.textGhost, animation: "spin .8s linear infinite", marginLeft: 2 }} />
                )}
              </div>

              {/* Period segmented control */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  background: "rgba(0,0,0,.05)",
                  borderRadius: 100,
                  padding: "3px",
                }}
              >
                {PERIOD_OPTIONS.map((p) => (
                  <button
                    key={p.key}
                    className="vx-period"
                    onClick={() => switchPeriod(p.key)}
                    style={{
                      fontFamily: "'Sora',sans-serif",
                      fontSize: ".67rem",
                      fontWeight: 700,
                      padding: "4px 13px",
                      borderRadius: 100,
                      border: "none",
                      cursor: "pointer",
                      background: metricPeriod === p.key ? "#fff" : "transparent",
                      color: metricPeriod === p.key ? C.purple : C.textMuted,
                      boxShadow: metricPeriod === p.key
                        ? "0 1px 6px rgba(0,0,0,.10)"
                        : "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 4 metric cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4,1fr)",
                gap: 10,
              }}
            >
              {[
                {
                  label: "AI Orders",
                  value: reportLoading
                    ? "—"
                    : metricPeriod === "today"
                      // Use the midnight-based count (same source as the sidebar)
                      // so both numbers always agree.
                      ? (stats?.orders.today ?? 0).toLocaleString()
                      : (report?.summary.total_orders ?? 0).toLocaleString(),
                  sub: periodLabel,
                  icon: <ShoppingBag size={14} />,
                  accent: C.purple,
                  rawAccent: "#534AB7",
                  iconBg: "rgba(83,74,183,.1)",
                  iconBorder: "rgba(83,74,183,.2)",
                  topLine: C.purple,
                },
                {
                  label: "AI Revenue",
                  value: `$${aiRevenue.toFixed(2)}`,
                  sub: "gross revenue",
                  icon: <DollarSign size={14} />,
                  accent: C.green,
                  rawAccent: "#1DB87A",
                  iconBg: "rgba(29,184,122,.1)",
                  iconBorder: "rgba(29,184,122,.2)",
                  topLine: C.green,
                },
                {
                  label: "Minutes Used",
                  value: reportLoading
                    ? "—"
                    : (report?.summary.total_minutes ?? 0).toLocaleString(),
                  sub: "API minutes",
                  icon: <Timer size={14} />,
                  accent: C.gold,
                  rawAccent: "#C8973A",
                  iconBg: "rgba(200,151,58,.1)",
                  iconBorder: "rgba(200,151,58,.2)",
                  topLine: C.gold,
                },
                {
                  label: "Missed / Failed",
                  value: reportLoading ? "—" : missedCount.toLocaleString(),
                  sub: reportLoading || missedPct === null ? "didn't complete" : `${missedPct}% of total calls`,
                  icon: <PhoneOff size={14} />,
                  accent: C.red,
                  rawAccent: "#E54545",
                  iconBg: "rgba(229,69,69,.1)",
                  iconBorder: "rgba(229,69,69,.2)",
                  topLine: C.red,
                },
              ].map((card) => (
                <div
                  key={card.label}
                  className="vx-card"
                  style={{
                    background: C.card,
                    border: `1px solid ${C.border}`,
                    borderRadius: 18,
                    padding: "17px 17px 14px",
                    position: "relative",
                    overflow: "hidden",
                    boxShadow: "0 1px 10px rgba(0,0,0,.06)",
                  }}
                >
                  {/* Accent top stripe */}
                  <div
                    style={{
                      position: "absolute",
                      top: 0, left: 0, right: 0,
                      height: 2,
                      background: `linear-gradient(90deg,${card.topLine} 0%,${card.topLine}44 100%)`,
                      borderRadius: "18px 18px 0 0",
                    }}
                  />
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ fontFamily: "Sora,sans-serif", fontSize: ".61rem", fontWeight: 700, color: C.textMuted, letterSpacing: ".07em", textTransform: "uppercase" }}>
                      {card.label}
                    </span>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: card.iconBg, border: `1px solid ${card.iconBorder}`, display: "flex", alignItems: "center", justifyContent: "center", color: card.accent, flexShrink: 0 }}>
                      {card.icon}
                    </div>
                  </div>
                  <p style={{ fontFamily: "Sora,sans-serif", fontSize: "2.05rem", fontWeight: 800, letterSpacing: "-.05em", lineHeight: 1, margin: "0 0 5px", color: C.text }}>
                    {card.value}
                  </p>
                  <p style={{ fontFamily: "Sora,sans-serif", fontSize: ".63rem", color: C.textMuted, margin: 0 }}>
                    {card.sub}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* ── System Health ──────────────────────────────────── */}
          <div
            style={{
              opacity: mounted ? 1 : 0,
              animation: mounted ? "fadeUp .45s .14s ease both" : "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
              <TrendingUp size={13} style={{ color: C.purple }} />
              <span style={{ fontFamily: "Sora,sans-serif", fontSize: ".69rem", fontWeight: 700, color: C.textMuted, letterSpacing: ".06em", textTransform: "uppercase" }}>
                System Health
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: 10,
              }}
            >
              {/* POS Connection */}
              <div
                className="vx-card"
                style={{
                  background: posOk ? C.greenBg : C.redBg,
                  border: `1px solid ${posOk ? C.greenBdr : C.redBdr}`,
                  borderRadius: 15,
                  padding: "14px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  boxShadow: "0 1px 8px rgba(0,0,0,.05)",
                }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 11, background: posOk ? "rgba(29,184,122,.12)" : "rgba(229,69,69,.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Database size={16} style={{ color: posOk ? C.green : C.red }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: "Sora,sans-serif", fontSize: ".77rem", fontWeight: 700, color: C.text, margin: "0 0 2px" }}>
                    POS Connection
                  </p>
                  <p style={{ fontFamily: "Sora,sans-serif", fontSize: ".65rem", color: C.textMuted, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {menuPreview
                      ? `${menuPreview.item_count} items · ${menuPreview.category_count} categories`
                      : "Could not reach POS"}
                  </p>
                </div>
                <span style={{ fontFamily: "Sora,sans-serif", fontSize: ".66rem", fontWeight: 700, padding: "3px 9px", borderRadius: 100, background: posOk ? "rgba(15,168,98,.12)" : "rgba(217,65,64,.12)", color: posOk ? C.green : C.red, border: `1px solid ${posOk ? C.greenBdr : C.redBdr}`, flexShrink: 0 }}>
                  {posOk ? "Online" : "Offline"}
                </span>
              </div>

              {/* Last Sync */}
              <div
                className="vx-card"
                style={{
                  background: C.purpleBg,
                  border: `1px solid ${C.purpleBdr}`,
                  borderRadius: 15,
                  padding: "14px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  boxShadow: "0 1px 8px rgba(0,0,0,.05)",
                }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 11, background: "rgba(83,74,183,.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <RotateCcw size={16} style={{ color: C.purple }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: "Sora,sans-serif", fontSize: ".77rem", fontWeight: 700, color: C.text, margin: "0 0 2px" }}>
                    Menu Sync
                  </p>
                  <p style={{ fontFamily: "Sora,sans-serif", fontSize: ".65rem", color: C.textMuted, margin: 0 }}>
                    {lastSync
                      ? lastSync.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
                      : "Not yet synced"}
                  </p>
                </div>
                <button
                  className="vx-btn"
                  onClick={syncNow}
                  disabled={syncing}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontFamily: "Sora,sans-serif",
                    fontSize: ".67rem",
                    fontWeight: 700,
                    padding: "5px 12px",
                    borderRadius: 100,
                    border: `1px solid ${C.purpleBdr}`,
                    background: "rgba(83,74,183,.12)",
                    color: C.purple,
                    cursor: syncing ? "not-allowed" : "pointer",
                    flexShrink: 0,
                    transition: "opacity .2s",
                    whiteSpace: "nowrap",
                  }}
                >
                  <RotateCcw
                    size={10}
                    style={syncing ? { animation: "spin .8s linear infinite" } : undefined}
                  />
                  {syncing ? "Syncing…" : "Sync Now"}
                </button>
              </div>

              {/* Knowledge Base */}
              <div
                className="vx-card"
                style={{
                  background: kbReady ? C.goldBg : C.card,
                  border: `1px solid ${kbReady ? C.goldBdr : C.border}`,
                  borderRadius: 15,
                  padding: "14px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  boxShadow: "0 1px 8px rgba(0,0,0,.05)",
                }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 11, background: kbReady ? "rgba(200,151,58,.12)" : C.inputBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <BookOpen size={16} style={{ color: kbReady ? C.gold : C.textGhost }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: "Sora,sans-serif", fontSize: ".77rem", fontWeight: 700, color: C.text, margin: "0 0 2px" }}>
                    Knowledge Base
                  </p>
                  <p style={{ fontFamily: "Sora,sans-serif", fontSize: ".65rem", color: C.textMuted, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {kbReady ? "Custom instructions active" : "Using default instructions"}
                  </p>
                </div>
                <span style={{ fontFamily: "Sora,sans-serif", fontSize: ".66rem", fontWeight: 700, padding: "3px 9px", borderRadius: 100, background: kbReady ? "rgba(184,131,42,.12)" : C.inputBg, color: kbReady ? C.gold : C.textMuted, border: `1px solid ${kbReady ? C.goldBdr : C.border}`, flexShrink: 0 }}>
                  {kbReady ? "Ready" : "Default"}
                </span>
              </div>
            </div>
          </div>

          {/* ── Live Activity ──────────────────────────────────── */}
          <div
            style={{
              opacity: mounted ? 1 : 0,
              animation: mounted ? "fadeUp .45s .21s ease both" : "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
              <Clock size={13} style={{ color: C.purple }} />
              <span style={{ fontFamily: "Sora,sans-serif", fontSize: ".69rem", fontWeight: 700, color: C.textMuted, letterSpacing: ".06em", textTransform: "uppercase" }}>
                Live Activity
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              {/* ── Recent Orders ── */}
              <div
                className="vx-card"
                style={{
                  background: C.card,
                  border: `1px solid ${C.border}`,
                  borderRadius: 18,
                  padding: "16px 18px",
                  boxShadow: "0 1px 10px rgba(0,0,0,.05)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 13 }}>
                  <p style={{ fontFamily: "Sora,sans-serif", fontSize: ".78rem", fontWeight: 700, color: C.text, margin: 0 }}>
                    Recent Orders
                  </p>
                  <span style={{ fontFamily: "Sora,sans-serif", fontSize: ".61rem", fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: C.purpleBg, color: C.purple, border: `1px solid ${C.purpleBdr}` }}>
                    last 5
                  </span>
                </div>

                {recentOrders.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    {recentOrders.map((c) => {
                      const name =
                        c.customer_name_extracted ??
                        c.customer_name ??
                        c.caller_phone ??
                        "Unknown";
                      const amt = getOrderRevenue(c);
                      return (
                        <div
                          key={c.id}
                          className="vx-row"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "8px 8px",
                            borderRadius: 11,
                            transition: "background .15s",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                            <div
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: "50%",
                                background: C.purpleBg,
                                border: `1px solid ${C.purpleBdr}`,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                fontFamily: "Sora,sans-serif",
                                fontSize: ".7rem",
                                fontWeight: 800,
                                color: C.purpleText,
                              }}
                            >
                              {name[0]?.toUpperCase() ?? "?"}
                            </div>
                            <div>
                              <p style={{ fontFamily: "Sora,sans-serif", fontSize: ".76rem", fontWeight: 700, color: C.text, margin: 0 }}>
                                {name}
                              </p>
                              <p style={{ fontFamily: "Sora,sans-serif", fontSize: ".63rem", color: C.textMuted, margin: 0 }}>
                                {formatTime(c.start_timestamp)}
                              </p>
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                            {amt != null && (
                              <span style={{ fontFamily: "Sora,sans-serif", fontSize: ".76rem", fontWeight: 700, color: C.green }}>
                                ${amt.toFixed(2)}
                              </span>
                            )}
                            <span style={{ fontFamily: "Sora,sans-serif", fontSize: ".61rem", fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: C.greenBg, color: C.green, border: `1px solid ${C.greenBdr}` }}>
                              Ordered
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "26px 0", gap: 8 }}>
                    <ShoppingBag size={22} style={{ color: "rgba(0,0,0,.1)" }} />
                    <p style={{ fontFamily: "Sora,sans-serif", fontSize: ".74rem", color: C.textGhost, margin: 0 }}>
                      No recent orders
                    </p>
                  </div>
                )}
              </div>

              {/* ── Recent Calls ── */}
              <div
                className="vx-card"
                style={{
                  background: C.card,
                  border: `1px solid ${C.border}`,
                  borderRadius: 18,
                  padding: "16px 18px",
                  boxShadow: "0 1px 10px rgba(0,0,0,.05)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 13 }}>
                  <p style={{ fontFamily: "Sora,sans-serif", fontSize: ".78rem", fontWeight: 700, color: C.text, margin: 0 }}>
                    Recent Calls
                  </p>
                  <span style={{ fontFamily: "Sora,sans-serif", fontSize: ".61rem", fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: C.purpleBg, color: C.purple, border: `1px solid ${C.purpleBdr}` }}>
                    last 5
                  </span>
                </div>

                {recentCalls.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    {recentCalls.map((c) => {
                      const name =
                        c.customer_name_extracted ??
                        c.customer_name ??
                        c.caller_phone ??
                        "Unknown";
                      let rawSent = hasOrder(c) ? "positive" : (c.user_sentiment ?? "").toLowerCase();
                      if (rawSent === "frustrated") rawSent = "negative";
                      const sent = rawSent ? (SENTIMENT[rawSent] ?? null) : null;
                      return (
                        <div
                          key={c.id}
                          className="vx-row"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "8px 8px",
                            borderRadius: 11,
                            transition: "background .15s",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                            <div
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: "50%",
                                background: C.inputBg,
                                border: `1px solid ${C.border}`,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                fontFamily: "Sora,sans-serif",
                                fontSize: ".7rem",
                                fontWeight: 800,
                                color: C.textMuted,
                              }}
                            >
                              {name[0]?.toUpperCase() ?? "?"}
                            </div>
                            <div>
                              <p style={{ fontFamily: "Sora,sans-serif", fontSize: ".76rem", fontWeight: 700, color: C.text, margin: 0 }}>
                                {c.caller_phone || name}
                              </p>
                              <p style={{ fontFamily: "Sora,sans-serif", fontSize: ".63rem", color: C.textMuted, margin: 0 }}>
                                {formatTime(c.start_timestamp)}
                              </p>
                            </div>
                          </div>
                          {sent ? (
                            <span style={{ fontFamily: "Sora,sans-serif", fontSize: ".61rem", fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: sent.bg, color: sent.color, border: `1px solid ${sent.color}2e`, flexShrink: 0 }}>
                              {sent.label}
                            </span>
                          ) : c.order_booked ? (
                            <span style={{ fontFamily: "Sora,sans-serif", fontSize: ".61rem", fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: C.greenBg, color: C.green, border: `1px solid ${C.greenBdr}`, flexShrink: 0 }}>
                              Ordered
                            </span>
                          ) : c.call_reason ? (
                            <span style={{ fontFamily: "Sora,sans-serif", fontSize: ".61rem", fontWeight: 600, padding: "2px 8px", borderRadius: 100, background: C.purpleBg, color: C.purpleText, border: `1px solid ${C.purpleBdr}`, flexShrink: 0, maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {c.call_reason}
                            </span>
                          ) : (
                            <span style={{ fontFamily: "Sora,sans-serif", fontSize: ".61rem", fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: C.inputBg, color: C.textGhost, border: `1px solid ${C.border}`, flexShrink: 0 }}>
                              {c.call_status === "ended" ? "Ended" : "—"}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "26px 0", gap: 8 }}>
                    <PhoneOff size={22} style={{ color: "rgba(0,0,0,.1)" }} />
                    <p style={{ fontFamily: "Sora,sans-serif", fontSize: ".74rem", color: C.textGhost, margin: 0 }}>
                      No recent calls
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ height: 4 }} />
        </div>
      </div>
    </>
  );
}
