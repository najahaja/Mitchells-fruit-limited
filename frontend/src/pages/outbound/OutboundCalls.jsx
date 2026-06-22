import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Eye } from "lucide-react";
import toast from "react-hot-toast";
import { getOutboundCallsApi } from "../../api/api";
import { C, StatusBadge, formatDuration } from "./outboundStyles";

export default function OutboundCalls() {
  const navigate = useNavigate();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchCalls = useCallback(async () => {
    setLoading(true);
    try {
      setCalls(await getOutboundCallsApi(0, 200));
    } catch {
      toast.error("Failed to load calls");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCalls();
    const interval = setInterval(fetchCalls, 15000);
    return () => clearInterval(interval);
  }, [fetchCalls]);

  return (
    <div style={{ background: C.pageBg, minHeight: "100vh", padding: "24px 28px" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button
          onClick={() => navigate("/dashboard/calling/outbound")}
          style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted }}
        >
          <ArrowLeft size={18} />
        </button>
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
        {loading ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".82rem" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}`, background: "#FAFBFD" }}>
                {["Contact", "Phone", "Campaign", "Status", "Duration", "Date", "Actions"].map((h) => (
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
              {calls.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 32, textAlign: "center", color: C.textMuted }}>
                    No calls yet
                  </td>
                </tr>
              ) : (
                calls.map((call) => (
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
                    <td style={{ padding: "12px 16px", color: C.textMuted }}>
                      {new Date(call.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <button
                        onClick={() => navigate(`/dashboard/calling/outbound/calls/${call.id}`)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          background: C.purpleBg,
                          color: C.purple,
                          border: "none",
                          borderRadius: 8,
                          padding: "5px 10px",
                          cursor: "pointer",
                          fontWeight: 600,
                          fontSize: ".75rem",
                        }}
                      >
                        <Eye size={12} />
                        Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
