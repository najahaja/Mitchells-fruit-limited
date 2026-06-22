import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Upload,
  Play,
  Loader2,
  RefreshCw,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  getOutboundCampaignApi,
  getOutboundCampaignStatsApi,
  getOutboundContactsApi,
  addOutboundContactApi,
  deleteOutboundContactApi,
  importOutboundContactsApi,
  startOutboundCampaignApi,
} from "../../api/api";
import { C, StatusBadge } from "./outboundStyles";

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [campaign, setCampaign] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone_number: "",
    email: "",
    company: "",
  });

  const fetchAll = useCallback(async () => {
    try {
      const [c, ct, st] = await Promise.all([
        getOutboundCampaignApi(id),
        getOutboundContactsApi(id),
        getOutboundCampaignStatsApi(id),
      ]);
      setCampaign(c);
      setContacts(ct);
      setStats(st);
    } catch {
      toast.error("Failed to load campaign");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 10000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const addContact = async () => {
    if (!form.phone_number.trim()) {
      toast.error("Phone number is required");
      return;
    }
    try {
      await addOutboundContactApi(id, form);
      toast.success("Contact added");
      setShowAdd(false);
      setForm({ name: "", phone_number: "", email: "", company: "" });
      fetchAll();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to add contact");
    }
  };

  const removeContact = async (contactId) => {
    if (!confirm("Delete contact?")) return;
    try {
      await deleteOutboundContactApi(contactId);
      toast.success("Contact deleted");
      fetchAll();
    } catch {
      toast.error("Delete failed");
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await importOutboundContactsApi(id, file);
      toast.success(`Imported ${result.imported} contacts`);
      fetchAll();
    } catch {
      toast.error("Import failed");
    }
    e.target.value = "";
  };

  const startCampaign = async () => {
    setStarting(true);
    try {
      const result = await startOutboundCampaignApi(id);
      toast.success(`Started calling ${result.queued_contacts} contacts`);
      fetchAll();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to start campaign");
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: "center" }}>
        <Loader2 size={28} style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (!campaign) {
    return <div style={{ padding: 40 }}>Campaign not found</div>;
  }

  return (
    <div style={{ background: C.pageBg, minHeight: "100vh", padding: "24px 28px" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button
          onClick={() => navigate("/dashboard/calling/outbound/campaigns")}
          style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: C.text }}>
            {campaign.name}
          </h1>
          <p style={{ margin: "2px 0 0", fontSize: ".82rem", color: C.textMuted }}>
            {campaign.description || "No description"}
          </p>
        </div>
        <StatusBadge status={campaign.status} />
        <button
          onClick={fetchAll}
          style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 8, cursor: "pointer" }}
        >
          <RefreshCw size={14} />
        </button>
        <button
          onClick={startCampaign}
          disabled={starting || campaign.status === "completed"}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: C.green,
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "8px 16px",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: ".8rem",
            opacity: starting ? 0.7 : 1,
          }}
        >
          <Play size={14} />
          {starting ? "Starting..." : "Start Calling"}
        </button>
      </div>

      {stats && (
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          {[
            { label: "Total", value: stats.total },
            { label: "Pending", value: stats.pending },
            { label: "Completed", value: stats.completed },
            { label: "Failed", value: stats.failed },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: C.card,
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                padding: "12px 18px",
                minWidth: 100,
              }}
            >
              <div style={{ fontSize: "1.2rem", fontWeight: 800, color: C.text }}>{s.value}</div>
              <div style={{ fontSize: ".72rem", color: C.textMuted, fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setShowAdd(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: C.purple,
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "8px 14px",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: ".8rem",
          }}
        >
          <Plus size={14} />
          Add Contact
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: "8px 14px",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: ".8rem",
          }}
        >
          <Upload size={14} />
          CSV / JSON Upload
        </button>
        <input ref={fileRef} type="file" accept=".csv,.json" hidden onChange={handleFile} />
      </div>

      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".82rem" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}`, background: "#FAFBFD" }}>
              {["Name", "Phone", "Email", "Company", "Status", "Actions"].map((h) => (
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
            {contacts.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 32, textAlign: "center", color: C.textMuted }}>
                  No contacts yet
                </td>
              </tr>
            ) : (
              contacts.map((ct) => (
                <tr key={ct.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "12px 16px", fontWeight: 600 }}>{ct.name || "—"}</td>
                  <td style={{ padding: "12px 16px" }}>{ct.phone_number}</td>
                  <td style={{ padding: "12px 16px", color: C.textMuted }}>{ct.email || "—"}</td>
                  <td style={{ padding: "12px 16px", color: C.textMuted }}>{ct.company || "—"}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <StatusBadge status={ct.status} />
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <button
                      onClick={() => removeContact(ct.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: C.red }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,15,26,.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
          onClick={() => setShowAdd(false)}
        >
          <div
            style={{ background: C.card, borderRadius: 14, padding: 24, width: 400, maxWidth: "90vw" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 16px", fontWeight: 800 }}>Add Contact</h3>
            {["name", "phone_number", "email", "company"].map((field) => (
              <input
                key={field}
                value={form[field]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                placeholder={field.replace("_", " ")}
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 10,
                  border: `1px solid ${C.border}`,
                  marginBottom: 10,
                  boxSizing: "border-box",
                }}
              />
            ))}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowAdd(false)} style={{ padding: "8px 16px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.card, cursor: "pointer" }}>
                Cancel
              </button>
              <button
                onClick={addContact}
                style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: C.purple, color: "#fff", fontWeight: 700, cursor: "pointer" }}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
