import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Eye, Timer } from "lucide-react";
import toast from "react-hot-toast";
import { getOutboundCallsApi } from "../../api/api";
import { C, StatusBadge, Btn, formatDuration, spinStyle } from "./outboundStyles";

function useCountdown(recallAt) {
  const [secsLeft, setSecsLeft] = useState(() =>
    recallAt ? Math.floor((new Date(recallAt) - Date.now()) / 1000) : null
  );
  useEffect(() => {
    if (!recallAt) { setSecsLeft(null); return; }
    const tick = () => setSecsLeft(Math.floor((new Date(recallAt) - Date.now()) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [recallAt]);
  return secsLeft;
}
function fmtCd(secs) {
  const abs = Math.abs(secs);
  const d = Math.floor(abs / 86400), h = Math.floor((abs % 86400) / 3600),
        m = Math.floor((abs % 3600) / 60), s = abs % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
function CallCountdown({ recallAt }) {
  const secs = useCountdown(recallAt);
  if (secs === null) return <span style={{ color: "#ccc" }}>—</span>;
  const overdue = secs <= 0, urgent = !overdue && secs < 3600;
  const color = overdue ? "#DC2626" : urgent ? "#D97706" : "#16A34A";
  const bg    = overdue ? "#FEF2F2" : urgent ? "#FFFBEB" : "#F0FDF4";
  const bdr   = overdue ? "#FECACA" : urgent ? "#FDE68A" : "#BBF7D0";
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:3, fontSize:".72rem", fontWeight:700,
      padding:"3px 9px", borderRadius:100, background:bg, color, border:`1px solid ${bdr}`, whiteSpace:"nowrap" }}>
      <Timer size={10}/>{overdue ? `⚠ ${fmtCd(secs)} ago` : fmtCd(secs)}
    </span>
  );
}

export default function OutboundCalls() {
  const navigate = useNavigate();
  const [calls, setCalls] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const fetchLock = useRef(false);

  const fetchCalls = useCallback(async (silent = false) => {
    if (fetchLock.current) return;
    fetchLock.current = true;
    try {
      setCalls(await getOutboundCallsApi(0, 100));
    } catch {
      if (!silent) toast.error("Failed to load calls");
    } finally {
      fetchLock.current = false;
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCalls(false);
    const interval = setInterval(() => fetchCalls(true), 30000);
    return () => clearInterval(interval);
  }, [fetchCalls]);

  return (
    <div style={{ background: C.pageBg, minHeight: "100vh", padding: "24px 28px" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <Btn variant="ghost" onClick={() => navigate("/dashboard/calling/outbound")}>
          <ArrowLeft size={18} />
        </Btn>
        <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: C.text }}>
          Outbound Calls
        </h1>
      </div>

      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        {initialLoading ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <Loader2 size={24} style={spinStyle} />
          </div>
        ) : calls.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: C.textMuted }}>
            No calls yet
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".82rem" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}`, background: "#FAFBFD" }}>
                {["Contact", "Phone", "Campaign", "Status", "Duration", "Callback", "Date", "Actions"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "12px 16px",
                      fontWeight: 700,
                      color: C.textMuted,
                      fontSize: ".72rem",
                      textTransform: "uppercase",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calls.map((call) => (
                <tr key={call.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "12px 16px", fontWeight: 600 }}>
                    {call.contact_name || "—"}
                  </td>
                  <td style={{ padding: "12px 16px" }}>{call.phone_number}</td>
                  <td style={{ padding: "12px 16px", color: C.textMuted }}>
                    {call.campaign_name || "—"}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <StatusBadge status={call.call_status} />
                  </td>
                  <td style={{ padding: "12px 16px" }}>{formatDuration(call.duration)}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <CallCountdown recallAt={call.recall_at} />
                  </td>
                  <td style={{ padding: "12px 16px", color: C.textMuted }}>
                    {new Date(call.created_at).toLocaleString()}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <Btn
                      variant="link"
                      onClick={() => navigate(`/dashboard/calling/outbound/calls/${call.id}`)}
                    >
                      <Eye size={12} />
                      Details
                    </Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
