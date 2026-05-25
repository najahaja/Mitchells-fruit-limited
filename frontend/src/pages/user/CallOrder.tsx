import { useEffect, useRef, useState, useMemo } from "react";
import {
  Phone,
  ShoppingBag,
  Clock,
  ChevronDown,
  Search,
  Package,
  X,
  Download,
  MessageSquare,
  Loader2,
  RefreshCw,
  PhoneOff,
  CheckCircle2,
  Play,
  Pause,
  ChevronRight,
  ChevronLeft,
  Activity,
  FileText,
  Ban,
  DollarSign,
  Printer,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import { getCallsApi, confirmCallOrderApi, getCategoriesApi, reprintOrderApi, cancelOrderApi, getSettingsApi } from "../../api/api";
import type { CallRecord, MenuItem, Settings } from "../../type";
import toast from "react-hot-toast";

// ── Light-theme colour tokens ─────────────────────────────────────────────────
const C = {
  pageBg: "#F8F8FC",
  topBar: "rgba(255,255,255,.98)",
  filtersBar: "#FAFBFD",
  card: "#ffffff",
  panel: "#ffffff",
  // ── text
  text: "#0F0F1A",
  textSub: "#525270",
  textMuted: "#8888A8",
  textGhost: "#C0C0D0",
  // ── borders / dividers
  border: "#EAEAF2",
  borderFaint: "#F2F2F8",
  // ── interactives
  inputBg: "#F4F4FA",
  inputBorder: "#EAEAF2",
  rowHover: "rgba(83,74,183,.04)",
  // ── accents
  purple: "#534AB7",
  purpleText: "#534AB7",
  purpleBg: "rgba(83,74,183,.08)",
  purpleBdr: "rgba(83,74,183,.18)",
  green: "#1DB87A",
  greenBg: "rgba(29,184,122,.08)",
  greenBdr: "rgba(29,184,122,.2)",
  gold: "#C8973A",
  goldBg: "rgba(200,151,58,.08)",
  goldBdr: "rgba(200,151,58,.2)",
  red: "#E54545",
  redBg: "rgba(229,69,69,.08)",
  redBdr: "rgba(229,69,69,.2)",
};

// ── Types ─────────────────────────────────────────────────────────────────────
type DateFilter = "today" | "7d" | "30d" | "all";
type OutcomeFilter = "all" | "ordered" | "info" | "missed";
type SentimentFilter = "all" | "positive" | "neutral" | "negative";
type SortField = "timestamp" | "duration" | "revenue";
type SortDir = "asc" | "desc";

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDuration(ms: number): string {
  if (!ms || ms === 0) return "0s";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function formatTimestamp(ts: number): { time: string; date: string } {
  const d = new Date(ts);
  return {
    time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
    date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  };
}

function getDisplayName(c: CallRecord): string {
  return c.customer_name_extracted ?? c.customer_name ?? "Unknown";
}

function hasOrder(c: CallRecord): boolean {
  if (c.order_booked) return true;
  if (c.order_details) return true;
  if (!c.order_items) return false;
  if (typeof c.order_items === "string") return c.order_items.trim().length > 0;
  if (Array.isArray(c.order_items)) return c.order_items.length > 0;
  return false;
}

function getOrderRevenue(c: CallRecord): number | null {
  const fromDetails = c.order_details?.total_amount;
  if (fromDetails != null && fromDetails > 0) return fromDetails;
  const items = c.order_details?.order_items;
  if (Array.isArray(items) && items.length > 0) {
    const sum = items.reduce((s: number, item: any) => {
      const price = item.price ?? item.unit_price ?? item.item_price ?? 0;
      const qty = item.quantity ?? item.qty ?? 1;
      return s + price * qty;
    }, 0);
    if (sum > 0) return sum;
  }
  return null;
}

const SENTIMENT_MAP: Record<
  string,
  { label: string; color: string; bg: string; border: string; emoji: string }
> = {
  positive: { label: "Positive", color: C.green, bg: C.greenBg, border: C.greenBdr, emoji: "😊" },
  neutral: { label: "Neutral", color: C.gold, bg: C.goldBg, border: C.goldBdr, emoji: "😐" },
  negative: { label: "Frustrated", color: C.red, bg: C.redBg, border: C.redBdr, emoji: "😡" },
  frustrated: { label: "Frustrated", color: C.red, bg: C.redBg, border: C.redBdr, emoji: "😡" },
};

function getSentiment(c: CallRecord) {
  if (hasOrder(c)) {
    return SENTIMENT_MAP.positive;
  }
  if (!c.user_sentiment) return null;
  return SENTIMENT_MAP[c.user_sentiment.toLowerCase()] ?? null;
}

function getOutcome(c: CallRecord): {
  label: string; color: string; bg: string; border: string;
} {
  if (c.call_status === "ongoing")
    return { label: "Live", color: C.purple, bg: C.purpleBg, border: C.purpleBdr };
  if (hasOrder(c))
    return { label: "Order Placed", color: C.green, bg: C.greenBg, border: C.greenBdr };
  if (c.call_successful === true)
    return { label: "Info Given", color: C.gold, bg: C.goldBg, border: C.goldBdr };
  return { label: "Missed / Failed", color: C.red, bg: C.redBg, border: C.redBdr };
}

// ── Audio Player (light) ──────────────────────────────────────────────────────
function AudioPlayer({ url, duration }: { url: string; duration: number }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(duration / 1000);

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const pct = total > 0 ? Math.min((current / total) * 100, 100) : 0;

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play(); setPlaying(true); }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const newTime = ((e.clientX - rect.left) / rect.width) * total;
    if (audioRef.current) audioRef.current.currentTime = newTime;
    setCurrent(newTime);
  };

  return (
    <div
      style={{
        background: C.purpleBg,
        border: `1px solid ${C.purpleBdr}`,
        borderRadius: 14,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={() => { if (audioRef.current) setCurrent(audioRef.current.currentTime); }}
        onLoadedMetadata={() => { if (audioRef.current) setTotal(audioRef.current.duration); }}
        onEnded={() => { setPlaying(false); setCurrent(0); }}
      />

      {/* Label */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Activity size={10} style={{ color: C.purple }} />
        <span style={{ fontFamily: "Sora,sans-serif", fontSize: ".63rem", fontWeight: 700, color: C.textMuted, letterSpacing: ".06em", textTransform: "uppercase" }}>
          Call Recording
        </span>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={toggle}
          style={{
            width: 32, height: 32, borderRadius: "50%",
            background: C.purple, border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, color: "#fff",
            boxShadow: `0 2px 10px ${C.purpleBdr}`,
          }}
        >
          {playing ? <Pause size={11} /> : <Play size={11} style={{ marginLeft: 1 }} />}
        </button>

        {/* Seek bar */}
        <div
          style={{ flex: 1, height: 4, background: "rgba(0,0,0,.1)", borderRadius: 99, cursor: "pointer", position: "relative" }}
          onClick={seek}
        >
          <div style={{ width: `${pct}%`, height: "100%", background: C.purple, borderRadius: 99, transition: "width .1s" }} />
          <div style={{
            position: "absolute", top: "50%", transform: "translateY(-50%)",
            left: `calc(${pct}% - 6px)`,
            width: 12, height: 12,
            background: "#fff", border: `2px solid ${C.purple}`, borderRadius: "50%",
            boxShadow: "0 1px 4px rgba(0,0,0,.15)",
          }} />
        </div>

        <span style={{ fontFamily: "Sora,sans-serif", fontSize: ".63rem", color: C.textMuted, flexShrink: 0, minWidth: 52, textAlign: "right" }}>
          {fmt(current)} / {fmt(total)}
        </span>

        <a
          href={url}
          download
          target="_blank"
          rel="noreferrer"
          title="Download recording"
          style={{ color: C.textGhost, display: "flex", flexShrink: 0 }}
        >
          <Download size={13} />
        </a>
      </div>
    </div>
  );
}

// ── Detail Panel (light) ──────────────────────────────────────────────────────
function DetailPanel({
  call,
  menuItems,
  onClose,
  onOpenReviewModal,
  onSuccess,
}: {
  call: CallRecord;
  menuItems: MenuItem[];
  onClose: () => void;
  onOpenReviewModal: () => void;
  onSuccess?: () => void;
}) {
  const [tab, setTab] = useState<"audit" | "order">("audit");

  const name = getDisplayName(call);
  const sentiment = getSentiment(call);
  const outcome = getOutcome(call);
  const revenue = getOrderRevenue(call);
  const { time, date } = formatTimestamp(call.start_timestamp);

  const extractedItems = useMemo(() => {
    const summaryText = (
      (typeof call.order_items === "string" ? call.order_items : "") +
      " " +
      (call.call_summary || "") +
      " " +
      (call.transcript || "")
    ).toLowerCase();
    const detected: { item: string; quantity: number; price: number }[] = [];
    
    menuItems.forEach((menuItem) => {
      const itemLower = menuItem.name.toLowerCase().trim();
      let matched = false;
      let matchedStr = itemLower;

      if (summaryText.includes(itemLower)) {
        matched = true;
      } else if (itemLower.endsWith("s")) {
        if (itemLower.endsWith("ies") && itemLower.length > 3) {
          const singular = itemLower.slice(0, -3) + "y";
          if (summaryText.includes(singular)) {
            matched = true;
            matchedStr = singular;
          }
        } else if (itemLower.endsWith("es") && itemLower.length > 2) {
          const singular = itemLower.slice(0, -2);
          if (summaryText.includes(singular)) {
            matched = true;
            matchedStr = singular;
          }
        } else {
          const singular = itemLower.slice(0, -1);
          if (summaryText.includes(singular)) {
            matched = true;
            matchedStr = singular;
          }
        }
      } else if (itemLower.endsWith("y") && itemLower.length > 1) {
        const plural = itemLower.slice(0, -1) + "ies";
        if (summaryText.includes(plural)) {
          matched = true;
          matchedStr = plural;
        }
      }

      if (matched) {
        let qty = 1;
        const escapedName = matchedStr.replace(/[\\^$*+?.()|[\]{}]/g, '\\$&');
        const regexBefore = new RegExp(`(\\d+)\\s*(?:x|packs|bags|cases|units|bottles|jars|cartons)?\\s*${escapedName}`, 'i');
        const matchBefore = summaryText.match(regexBefore);
        if (matchBefore) {
          qty = parseInt(matchBefore[1], 10);
        } else {
          const regexAfter = new RegExp(`${escapedName}\\s*(?:x|packs|bags|cases|units|bottles|jars|cartons|:|-)?\\s*(\\d+)`, 'i');
          const matchAfter = summaryText.match(regexAfter);
          if (matchAfter) {
            qty = parseInt(matchAfter[1], 10);
          }
        }
        
        if (!detected.some(d => d.item === menuItem.name)) {
          detected.push({
            item: menuItem.name,
            quantity: qty,
            price: menuItem.price
          });
        }
      }
    });

    // Custom B2B / unregistered items extraction fallback
    const originalText = (
      (typeof call.order_items === "string" ? call.order_items : "") +
      " " +
      (call.call_summary || "") +
      " " +
      (call.transcript || "")
    );
    const customRegex = /(?:ordering|ordered|order of|order for|order|inquired about|inquire about|inquiry for|inquiry about|inquiries for|inquiries about|buy|purchase|requested|request|want|need)\s+(\d+)(?:\s+\b(kilograms|kilogram|kg|grams|gram|packs|pack|bags|bag|cases|case|units|unit|bottles|bottle|jars|jar|cartons|carton|tins|tin|g)\b)?\s*(?:of\s+)?\s*([^,\.]+)/gi;
    const stopWords = new Set(['for', 'at', 'to', 'with', 'and', 'on', 'in', 'from', 'by', 'ended', 'the', 'business', 'purposes', 'inquired', 'please']);

    let match;
    customRegex.lastIndex = 0;
    while ((match = customRegex.exec(originalText)) !== null) {
      const qty = parseInt(match[1], 10);
      const unit = match[2] || '';
      const rawItem = match[3].trim();
      
      const words = rawItem.split(/\s+/);
      const cleanWords = [];
      for (const word of words) {
        const cleanWord = word.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
        if (stopWords.has(cleanWord)) {
          break;
        }
        cleanWords.push(word);
      }
      const cleanItem = cleanWords.join(' ').trim();
      
      if (cleanItem) {
        const finalName = unit ? `${cleanItem} (${unit})` : cleanItem;
        const alreadyDetected = detected.some(
          d => d.item.toLowerCase().includes(cleanItem.toLowerCase()) || 
               cleanItem.toLowerCase().includes(d.item.toLowerCase())
        );
        if (!alreadyDetected) {
          detected.push({
            item: finalName,
            quantity: qty,
            price: 0
          });
        }
      }
    }

    return detected;
  }, [call.call_summary, call.order_items, call.transcript, menuItems]);

  const extractedTotal = useMemo(() => {
    return extractedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [extractedItems]);

  const handleForcePrint = async () => {
    if (!call.order_details?.order_id) {
      toast.error("No synced Clover order found to reprint");
      return;
    }
    const loadingToast = toast.loading("Sending reprint request to Clover...");
    try {
      await reprintOrderApi(call.order_details.order_id);
      toast.success("Print command sent to warehouse fulfillment printer", { id: loadingToast });
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to send print command", { id: loadingToast });
    }
  };

  const handleCancelRefund = async () => {
    if (!call.order_details?.order_id) {
      toast.error("No synced Clover order found to cancel");
      return;
    }
    const loadingToast = toast.loading("Processing cancellation...");
    try {
      await cancelOrderApi(call.order_details.order_id);
      toast("Cancellation & refund triggered", { id: loadingToast, icon: "💳" });
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to cancel order", { id: loadingToast });
    }
  };

  const handleBlockCaller = () => toast.error(`${call.caller_phone ?? "Number"} added to block list`);

  return (
    <div
      style={{
        width: 420,
        flexShrink: 0,
        borderLeft: `1px solid ${C.border}`,
        background: C.panel,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: "-4px 0 20px rgba(0,0,0,.05)",
      }}
    >
      {/* ── Panel header ── */}
      <div
        style={{
          padding: "14px 18px",
          borderBottom: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexShrink: 0,
        }}
      >
        {/* Avatar */}
        <div
          style={{
            width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
            background: C.purpleBg,
            border: `1px solid ${C.purpleBdr}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "Sora,sans-serif", fontSize: ".9rem", fontWeight: 800, color: C.purpleText,
          }}
        >
          {name[0]?.toUpperCase() ?? "?"}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: "Sora,sans-serif", fontSize: ".83rem", fontWeight: 800, color: C.text, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {name}
          </p>
          <p style={{ fontFamily: "Sora,sans-serif", fontSize: ".64rem", color: C.textMuted, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {call.caller_phone || "No number"} · {date} {time}
          </p>
        </div>

        <button
          onClick={onClose}
          style={{
            width: 30, height: 30, borderRadius: 8,
            border: `1px solid ${C.border}`,
            background: C.inputBg,
            color: C.textMuted, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* ── Meta strip ── */}
      <div
        style={{
          padding: "9px 18px",
          borderBottom: `1px solid ${C.borderFaint}`,
          display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap",
          flexShrink: 0,
          background: "#FAFBFD",
        }}
      >
        <span
          style={{
            fontFamily: "Sora,sans-serif", fontSize: ".65rem", fontWeight: 700,
            padding: "3px 10px", borderRadius: 100,
            background: outcome.bg, color: outcome.color, border: `1px solid ${outcome.border}`,
          }}
        >
          {outcome.label}
        </span>

        {sentiment && (
          <span
            style={{
              fontFamily: "Sora,sans-serif", fontSize: ".65rem", fontWeight: 700,
              padding: "3px 10px", borderRadius: 100,
              background: sentiment.bg, color: sentiment.color, border: `1px solid ${sentiment.border}`,
            }}
          >
            {sentiment.emoji} {sentiment.label}
          </span>
        )}

        {revenue !== null && (
          <span
            style={{
              fontFamily: "Sora,sans-serif", fontSize: ".65rem", fontWeight: 700,
              padding: "3px 10px", borderRadius: 100,
              background: C.greenBg, color: C.green, border: `1px solid ${C.greenBdr}`,
            }}
          >
            ${revenue.toFixed(2)}
          </span>
        )}

        <span style={{ fontFamily: "Sora,sans-serif", fontSize: ".63rem", color: C.textGhost, marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
          <Clock size={10} style={{ color: C.textGhost }} />
          {formatDuration(call.duration_ms)}
        </span>
      </div>

      {/* ── Tabs ── */}
      <div
        style={{
          display: "flex",
          borderBottom: `1px solid ${C.border}`,
          flexShrink: 0,
          padding: "0 18px",
          background: "#FAFBFD",
        }}
      >
        {(
          [
            { key: "audit", label: "Call Audit", icon: <FileText size={11} /> },
            { key: "order", label: "Order Ticket", icon: <ShoppingBag size={11} /> },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              fontFamily: "Sora,sans-serif", fontSize: ".71rem", fontWeight: 700,
              padding: "10px 14px",
              background: "none", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 5,
              color: tab === t.key ? C.purple : C.textMuted,
              borderBottom: `2px solid ${tab === t.key ? C.purple : "transparent"}`,
              marginBottom: -1,
              transition: "color .15s",
              whiteSpace: "nowrap",
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div
        style={{
          flex: 1, overflowY: "auto",
          padding: "16px 18px",
          display: "flex", flexDirection: "column", gap: 14,
        }}
      >
        {/* ─── Call Audit tab ─── */}
        {tab === "audit" && (
          <>
            {/* AI Summary */}
            {call.call_summary && (
              <div
                style={{
                  background: C.purpleBg,
                  border: `1px solid ${C.purpleBdr}`,
                  borderRadius: 14, padding: "12px 14px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                  <Activity size={11} style={{ color: C.purple }} />
                  <span style={{ fontFamily: "Sora,sans-serif", fontSize: ".63rem", fontWeight: 700, color: C.purpleText, letterSpacing: ".07em", textTransform: "uppercase" }}>
                    AI Summary
                  </span>
                </div>
                <p style={{ fontFamily: "Sora,sans-serif", fontSize: ".74rem", color: C.textSub, lineHeight: 1.65, margin: 0 }}>
                  {call.call_summary}
                </p>
              </div>
            )}

            {/* Audio player */}
            {call.recording_url ? (
              <AudioPlayer url={call.recording_url} duration={call.duration_ms} />
            ) : (
              <div
                style={{
                  background: C.inputBg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 13, padding: "13px 14px",
                  display: "flex", alignItems: "center", gap: 10,
                }}
              >
                <PhoneOff size={14} style={{ color: C.textGhost }} />
                <span style={{ fontFamily: "Sora,sans-serif", fontSize: ".72rem", color: C.textMuted }}>
                  No recording available for this call
                </span>
              </div>
            )}

            {/* Transcript */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <MessageSquare size={11} style={{ color: C.textMuted }} />
                <span style={{ fontFamily: "Sora,sans-serif", fontSize: ".63rem", fontWeight: 700, color: C.textMuted, letterSpacing: ".07em", textTransform: "uppercase" }}>
                  Transcript
                </span>
              </div>

              {call.transcript ? (
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 9,
                  maxHeight: "450px",
                  overflowY: "auto",
                  padding: "12px",
                  background: "#F8F9FB",
                  borderRadius: "12px",
                  border: `1px solid ${C.border}`,
                }}>
                  {call.transcript
                    .split("\n")
                    .filter(Boolean)
                    .map((line, i) => {
                      const isAgent = line.startsWith("Agent:");
                      const text = line.replace(/^(Agent|User):\s*/, "");
                      if (!text.trim()) return null;
                      return (
                        <div
                          key={i}
                          style={{ display: "flex", gap: 8, flexDirection: isAgent ? "row" : "row-reverse" }}
                        >
                          <div
                            style={{
                              width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                              background: isAgent ? C.purpleBg : C.greenBg,
                              border: `1px solid ${isAgent ? C.purpleBdr : C.greenBdr}`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontFamily: "Sora,sans-serif", fontSize: ".58rem", fontWeight: 800,
                              color: isAgent ? C.purpleText : C.green,
                              marginTop: 2,
                            }}
                          >
                            {isAgent ? "AI" : "U"}
                          </div>
                          <div
                            style={{
                              maxWidth: "82%",
                              padding: "8px 12px",
                              borderRadius: isAgent ? "4px 14px 14px 14px" : "14px 4px 14px 14px",
                              background: isAgent ? C.purpleBg : C.greenBg,
                              border: `1px solid ${isAgent ? C.purpleBdr : C.greenBdr}`,
                              fontFamily: "Sora,sans-serif", fontSize: ".72rem",
                              color: C.textSub,
                              lineHeight: 1.58,
                            }}
                          >
                            {text}
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "22px 0", gap: 8 }}>
                  <MessageSquare size={22} style={{ color: "rgba(0,0,0,.1)" }} />
                  <p style={{ fontFamily: "Sora,sans-serif", fontSize: ".72rem", color: C.textGhost, margin: 0 }}>
                    No transcript available
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ─── Order Ticket tab ─── */}
        {tab === "order" && (
          <>
            {call.order_details ? (
              <>
                {/* Order header */}
                <div
                  style={{
                    background: C.greenBg,
                    border: `1px solid ${C.greenBdr}`,
                    borderRadius: 15, padding: "14px 16px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <ShoppingBag size={13} style={{ color: C.green }} />
                      <span style={{ fontFamily: "Sora,sans-serif", fontSize: ".76rem", fontWeight: 800, color: C.text }}>
                        Order #{String(call.order_details.order_id ?? "").slice(-6) || "—"}
                      </span>
                    </div>
                    {/* POS sync status */}
                    <span
                      style={{
                        fontFamily: "Sora,sans-serif", fontSize: ".63rem", fontWeight: 700,
                        padding: "3px 9px", borderRadius: 100,
                        background: call.order_details.status ? C.greenBg : C.redBg,
                        color: call.order_details.status ? C.green : C.red,
                        border: `1px solid ${call.order_details.status ? C.greenBdr : C.redBdr}`,
                      }}
                    >
                      {call.order_details.status
                        ? `POS: ${String(call.order_details.status).toUpperCase()}`
                        : "POS: Needs Review"}
                    </span>
                  </div>

                  {call.order_details.customer_name && (
                    <p style={{ fontFamily: "Sora,sans-serif", fontSize: ".68rem", color: C.textMuted, margin: "0 0 3px" }}>
                      Customer:{" "}
                      <span style={{ color: C.text, fontWeight: 700 }}>
                        {call.order_details.customer_name}
                      </span>
                    </p>
                  )}
                  {call.order_details.order_type && (
                    <p style={{ fontFamily: "Sora,sans-serif", fontSize: ".68rem", color: C.textMuted, margin: "0 0 3px" }}>
                      Type:{" "}
                      <span style={{ color: C.text, fontWeight: 700, textTransform: "capitalize" }}>
                        {call.order_details.order_type}
                      </span>
                    </p>
                  )}
                  {call.order_details.delivery_address && (
                    <p style={{ fontFamily: "Sora,sans-serif", fontSize: ".68rem", color: C.textMuted, margin: "0 0 3px" }}>
                      Delivery:{" "}
                      <span style={{ color: C.text, fontWeight: 700 }}>
                        {call.order_details.delivery_address}
                      </span>
                    </p>
                  )}

                  {/* POS sync note */}
                  <div
                    style={{
                      marginTop: 10,
                      padding: "7px 10px",
                      background: "rgba(0,0,0,.03)",
                      borderRadius: 9,
                      display: "flex", alignItems: "center", gap: 7,
                    }}
                  >
                    <CheckCircle2 size={11} style={{ color: call.order_details.status ? C.green : C.red, flexShrink: 0 }} />
                    <span style={{ fontFamily: "Sora,sans-serif", fontSize: ".66rem", color: C.textMuted }}>
                      {call.order_details.status
                        ? "Order synced to POS successfully"
                        : "POS sync failed — use Force Print to send manually"}
                    </span>
                  </div>
                </div>

                {/* Itemized receipt */}
                {Array.isArray(call.order_details.order_items) &&
                  call.order_details.order_items.length > 0 && (
                    <div
                      style={{
                        background: C.card,
                        border: `1px solid ${C.border}`,
                        borderRadius: 15, overflow: "hidden",
                        boxShadow: "0 1px 6px rgba(0,0,0,.04)",
                      }}
                    >
                      <div
                        style={{
                          padding: "10px 14px",
                          borderBottom: `1px solid ${C.borderFaint}`,
                          display: "flex", alignItems: "center", gap: 6,
                          background: "#FAFBFD",
                        }}
                      >
                        <FileText size={11} style={{ color: C.textMuted }} />
                        <span style={{ fontFamily: "Sora,sans-serif", fontSize: ".63rem", fontWeight: 700, color: C.textMuted, letterSpacing: ".07em", textTransform: "uppercase" }}>
                          Itemized Receipt
                        </span>
                      </div>

                      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 11 }}>
                        {call.order_details.order_items.map((item: any, i: number) => {
                          const price = item.price ?? item.unit_price ?? item.item_price ?? 0;
                          const qty = item.quantity ?? item.qty ?? 1;
                          return (
                            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                              <span style={{ fontFamily: "Sora,sans-serif", fontSize: ".72rem", fontWeight: 800, color: C.purpleText, width: 24, flexShrink: 0 }}>
                                {qty}×
                              </span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontFamily: "Sora,sans-serif", fontSize: ".75rem", fontWeight: 700, color: C.text, margin: 0, lineHeight: 1.35 }}>
                                  {item.item ?? item.name ?? "Item"}
                                </p>
                                {item.special_instructions && (
                                  <p style={{ fontFamily: "Sora,sans-serif", fontSize: ".63rem", color: C.textMuted, margin: "3px 0 0", lineHeight: 1.4 }}>
                                    · {item.special_instructions}
                                  </p>
                                )}
                              </div>
                              {price > 0 && (
                                <span style={{ fontFamily: "Sora,sans-serif", fontSize: ".73rem", fontWeight: 700, color: C.green, flexShrink: 0 }}>
                                  ${(price * qty).toFixed(2)}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Total row */}
                      {revenue !== null && (
                        <div
                          style={{
                            padding: "10px 14px",
                            borderTop: `1px solid ${C.border}`,
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            background: "#FAFBFD",
                          }}
                        >
                          <span style={{ fontFamily: "Sora,sans-serif", fontSize: ".71rem", color: C.textMuted }}>
                            Order Total
                          </span>
                          <span style={{ fontFamily: "Sora,sans-serif", fontSize: ".9rem", fontWeight: 800, color: C.green }}>
                            ${revenue.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                {/* Special notes */}
                {call.order_details.special_notes && (
                  <div
                    style={{
                      background: C.goldBg,
                      border: `1px solid ${C.goldBdr}`,
                      borderRadius: 12, padding: "10px 13px",
                    }}
                  >
                    <p style={{ fontFamily: "Sora,sans-serif", fontSize: ".72rem", color: C.gold, margin: 0, lineHeight: 1.55 }}>
                      📝 {call.order_details.special_notes}
                    </p>
                  </div>
                )}

                {/* Timestamps */}
                {call.order_details.created_at && (
                  <p style={{ fontFamily: "Sora,sans-serif", fontSize: ".64rem", color: C.textGhost, margin: 0 }}>
                    Placed:{" "}
                    {new Date(call.order_details.created_at).toLocaleString("en-US", {
                      month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
                    })}
                  </p>
                )}
              </>
            ) : (call.order_booked && (extractedItems.length > 0 || call.order_items || call.call_summary)) ? (
              <>
                {/* Fallback AI Extracted Ticket */}
                <div
                  style={{
                    background: C.goldBg,
                    border: `1px solid ${C.goldBdr}`,
                    borderRadius: 15, padding: "14px 16px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <ShoppingBag size={13} style={{ color: C.gold }} />
                      <span style={{ fontFamily: "Sora,sans-serif", fontSize: ".76rem", fontWeight: 800, color: C.text }}>
                        Order Ticket (AI Extracted)
                      </span>
                    </div>
                    <span
                      onClick={onOpenReviewModal}
                      title="Click to place formal order"
                      style={{
                        fontFamily: "Sora,sans-serif", fontSize: ".63rem", fontWeight: 700,
                        padding: "4px 10px", borderRadius: 100,
                        background: C.goldBg,
                        color: C.gold,
                        border: `1px solid ${C.goldBdr}`,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        userSelect: "none",
                      }}
                    >
                      AI DRAFT ✎
                    </span>
                  </div>

                  {(call.customer_name_extracted || call.customer_name) && (
                    <p style={{ fontFamily: "Sora,sans-serif", fontSize: ".68rem", color: C.textMuted, margin: "0 0 3px" }}>
                      Customer:{" "}
                      <span style={{ color: C.text, fontWeight: 700 }}>
                        {call.customer_name_extracted || call.customer_name}
                      </span>
                    </p>
                  )}
                  {call.order_type && (
                    <p style={{ fontFamily: "Sora,sans-serif", fontSize: ".68rem", color: C.textMuted, margin: "0 0 3px" }}>
                      Type:{" "}
                      <span style={{ color: C.text, fontWeight: 700, textTransform: "capitalize" }}>
                        {call.order_type}
                      </span>
                    </p>
                  )}

                  <div
                    style={{
                      marginTop: 10,
                      padding: "7px 10px",
                      background: "rgba(0,0,0,.03)",
                      borderRadius: 9,
                      display: "flex", alignItems: "center", gap: 7,
                    }}
                  >
                    <Activity size={11} style={{ color: C.gold, flexShrink: 0 }} />
                    <span style={{ fontFamily: "Sora,sans-serif", fontSize: ".66rem", color: C.textMuted }}>
                      Synced to Call Log (Draft Order)
                    </span>
                  </div>
                </div>

                {/* Styled Draft receipt of extracted items */}
                {extractedItems.length > 0 ? (
                  <div
                    style={{
                      background: C.card,
                      border: `1px solid ${C.border}`,
                      borderRadius: 15, overflow: "hidden",
                      boxShadow: "0 1px 6px rgba(0,0,0,.04)",
                    }}
                  >
                    <div
                      style={{
                        padding: "10px 14px",
                        borderBottom: `1px solid ${C.borderFaint}`,
                        display: "flex", alignItems: "center", gap: 6,
                        background: "#FAFBFD",
                      }}
                    >
                      <FileText size={11} style={{ color: C.gold }} />
                      <span style={{ fontFamily: "Sora,sans-serif", fontSize: ".63rem", fontWeight: 700, color: C.gold, letterSpacing: ".07em", textTransform: "uppercase" }}>
                        Draft Receipt (AI Extracted)
                      </span>
                    </div>

                    <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 11 }}>
                      {extractedItems.map((item, i) => (
                        <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                          <span style={{ fontFamily: "Sora,sans-serif", fontSize: ".72rem", fontWeight: 800, color: C.gold, width: 24, flexShrink: 0 }}>
                            {item.quantity}×
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontFamily: "Sora,sans-serif", fontSize: ".75rem", fontWeight: 700, color: C.text, margin: 0, lineHeight: 1.35 }}>
                              {item.item}
                            </p>
                          </div>
                          {item.price > 0 && (
                            <span style={{ fontFamily: "Sora,sans-serif", fontSize: ".73rem", fontWeight: 700, color: C.gold, flexShrink: 0 }}>
                              ${(item.price * item.quantity).toFixed(2)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Estimated Total row */}
                    {extractedTotal > 0 && (
                      <div
                        style={{
                          padding: "10px 14px",
                          borderTop: `1px solid ${C.border}`,
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          background: "#FAFBFD",
                        }}
                      >
                        <span style={{ fontFamily: "Sora,sans-serif", fontSize: ".71rem", color: C.textMuted }}>
                          Estimated Total
                        </span>
                        <span style={{ fontFamily: "Sora,sans-serif", fontSize: ".9rem", fontWeight: 800, color: C.gold }}>
                          ${extractedTotal.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Fallback to raw summary/items if nothing matched */
                  <div
                    style={{
                      background: C.card,
                      border: `1px solid ${C.border}`,
                      borderRadius: 15, overflow: "hidden",
                      boxShadow: "0 1px 6px rgba(0,0,0,.04)",
                    }}
                  >
                    <div
                      style={{
                        padding: "10px 14px",
                        borderBottom: `1px solid ${C.borderFaint}`,
                        display: "flex", alignItems: "center", gap: 6,
                        background: "#FAFBFD",
                      }}
                    >
                      <FileText size={11} style={{ color: C.textMuted }} />
                      <span style={{ fontFamily: "Sora,sans-serif", fontSize: ".63rem", fontWeight: 700, color: C.textMuted, letterSpacing: ".07em", textTransform: "uppercase" }}>
                        AI Call Summary
                      </span>
                    </div>

                    <div style={{ padding: "12px 14px" }}>
                      {(call.order_items || call.call_summary) ? (
                        <p style={{ fontFamily: "Sora,sans-serif", fontSize: ".76rem", color: C.textSub, lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>
                          {call.order_items
                            ? (typeof call.order_items === "string" ? call.order_items : JSON.stringify(call.order_items))
                            : call.call_summary}
                        </p>
                      ) : (
                        <p style={{ fontFamily: "Sora,sans-serif", fontSize: ".72rem", color: C.textMuted, margin: 0, fontStyle: "italic" }}>
                          No specific items extracted. Please check the call transcript.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Special notes */}
                {call.special_notes && (
                  <div
                    style={{
                      background: C.goldBg,
                      border: `1px solid ${C.goldBdr}`,
                      borderRadius: 12, padding: "10px 13px",
                    }}
                  >
                    <p style={{ fontFamily: "Sora,sans-serif", fontSize: ".72rem", color: C.gold, margin: 0, lineHeight: 1.55 }}>
                      📝 {call.special_notes}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 160, gap: 10 }}>
                <ShoppingBag size={28} style={{ color: "rgba(0,0,0,.1)" }} />
                <p style={{ fontFamily: "Sora,sans-serif", fontSize: ".76rem", color: C.textGhost, margin: 0 }}>
                  No order placed on this call
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Action buttons ── */}
      <div
        style={{
          padding: "14px 18px",
          borderTop: `1px solid ${C.border}`,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          flexShrink: 0,
          background: "#FAFBFD",
        }}
      >
        <span style={{ fontFamily: "Sora,sans-serif", fontSize: ".6rem", fontWeight: 700, color: C.textGhost, letterSpacing: ".08em", textTransform: "uppercase" }}>
          Actions
        </span>

        <div style={{ display: "grid", gridTemplateColumns: call.order_details ? "1fr 1fr" : "1fr", gap: 7 }}>
          {call.order_details ? (
            <>
              <button
                onClick={handleForcePrint}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  fontFamily: "Sora,sans-serif", fontSize: ".71rem", fontWeight: 700,
                  padding: "9px 12px", borderRadius: 11,
                  background: C.purpleBg, border: `1px solid ${C.purpleBdr}`,
                  color: C.purpleText, cursor: "pointer",
                }}
              >
                <Printer size={12} /> Force Print
              </button>
              <button
                onClick={handleCancelRefund}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  fontFamily: "Sora,sans-serif", fontSize: ".71rem", fontWeight: 700,
                  padding: "9px 12px", borderRadius: 11,
                  background: C.redBg, border: `1px solid ${C.redBdr}`,
                  color: C.red, cursor: "pointer",
                }}
              >
                <DollarSign size={12} /> Cancel & Refund
              </button>
            </>
          ) : (call.order_booked && (extractedItems.length > 0 || call.order_items || call.call_summary)) ? (
            <button
              onClick={onOpenReviewModal}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                fontFamily: "Sora,sans-serif", fontSize: ".71rem", fontWeight: 700,
                padding: "9px 12px", borderRadius: 11,
                background: C.goldBg, border: `1px solid ${C.goldBdr}`,
                color: C.gold, cursor: "pointer",
                gridColumn: "1 / -1",
              }}
            >
              <ShoppingBag size={12} /> Confirm & Place POS Order
            </button>
          ) : null}
          <button
            onClick={handleBlockCaller}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              fontFamily: "Sora,sans-serif", fontSize: ".71rem", fontWeight: 700,
              padding: "9px 12px", borderRadius: 11,
              background: C.inputBg, border: `1px solid ${C.border}`,
              color: C.textSub, cursor: "pointer",
              gridColumn: call.order_details ? "auto" : "1 / -1",
            }}
          >
            <Ban size={12} /> Block Caller
          </button>
        </div>
      </div>
    </div>
  );
}

interface ReviewOrderModalProps {
  call: CallRecord;
  menuItems: MenuItem[];
  onClose: () => void;
  onSuccess: () => void;
}

function ReviewOrderModal({ call, menuItems, onClose, onSuccess }: ReviewOrderModalProps) {
  const [customerName, setCustomerName] = useState(call.customer_name_extracted || call.customer_name || "");
  const [customerPhone, setCustomerPhone] = useState(call.caller_phone || "");
  const [orderType, setOrderType] = useState(call.order_type || "pickup");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [selectedItems, setSelectedItems] = useState<{ item: string; quantity: number; price: number }[]>([]);
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Auto-detect items from call summary/order items/transcript
  useEffect(() => {
    const summaryText = (
      (typeof call.order_items === "string" ? call.order_items : "") +
      " " +
      (call.call_summary || "") +
      " " +
      (call.transcript || "")
    ).toLowerCase();
    const detected: { item: string; quantity: number; price: number }[] = [];
    
    menuItems.forEach((menuItem) => {
      const itemLower = menuItem.name.toLowerCase().trim();
      let matched = false;
      let matchedStr = itemLower;

      if (summaryText.includes(itemLower)) {
        matched = true;
      } else if (itemLower.endsWith("s")) {
        if (itemLower.endsWith("ies") && itemLower.length > 3) {
          const singular = itemLower.slice(0, -3) + "y";
          if (summaryText.includes(singular)) {
            matched = true;
            matchedStr = singular;
          }
        } else if (itemLower.endsWith("es") && itemLower.length > 2) {
          const singular = itemLower.slice(0, -2);
          if (summaryText.includes(singular)) {
            matched = true;
            matchedStr = singular;
          }
        } else {
          const singular = itemLower.slice(0, -1);
          if (summaryText.includes(singular)) {
            matched = true;
            matchedStr = singular;
          }
        }
      } else if (itemLower.endsWith("y") && itemLower.length > 1) {
        const plural = itemLower.slice(0, -1) + "ies";
        if (summaryText.includes(plural)) {
          matched = true;
          matchedStr = plural;
        }
      }

      if (matched) {
        let qty = 1;
        const escapedName = matchedStr.replace(/[\\^$*+?.()|[\]{}]/g, '\\$&');
        const regexBefore = new RegExp(`(\\d+)\\s*(?:x|packs|bags|cases|units|bottles|jars|cartons)?\\s*${escapedName}`, 'i');
        const matchBefore = summaryText.match(regexBefore);
        if (matchBefore) {
          qty = parseInt(matchBefore[1], 10);
        } else {
          const regexAfter = new RegExp(`${escapedName}\\s*(?:x|packs|bags|cases|units|bottles|jars|cartons|:|-)?\\s*(\\d+)`, 'i');
          const matchAfter = summaryText.match(regexAfter);
          if (matchAfter) {
            qty = parseInt(matchAfter[1], 10);
          }
        }
        
        if (!detected.some(d => d.item === menuItem.name)) {
          detected.push({
            item: menuItem.name,
            quantity: qty,
            price: menuItem.price
          });
        }
      }
    });

    // Custom B2B / unregistered items extraction fallback
    const originalText = (
      (typeof call.order_items === "string" ? call.order_items : "") +
      " " +
      (call.call_summary || "") +
      " " +
      (call.transcript || "")
    );
    const customRegex = /(?:ordering|ordered|order of|order for|order|inquired about|inquire about|inquiry for|inquiry about|inquiries for|inquiries about|buy|purchase|requested|request|want|need)\s+(\d+)(?:\s+\b(kilograms|kilogram|kg|grams|gram|packs|pack|bags|bag|cases|case|units|unit|bottles|bottle|jars|jar|cartons|carton|tins|tin|g)\b)?\s*(?:of\s+)?\s*([^,\.]+)/gi;
    const stopWords = new Set(['for', 'at', 'to', 'with', 'and', 'on', 'in', 'from', 'by', 'ended', 'the', 'business', 'purposes', 'inquired', 'please']);

    let match;
    customRegex.lastIndex = 0;
    while ((match = customRegex.exec(originalText)) !== null) {
      const qty = parseInt(match[1], 10);
      const unit = match[2] || '';
      const rawItem = match[3].trim();
      
      const words = rawItem.split(/\s+/);
      const cleanWords = [];
      for (const word of words) {
        const cleanWord = word.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
        if (stopWords.has(cleanWord)) {
          break;
        }
        cleanWords.push(word);
      }
      const cleanItem = cleanWords.join(' ').trim();
      
      if (cleanItem) {
        const finalName = unit ? `${cleanItem} (${unit})` : cleanItem;
        const alreadyDetected = detected.some(
          d => d.item.toLowerCase().includes(cleanItem.toLowerCase()) || 
               cleanItem.toLowerCase().includes(d.item.toLowerCase())
        );
        if (!alreadyDetected) {
          detected.push({
            item: finalName,
            quantity: qty,
            price: 0
          });
        }
      }
    }
    
    setSelectedItems(detected);
  }, [call.id, call.call_summary, call.order_items, call.transcript, menuItems]);

  const handleAddItem = () => {
    if (!newItemName) return;
    const menuItem = menuItems.find(i => i.name === newItemName);
    const price = menuItem ? menuItem.price : 0;
    
    const existingIndex = selectedItems.findIndex(i => i.item === newItemName);
    if (existingIndex > -1) {
      const updated = [...selectedItems];
      updated[existingIndex].quantity += newItemQty;
      setSelectedItems(updated);
    } else {
      setSelectedItems([...selectedItems, { item: newItemName, quantity: newItemQty, price }]);
    }
    setNewItemQty(1);
  };

  const handleRemoveItem = (index: number) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  const handleUpdateQty = (index: number, newQty: number) => {
    if (newQty < 1) return;
    const updated = [...selectedItems];
    updated[index].quantity = newQty;
    setSelectedItems(updated);
  };

  const totalAmount = selectedItems.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItems.length === 0) {
      toast.error("Please add at least one item to the order.");
      return;
    }
    
    setSubmitting(true);
    try {
      const payload = {
        customer_name: customerName,
        customer_phone: customerPhone,
        order_items: selectedItems,
        order_type: orderType,
        delivery_address: orderType.toLowerCase() === "delivery" ? deliveryAddress : "",
        total_amount: totalAmount
      };
      
      await confirmCallOrderApi(call.call_id, payload);
      toast.success("Order confirmed and synced to Clover POS!");
      onSuccess();
    } catch (err) {
      const error = err as { response?: { data?: { detail?: string } } };
      toast.error(error?.response?.data?.detail || "Failed to confirm order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15, 15, 26, 0.45)", backdropFilter: "blur(4px)", padding: "16px" }}>
      <div style={{ background: C.card, borderRadius: 16, boxShadow: "0 20px 50px rgba(0,0,0,0.15)", width: "100%", maxWidth: 640, display: "flex", flexDirection: "column", maxHeight: "90vh", overflow: "hidden" }}>
        
        {/* Header */}
        <div style={{ padding: "18px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontFamily: "Sora, sans-serif", fontSize: "1.05rem", fontWeight: 800, color: C.text, margin: 0 }}>Confirm & Place POS Order</h2>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.68rem", color: C.textMuted, margin: "3px 0 0" }}>Call ID: {call.id.slice(0, 16)}...</p>
          </div>
          <button onClick={onClose} style={{ background: C.inputBg, border: `1px solid ${C.border}`, width: 30, height: 30, borderRadius: 8, cursor: "pointer", color: C.textMuted, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
          
          {/* AI Reference Box */}
          <div style={{ background: C.goldBg, border: `1px solid ${C.goldBdr}`, borderRadius: 12, padding: "12px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <Activity size={12} style={{ color: C.gold }} />
              <span style={{ fontFamily: "Sora, sans-serif", fontSize: "0.65rem", fontWeight: 700, color: C.gold, letterSpacing: ".05em", textTransform: "uppercase" }}>AI Extracted Reference</span>
            </div>
            <p style={{ fontFamily: "Sora, sans-serif", fontSize: "0.74rem", color: C.textSub, margin: 0, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
              {call.order_items
                ? (typeof call.order_items === "string" ? call.order_items : JSON.stringify(call.order_items))
                : call.call_summary}
            </p>
          </div>

          {/* Form Fields */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontFamily: "Sora, sans-serif", fontSize: "0.7rem", fontWeight: 700, color: C.textSub, marginBottom: 5 }}>Customer Name</label>
              <input 
                type="text" 
                value={customerName} 
                onChange={(e) => setCustomerName(e.target.value)} 
                required
                style={{ width: "100%", boxSizing: "border-box", fontFamily: "Sora, sans-serif", fontSize: "0.78rem", background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", color: C.text }} 
              />
            </div>
            <div>
              <label style={{ display: "block", fontFamily: "Sora, sans-serif", fontSize: "0.7rem", fontWeight: 700, color: C.textSub, marginBottom: 5 }}>Customer Phone</label>
              <input 
                type="text" 
                value={customerPhone} 
                onChange={(e) => setCustomerPhone(e.target.value)} 
                required
                style={{ width: "100%", boxSizing: "border-box", fontFamily: "Sora, sans-serif", fontSize: "0.78rem", background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", color: C.text }} 
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontFamily: "Sora, sans-serif", fontSize: "0.7rem", fontWeight: 700, color: C.textSub, marginBottom: 6 }}>Order Type</label>
              <div style={{ display: "flex", gap: 8 }}>
                {["pickup", "delivery", "B2B Trade Inquiry", "B2B Export Inquiry"].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setOrderType(type)}
                    style={{
                      flex: 1, fontFamily: "Sora, sans-serif", fontSize: "0.71rem", fontWeight: 700,
                      padding: "8px 12px", borderRadius: 8, cursor: "pointer",
                      background: orderType.toLowerCase() === type.toLowerCase() ? C.purpleBg : C.inputBg,
                      color: orderType.toLowerCase() === type.toLowerCase() ? C.purpleText : C.textSub,
                      border: `1.5px solid ${orderType.toLowerCase() === type.toLowerCase() ? C.purpleBdr : C.border}`,
                      textTransform: "capitalize",
                      transition: "all .15s"
                    }}
                  >
                    {type === "pickup" ? "Pickup 🛍️" : type === "delivery" ? "Delivery 🚚" : type}
                  </button>
                ))}
              </div>
            </div>

            {orderType.toLowerCase() === "delivery" && (
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontFamily: "Sora, sans-serif", fontSize: "0.7rem", fontWeight: 700, color: C.textSub, marginBottom: 5 }}>Delivery Address</label>
                <input 
                  type="text" 
                  value={deliveryAddress} 
                  onChange={(e) => setDeliveryAddress(e.target.value)} 
                  required
                  placeholder="Street, City, Zip Code..."
                  style={{ width: "100%", boxSizing: "border-box", fontFamily: "Sora, sans-serif", fontSize: "0.78rem", background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", color: C.text }} 
                />
              </div>
            )}
          </div>

          {/* Product Selector Section */}
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
            <h3 style={{ fontFamily: "Sora, sans-serif", fontSize: "0.8rem", fontWeight: 800, color: C.text, margin: "0 0 10px 0" }}>Add Order Items</h3>
            
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1, position: "relative" }}>
                <select
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  style={{ width: "100%", fontFamily: "Sora, sans-serif", fontSize: "0.78rem", background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", color: C.text, appearance: "none" }}
                >
                  <option value="">-- Select a product --</option>
                  {menuItems.map((item) => (
                    <option key={item.id} value={item.name}>
                      {item.name} (${item.price.toFixed(2)})
                    </option>
                  ))}
                </select>
                <ChevronDown size={12} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: C.textMuted, pointerEvents: "none" }} />
              </div>
              <input
                type="number"
                min={1}
                value={newItemQty}
                onChange={(e) => setNewItemQty(Math.max(1, parseInt(e.target.value) || 1))}
                style={{ width: 68, textAlign: "center", fontFamily: "Sora, sans-serif", fontSize: "0.78rem", background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 6px", color: C.text }}
              />
              <button
                type="button"
                onClick={handleAddItem}
                disabled={!newItemName}
                style={{
                  display: "flex", alignItems: "center", gap: 4,
                  fontFamily: "Sora, sans-serif", fontSize: "0.73rem", fontWeight: 700,
                  padding: "8px 16px", borderRadius: 8, border: "none",
                  background: newItemName ? C.purple : C.inputBg,
                  color: newItemName ? "#fff" : C.textGhost,
                  cursor: newItemName ? "pointer" : "not-allowed",
                  transition: "background .15s"
                }}
              >
                Add Item
              </button>
            </div>
          </div>

          {/* Added Items List */}
          <div>
            <span style={{ display: "block", fontFamily: "Sora, sans-serif", fontSize: "0.68rem", fontWeight: 700, color: C.textGhost, letterSpacing: ".05em", textTransform: "uppercase", marginBottom: 8 }}>Order Items List</span>
            {selectedItems.length === 0 ? (
              <div style={{ border: `1px dashed ${C.border}`, borderRadius: 12, padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <ShoppingBag size={20} style={{ color: C.textGhost }} />
                <span style={{ fontFamily: "Sora, sans-serif", fontSize: "0.72rem", color: C.textMuted }}>No items added yet. Choose from dropdown above.</span>
              </div>
            ) : (
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", background: C.card }}>
                <div style={{ padding: "10px 14px", background: "#FAFBFD", borderBottom: `1px solid ${C.border}`, display: "grid", gridTemplateColumns: "1fr 70px 70px 70px 30px", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "Sora, sans-serif", fontSize: "0.64rem", fontWeight: 700, color: C.textMuted }}>Item Name</span>
                  <span style={{ fontFamily: "Sora, sans-serif", fontSize: "0.64rem", fontWeight: 700, color: C.textMuted, textAlign: "center" }}>Qty</span>
                  <span style={{ fontFamily: "Sora, sans-serif", fontSize: "0.64rem", fontWeight: 700, color: C.textMuted, textAlign: "right" }}>Price</span>
                  <span style={{ fontFamily: "Sora, sans-serif", fontSize: "0.64rem", fontWeight: 700, color: C.textMuted, textAlign: "right" }}>Total</span>
                  <span />
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {selectedItems.map((item, idx) => (
                    <div key={idx} style={{ padding: "10px 14px", borderBottom: idx === selectedItems.length - 1 ? "none" : `1px solid ${C.borderFaint}`, display: "grid", gridTemplateColumns: "1fr 70px 70px 70px 30px", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: "Sora, sans-serif", fontSize: "0.74rem", fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.item}</span>
                      
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => handleUpdateQty(idx, Math.max(1, parseInt(e.target.value) || 1))}
                          style={{ width: 48, textAlign: "center", fontFamily: "Sora, sans-serif", fontSize: "0.72rem", background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 4px", color: C.text }}
                        />
                      </div>
                      
                      <span style={{ fontFamily: "Sora, sans-serif", fontSize: "0.72rem", color: C.textSub, textAlign: "right" }}>${item.price.toFixed(2)}</span>
                      <span style={{ fontFamily: "Sora, sans-serif", fontSize: "0.74rem", fontWeight: 700, color: C.green, textAlign: "right" }}>${(item.price * item.quantity).toFixed(2)}</span>
                      
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: C.red, display: "flex", alignItems: "center", justifyContent: "center", padding: 4 }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                
                {/* Total row */}
                <div style={{ padding: "12px 14px", background: "#FAFBFD", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "Sora, sans-serif", fontSize: "0.71rem", color: C.textMuted }}>Total Amount</span>
                  <span style={{ fontFamily: "Sora, sans-serif", fontSize: "0.92rem", fontWeight: 800, color: C.green }}>${totalAmount.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div style={{ padding: "14px 24px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "flex-end", gap: 10, background: "#FAFBFD" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              fontFamily: "Sora, sans-serif", fontSize: "0.73rem", fontWeight: 700,
              padding: "9px 16px", borderRadius: 10, border: `1px solid ${C.border}`,
              background: "#fff", color: C.textSub, cursor: "pointer"
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || selectedItems.length === 0}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              fontFamily: "Sora, sans-serif", fontSize: "0.73rem", fontWeight: 700,
              padding: "9px 20px", borderRadius: 10, border: "none",
              background: selectedItems.length > 0 ? C.purple : C.textGhost,
              color: "#fff",
              cursor: submitting || selectedItems.length === 0 ? "not-allowed" : "pointer",
              transition: "opacity .15s"
            }}
          >
            {submitting ? "Processing..." : "Place POS Order"}
          </button>
        </div>

      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CallsOrders() {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<CallRecord | null>(null);
  const [mounted, setMounted] = useState(false);
  const [reviewingCall, setReviewingCall] = useState<CallRecord | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);

  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("all");
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [sortField, setSortField] = useState<SortField>("timestamp");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const fetchCalls = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await getCallsApi(0, 10000);
      setCalls(data);
      setSelected((prev) => {
        if (prev) {
          const updated = data.find((c) => c.id === prev.id);
          return updated ?? prev;
        }
        return data[0] ?? null;
      });
    } catch {
      /* handled by interceptor */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchMenuItems = async () => {
    try {
      const categories = await getCategoriesApi();
      const items = categories.flatMap((cat) => cat.items || []);
      setMenuItems(items);
    } catch (err) {
      console.error("Failed to fetch menu items", err);
    }
  };

  const fetchSettings = async () => {
    try {
      const data = await getSettingsApi();
      setSettings(data);
    } catch (err) {
      console.error("Failed to fetch settings", err);
    }
  };

  useEffect(() => {
    fetchCalls();
    fetchMenuItems();
    fetchSettings();
  }, []);
  useEffect(() => {
    if (!loading) requestAnimationFrame(() => setMounted(true));
  }, [loading]);

  const cutoffMs = (() => {
    if (dateFilter === "today") {
      const tz = settings?.restaurant_timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
      try {
        const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
        const midnightLocal = new Date(
          new Date(`${todayStr}T00:00:00`).toLocaleString("en-US", { timeZone: tz })
        );
        return midnightLocal.getTime();
      } catch {
        const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime();
      }
    }
    if (dateFilter === "7d") return Date.now() - 7 * 86_400_000;
    if (dateFilter === "30d") return Date.now() - 30 * 86_400_000;
    return 0;
  })();

  const filtered = calls.filter((c) => {
    if (dateFilter !== "all") {
      const callTime = c.start_timestamp;
      const orderTime = c.order_details?.created_at ? new Date(c.order_details.created_at).getTime() : 0;
      if (Math.max(callTime, orderTime) < cutoffMs) return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const ok =
        (c.caller_phone ?? "").includes(q) ||
        getDisplayName(c).toLowerCase().includes(q) ||
        (c.call_summary ?? "").toLowerCase().includes(q) ||
        String(c.order_details?.order_id ?? "").toLowerCase().includes(q);
      if (!ok) return false;
    }
    if (outcomeFilter === "ordered" && !hasOrder(c)) return false;
    if (outcomeFilter === "info" && (hasOrder(c) || !c.call_successful)) return false;
    if (outcomeFilter === "missed" && c.call_successful !== false) return false;
    if (sentimentFilter !== "all") {
      const isPositive = hasOrder(c) || (c.user_sentiment ?? "").toLowerCase() === "positive";
      const isNeutral = !hasOrder(c) && (c.user_sentiment ?? "").toLowerCase() === "neutral";
      const isNegative = !hasOrder(c) && ["negative", "frustrated"].includes((c.user_sentiment ?? "").toLowerCase());
      if (sentimentFilter === "positive" && !isPositive) return false;
      if (sentimentFilter === "neutral" && !isNeutral) return false;
      if (sentimentFilter === "negative" && !isNegative) return false;
    }
    return true;
  });

  const toggleSort = (f: SortField) => {
    if (sortField === f) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(f); setSortDir("desc"); }
  };

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortField === "timestamp") cmp = a.start_timestamp - b.start_timestamp;
    if (sortField === "duration") cmp = (a.duration_ms ?? 0) - (b.duration_ms ?? 0);
    if (sortField === "revenue") {
      const ra = getOrderRevenue(a) ?? -1;
      const rb = getOrderRevenue(b) ?? -1;
      cmp = ra - rb;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  useEffect(() => { setPage(1); }, [search, dateFilter, outcomeFilter, sentimentFilter, sortField, sortDir, pageSize]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

  // ── Loading screen ──
  if (loading) {
    return (
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          height: "100vh", background: C.pageBg,
        }}
      >
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <Loader2 size={22} style={{ color: C.purple, animation: "spin .8s linear infinite" }} />
          <p style={{ fontFamily: "Sora,sans-serif", fontSize: ".82rem", color: C.textMuted, margin: 0 }}>
            Loading calls…
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes fadeIn  { from{opacity:0}                           to{opacity:1}              }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        .co-row            { transition: background .12s !important; }
        .co-row:hover      { background: rgba(83,74,183,.04) !important; }
        .co-btn:hover      { opacity:.7 !important; }
        .co-period         { transition: background .14s, color .14s, box-shadow .14s !important; }
        .co-period:hover   { background: rgba(0,0,0,.055) !important; }
        .co-chip           { transition: background .14s, color .14s, border-color .14s, box-shadow .14s !important; }
        .co-chip:hover     { border-color: rgba(83,74,183,.35) !important; box-shadow: 0 2px 8px rgba(83,74,183,.10) !important; }
        .co-search-wrap:focus-within { border-color: #7F77DD !important; box-shadow: 0 0 0 3px rgba(127,119,221,.13) !important; }
        .co-select         { transition: border-color .14s, box-shadow .14s !important; }
        .co-select:focus   { border-color: #7F77DD !important; box-shadow: 0 0 0 3px rgba(127,119,221,.13) !important; }
        *::-webkit-scrollbar       { width: 4px; height: 4px; }
        *::-webkit-scrollbar-track { background: transparent; }
        *::-webkit-scrollbar-thumb { background: rgba(0,0,0,.1); border-radius: 99px; }
      `}</style>

      <div
        style={{
          display: "flex", flexDirection: "column",
          height: "100vh", overflow: "hidden",
          background: C.pageBg,
          position: "relative",
          fontFamily: "'Sora',sans-serif",
          WebkitFontSmoothing: "antialiased",
        }}
      >
        {/* decorative orbs (very subtle on light bg) */}
        <div style={{ position: "absolute", top: -220, right: -160, width: 520, height: 520, background: "radial-gradient(circle,rgba(83,74,183,.06) 0%,transparent 66%)", borderRadius: "50%", pointerEvents: "none", zIndex: 0 }} />
        <div style={{ position: "absolute", bottom: -180, left: -140, width: 440, height: 440, background: "radial-gradient(circle,rgba(15,168,98,.04) 0%,transparent 66%)", borderRadius: "50%", pointerEvents: "none", zIndex: 0 }} />

        {/* ── TOP BAR ── */}
        <div
          style={{
            background: C.topBar,
            borderBottom: `1px solid ${C.border}`,
            padding: "11px 24px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexShrink: 0, position: "relative", zIndex: 2,
            gap: 12,
            boxShadow: "0 1px 8px rgba(0,0,0,.05)",
            opacity: mounted ? 1 : 0,
            animation: mounted ? "fadeIn .4s ease both" : "none",
          }}
        >
          {/* Title */}
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <div
              style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                background: C.purpleBg, border: `1px solid ${C.purpleBdr}`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <Package size={16} style={{ color: C.purple }} />
            </div>
            <div>
              <h1
                style={{
                  fontFamily: "Sora,sans-serif", fontSize: "1rem", fontWeight: 800,
                  margin: 0, letterSpacing: "-.03em", color: C.text,
                }}
              >
                Calls & Orders
              </h1>
              <p style={{ fontFamily: "Sora,sans-serif", fontSize: ".64rem", color: C.textMuted, margin: "1px 0 0" }}>
                {filtered.length} result{filtered.length !== 1 ? "s" : ""} · engine room
              </p>
            </div>
          </div>

          {/* Refresh */}
          <button
            className="co-btn"
            onClick={() => fetchCalls(true)}
            disabled={refreshing}
            title="Refresh"
            style={{
              width: 34, height: 34, borderRadius: 9,
              border: `1px solid ${C.border}`, background: C.inputBg,
              color: C.textMuted, cursor: refreshing ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "opacity .2s", flexShrink: 0,
            }}
          >
            <RefreshCw
              size={13}
              style={refreshing ? { animation: "spin .8s linear infinite" } : undefined}
            />
          </button>
        </div>

        {/* ── FILTERS BAR ── */}
        <div
          style={{
            background: C.filtersBar,
            borderBottom: `1px solid ${C.border}`,
            padding: "12px 24px 10px",
            display: "flex", flexDirection: "column", gap: 9,
            flexShrink: 0, position: "relative", zIndex: 2,
            opacity: mounted ? 1 : 0,
            animation: mounted ? "fadeIn .48s ease both" : "none",
          }}
        >
          {/* ── Row 1: Search ── */}
          <div
            className="co-search-wrap"
            style={{
              display: "flex", alignItems: "center", gap: 9,
              background: "#fff",
              border: `1.5px solid ${C.inputBorder}`,
              borderRadius: 11, padding: "8px 14px",
              boxShadow: "0 1px 6px rgba(0,0,0,.05)",
              transition: "border-color .18s, box-shadow .18s",
            }}
          >
            <Search size={14} style={{ color: C.textMuted, flexShrink: 0 }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by phone, name, or order ID…"
              style={{
                flex: 1,
                fontFamily: "'Sora',sans-serif", fontSize: ".78rem",
                background: "none", border: "none", outline: "none",
                color: C.text,
                letterSpacing: "-.01em",
              }}
            />
            {search ? (
              <button
                onClick={() => setSearch("")}
                style={{
                  background: C.inputBg, border: "none", cursor: "pointer",
                  color: C.textMuted, display: "flex", alignItems: "center", justifyContent: "center",
                  padding: 0, width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                }}
              >
                <X size={10} />
              </button>
            ) : (
              <span style={{ fontSize: ".62rem", fontFamily: "'Sora',sans-serif", color: C.textGhost, flexShrink: 0, letterSpacing: ".02em" }}>
                {sorted.length} call{sorted.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* ── Row 2: Filter chips ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>

            {/* Date group label */}
            <span style={{ fontSize: ".58rem", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: C.textGhost, fontFamily: "'Sora',sans-serif", marginRight: 2 }}>Date</span>

            {/* Date pills */}
            <div style={{ display: "flex", gap: 3, background: "rgba(0,0,0,.035)", borderRadius: 100, padding: "3px" }}>
              {(["today", "7d", "30d", "all"] as const).map((d) => (
                <button
                  key={d}
                  className="co-period"
                  onClick={() => setDateFilter(d)}
                  style={{
                    fontFamily: "'Sora',sans-serif", fontSize: ".67rem", fontWeight: 700,
                    padding: "4px 12px", borderRadius: 100, border: "none", cursor: "pointer",
                    background: dateFilter === d ? "#fff" : "transparent",
                    color: dateFilter === d ? C.purple : C.textMuted,
                    boxShadow: dateFilter === d ? "0 1px 6px rgba(0,0,0,.10)" : "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  {d === "today" ? "Today" : d === "7d" ? "7 Days" : d === "30d" ? "Month" : "All"}
                </button>
              ))}
            </div>

            {/* Divider */}
            <div style={{ width: 1, height: 18, background: C.border, flexShrink: 0, margin: "0 2px" }} />

            {/* Outcome chips */}
            <span style={{ fontSize: ".58rem", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: C.textGhost, fontFamily: "'Sora',sans-serif", marginRight: 2 }}>Outcome</span>
            {(["all", "ordered", "info", "missed"] as const).map((o) => {
              const active = outcomeFilter === o;
              const label = o === "all" ? "All" : o === "ordered" ? "Ordered" : o === "info" ? "Info" : "Missed";
              const dot = o === "ordered" ? C.green : o === "info" ? C.gold : o === "missed" ? C.red : C.textMuted;
              return (
                <button
                  key={o}
                  className="co-chip"
                  onClick={() => setOutcomeFilter(o)}
                  style={{
                    fontFamily: "'Sora',sans-serif", fontSize: ".67rem", fontWeight: 700,
                    padding: "4px 11px", borderRadius: 100,
                    border: active ? `1.5px solid ${C.purpleBdr}` : `1.5px solid ${C.border}`,
                    cursor: "pointer",
                    background: active ? C.purpleBg : "#fff",
                    color: active ? C.purple : C.textSub,
                    display: "flex", alignItems: "center", gap: 5,
                    boxShadow: active ? `0 1px 8px ${C.purpleBdr}` : "none",
                  }}
                >
                  {o !== "all" && <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot, flexShrink: 0 }} />}
                  {label}
                </button>
              );
            })}

            {/* Divider */}
            <div style={{ width: 1, height: 18, background: C.border, flexShrink: 0, margin: "0 2px" }} />

            {/* Sentiment chips */}
            <span style={{ fontSize: ".58rem", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: C.textGhost, fontFamily: "'Sora',sans-serif", marginRight: 2 }}>Sentiment</span>
            {(["all", "positive", "neutral", "negative"] as const).map((s) => {
              const active = sentimentFilter === s;
              const label = s === "all" ? "All" : s === "positive" ? "😊 Happy" : s === "neutral" ? "😐 Neutral" : "😡 Frustrated";
              const accent = s === "positive" ? { bg: C.greenBg, bdr: C.greenBdr, txt: C.green }
                : s === "neutral" ? { bg: C.goldBg, bdr: C.goldBdr, txt: C.gold }
                  : s === "negative" ? { bg: C.redBg, bdr: C.redBdr, txt: C.red }
                    : { bg: C.purpleBg, bdr: C.purpleBdr, txt: C.purple };
              return (
                <button
                  key={s}
                  className="co-chip"
                  onClick={() => setSentimentFilter(s)}
                  style={{
                    fontFamily: "'Sora',sans-serif", fontSize: ".67rem", fontWeight: 700,
                    padding: "4px 11px", borderRadius: 100,
                    border: active ? `1.5px solid ${accent.bdr}` : `1.5px solid ${C.border}`,
                    cursor: "pointer",
                    background: active ? accent.bg : "#fff",
                    color: active ? accent.txt : C.textSub,
                    boxShadow: active ? `0 1px 8px ${accent.bdr}` : "none",
                  }}
                >
                  {label}
                </button>
              );
            })}

            {/* Active-filter reset — only shown when any filter is non-default */}
            {(dateFilter !== "all" || outcomeFilter !== "all" || sentimentFilter !== "all" || search.trim()) && (
              <button
                className="co-chip"
                onClick={() => { setDateFilter("all"); setOutcomeFilter("all"); setSentimentFilter("all"); setSearch(""); }}
                style={{
                  fontFamily: "'Sora',sans-serif", fontSize: ".64rem", fontWeight: 700,
                  padding: "4px 11px", borderRadius: 100, marginLeft: "auto",
                  border: `1.5px solid ${C.redBdr}`,
                  background: C.redBg, color: C.red, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 5,
                }}
              >
                <X size={9} /> Clear filters
              </button>
            )}
          </div>
        </div>

        {/* ── SPLIT PANE ── */}
        <div
          style={{
            flex: 1, display: "flex", overflow: "hidden",
            position: "relative", zIndex: 1,
            opacity: mounted ? 1 : 0,
            animation: mounted ? "fadeUp .42s .1s ease both" : "none",
          }}
        >
          {/* ── LEFT: Call Table ── */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

            {/* Column headers */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: selected
                  ? "115px 1fr 120px 70px 100px 78px 28px"
                  : "145px 1fr 148px 88px 115px 98px 32px",
                padding: "8px 20px",
                borderBottom: `1px solid ${C.border}`,
                background: "#F4F4FA",
                flexShrink: 0, alignItems: "center",
              }}
            >
              {/* Timestamp — sortable */}
              <button onClick={() => toggleSort("timestamp")} style={{ display: "flex", alignItems: "center", gap: 3, fontFamily: "Sora,sans-serif", fontSize: ".61rem", fontWeight: 700, color: sortField === "timestamp" ? C.purple : C.textMuted, letterSpacing: ".08em", textTransform: "uppercase", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                Timestamp {sortField === "timestamp" ? (sortDir === "asc" ? <ArrowUp size={9} /> : <ArrowDown size={9} />) : <ArrowUpDown size={9} style={{ opacity: .4 }} />}
              </button>
              {/* Caller */}
              <div style={{ fontFamily: "Sora,sans-serif", fontSize: ".61rem", fontWeight: 700, color: C.textMuted, letterSpacing: ".08em", textTransform: "uppercase" }}>Caller</div>
              {/* Outcome */}
              <div style={{ fontFamily: "Sora,sans-serif", fontSize: ".61rem", fontWeight: 700, color: C.textMuted, letterSpacing: ".08em", textTransform: "uppercase" }}>Outcome</div>
              {/* Duration — sortable */}
              <button onClick={() => toggleSort("duration")} style={{ display: "flex", alignItems: "center", gap: 3, fontFamily: "Sora,sans-serif", fontSize: ".61rem", fontWeight: 700, color: sortField === "duration" ? C.purple : C.textMuted, letterSpacing: ".08em", textTransform: "uppercase", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                Duration {sortField === "duration" ? (sortDir === "asc" ? <ArrowUp size={9} /> : <ArrowDown size={9} />) : <ArrowUpDown size={9} style={{ opacity: .4 }} />}
              </button>
              {/* Sentiment */}
              <div style={{ fontFamily: "Sora,sans-serif", fontSize: ".61rem", fontWeight: 700, color: C.textMuted, letterSpacing: ".08em", textTransform: "uppercase" }}>Sentiment</div>
              {/* Total — sortable */}
              <button onClick={() => toggleSort("revenue")} style={{ display: "flex", alignItems: "center", gap: 3, fontFamily: "Sora,sans-serif", fontSize: ".61rem", fontWeight: 700, color: sortField === "revenue" ? C.purple : C.textMuted, letterSpacing: ".08em", textTransform: "uppercase", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                Total {sortField === "revenue" ? (sortDir === "asc" ? <ArrowUp size={9} /> : <ArrowDown size={9} />) : <ArrowUpDown size={9} style={{ opacity: .4 }} />}
              </button>
              <div />
            </div>

            {/* Rows */}
            <div style={{ flex: 1, overflowY: "auto", background: C.card }}>
              {paged.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 14 }}>
                  <Phone size={32} style={{ color: "rgba(0,0,0,.1)" }} />
                  <p style={{ fontFamily: "Sora,sans-serif", fontSize: ".8rem", color: C.textGhost, margin: 0 }}>
                    No calls match your filters
                  </p>
                </div>
              ) : (
                paged.map((call) => {
                  const name = getDisplayName(call);
                  const { time, date } = formatTimestamp(call.start_timestamp);
                  const outcome = getOutcome(call);
                  const sentiment = getSentiment(call);
                  const revenue = getOrderRevenue(call);
                  const isSelected = selected?.id === call.id;

                  return (
                    <div
                      key={call.id}
                      className="co-row"
                      onClick={() => setSelected(call)}
                      style={{
                        display: "grid",
                        gridTemplateColumns: selected
                          ? "115px 1fr 120px 70px 100px 78px 28px"
                          : "145px 1fr 148px 88px 115px 98px 32px",
                        padding: "11px 20px",
                        borderBottom: `1px solid ${C.borderFaint}`,
                        borderLeft: isSelected
                          ? `2px solid ${C.purple}`
                          : "2px solid transparent",
                        background: isSelected ? C.purpleBg : "transparent",
                        cursor: "pointer",
                        alignItems: "center",
                      }}
                    >
                      {/* Timestamp */}
                      <div>
                        <p style={{ fontFamily: "Sora,sans-serif", fontSize: ".75rem", fontWeight: 700, color: C.text, margin: 0 }}>
                          {time}
                        </p>
                        <p style={{ fontFamily: "Sora,sans-serif", fontSize: ".62rem", color: C.textMuted, margin: "1px 0 0" }}>
                          {date}
                        </p>
                      </div>

                      {/* Caller */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <div
                          style={{
                            width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                            background: isSelected ? C.purpleBg : C.inputBg,
                            border: `1px solid ${isSelected ? C.purpleBdr : C.border}`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontFamily: "Sora,sans-serif", fontSize: ".68rem", fontWeight: 800,
                            color: isSelected ? C.purpleText : C.textMuted,
                          }}
                        >
                          {name[0]?.toUpperCase() ?? "?"}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{ fontFamily: "Sora,sans-serif", fontSize: ".75rem", fontWeight: 700, color: C.text, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {name !== "Unknown" ? name : (call.caller_phone ?? "Unknown")}
                          </p>
                          {name !== "Unknown" && call.caller_phone && (
                            <p style={{ fontFamily: "Sora,sans-serif", fontSize: ".62rem", color: C.textMuted, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {call.caller_phone}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Outcome badge */}
                      <div>
                        <span
                          style={{
                            fontFamily: "Sora,sans-serif", fontSize: ".64rem", fontWeight: 700,
                            padding: "3px 10px", borderRadius: 100, display: "inline-block",
                            background: outcome.bg, color: outcome.color, border: `1px solid ${outcome.border}`,
                          }}
                        >
                          {outcome.label}
                        </span>
                      </div>

                      {/* Duration */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Clock size={10} style={{ color: C.textGhost }} />
                        <span style={{ fontFamily: "Sora,sans-serif", fontSize: ".72rem", color: C.textSub }}>
                          {formatDuration(call.duration_ms)}
                        </span>
                      </div>

                      {/* Sentiment */}
                      <div>
                        {sentiment ? (
                          <span
                            style={{
                              fontFamily: "Sora,sans-serif", fontSize: ".63rem", fontWeight: 700,
                              padding: "3px 8px", borderRadius: 100, display: "inline-block",
                              background: sentiment.bg, color: sentiment.color,
                              border: `1px solid ${sentiment.border}`,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {sentiment.emoji} {sentiment.label}
                          </span>
                        ) : (
                          <span style={{ fontFamily: "Sora,sans-serif", fontSize: ".72rem", color: "rgba(0,0,0,.15)" }}>—</span>
                        )}
                      </div>

                      {/* Order total */}
                      <div>
                        {revenue !== null ? (
                          <span style={{ fontFamily: "Sora,sans-serif", fontSize: ".75rem", fontWeight: 700, color: C.green }}>
                            ${revenue.toFixed(2)}
                          </span>
                        ) : (
                          <span style={{ fontFamily: "Sora,sans-serif", fontSize: ".72rem", color: "rgba(0,0,0,.15)" }}>
                            —
                          </span>
                        )}
                      </div>

                      {/* Chevron */}
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <ChevronRight size={13} style={{ color: isSelected ? C.purple : "rgba(0,0,0,.15)" }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pagination */}
            <div
              style={{
                padding: "9px 20px",
                borderTop: `1px solid ${C.border}`,
                display: "flex", alignItems: "center", justifyContent: "space-between",
                flexShrink: 0, background: "#F4F4FA", gap: 10, flexWrap: "wrap",
              }}
            >
              {/* Left: range info + page size selector */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontFamily: "Sora,sans-serif", fontSize: ".67rem", color: C.textGhost, whiteSpace: "nowrap" }}>
                  {sorted.length === 0
                    ? "No calls"
                    : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, sorted.length)} of ${sorted.length} calls`}
                </span>
                <div style={{ position: "relative" }}>
                  <select
                    value={pageSize}
                    onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                    style={{
                      fontFamily: "Sora,sans-serif", fontSize: ".67rem", fontWeight: 700,
                      background: "#fff", border: `1px solid ${C.border}`,
                      borderRadius: 7, padding: "4px 22px 4px 8px",
                      color: C.textSub, cursor: "pointer",
                      appearance: "none", outline: "none",
                    }}
                  >
                    <option value={10}>10 / page</option>
                    <option value={25}>25 / page</option>
                    <option value={50}>50 / page</option>
                  </select>
                  <ChevronDown size={9} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", color: C.textMuted, pointerEvents: "none" }} />
                </div>
              </div>

              {/* Right: page navigation */}
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  style={{ fontFamily: "Sora,sans-serif", fontSize: ".67rem", fontWeight: 700, padding: "5px 9px", borderRadius: 8, border: `1px solid ${C.border}`, background: "#fff", color: page === 1 ? "rgba(0,0,0,.2)" : C.textSub, cursor: page === 1 ? "not-allowed" : "pointer" }}
                >«</button>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{ display: "flex", alignItems: "center", gap: 3, fontFamily: "Sora,sans-serif", fontSize: ".67rem", fontWeight: 700, padding: "5px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: "#fff", color: page === 1 ? "rgba(0,0,0,.2)" : C.textSub, cursor: page === 1 ? "not-allowed" : "pointer" }}
                ><ChevronLeft size={11} /> Prev</button>

                {/* Page number pills */}
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let p: number;
                  if (totalPages <= 5) p = i + 1;
                  else if (page <= 3) p = i + 1;
                  else if (page >= totalPages - 2) p = totalPages - 4 + i;
                  else p = page - 2 + i;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      style={{ fontFamily: "Sora,sans-serif", fontSize: ".67rem", fontWeight: 800, width: 30, height: 28, borderRadius: 8, border: `1px solid ${page === p ? C.purpleBdr : C.border}`, background: page === p ? C.purpleBg : "#fff", color: page === p ? C.purpleText : C.textSub, cursor: "pointer" }}
                    >{p}</button>
                  );
                })}

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{ display: "flex", alignItems: "center", gap: 3, fontFamily: "Sora,sans-serif", fontSize: ".67rem", fontWeight: 700, padding: "5px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: "#fff", color: page === totalPages ? "rgba(0,0,0,.2)" : C.textSub, cursor: page === totalPages ? "not-allowed" : "pointer" }}
                >Next <ChevronRight size={11} /></button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                  style={{ fontFamily: "Sora,sans-serif", fontSize: ".67rem", fontWeight: 700, padding: "5px 9px", borderRadius: 8, border: `1px solid ${C.border}`, background: "#fff", color: page === totalPages ? "rgba(0,0,0,.2)" : C.textSub, cursor: page === totalPages ? "not-allowed" : "pointer" }}
                >»</button>
              </div>
            </div>
          </div>

          {/* ── RIGHT: Detail Panel ── */}
          {selected && (
            <DetailPanel
              key={selected.id}
              call={selected}
              menuItems={menuItems}
              onClose={() => setSelected(null)}
              onOpenReviewModal={() => setReviewingCall(selected)}
              onSuccess={() => fetchCalls(true)}
            />
          )}
        </div>
      </div>

      {reviewingCall && (
        <ReviewOrderModal
          call={reviewingCall}
          menuItems={menuItems}
          onClose={() => setReviewingCall(null)}
          onSuccess={() => {
            setReviewingCall(null);
            fetchCalls(true);
          }}
        />
      )}
    </>
  );
}
