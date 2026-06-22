import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Trash2, Pencil, Loader2, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import {
  getOutboundCampaignsApi,
  createOutboundCampaignApi,
  deleteOutboundCampaignApi,
  updateOutboundCampaignApi,
} from "../../api/api";
import { C, StatusBadge } from "./outboundStyles";

export default function CampaignList() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      setCampaigns(await getOutboundCampaignsApi(0, 100, search));
    } catch {
      toast.error("Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const openCreate = () => {
    setForm({ name: "", description: "" });
    setModal("create");
  };

  const openEdit = (c) => {
    setForm({ name: c.name, description: c.description || "" });
    setModal(c.id);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      if (modal === "create") {
        await createOutboundCampaignApi(form);
        toast.success("Campaign created");
      } else {
        await updateOutboundCampaignApi(modal, form);
        toast.success("Campaign updated");
      }
      setModal(null);
      fetchCampaigns();
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!confirm("Delete this campaign?")) return;
    try {
      await deleteOutboundCampaignApi(id);
      toast.success("Campaign deleted");
      fetchCampaigns();
    } catch {
      toast.error("Delete failed");
    }
  };

  return (
    <div style={{ background: C.pageBg, minHeight: "100vh", padding: "24px 28px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button
          onClick={() => navigate("/dashboard/calling/outbound")}
          style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted }}
        >
          <ArrowLeft size={18} />
        </button>
        <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: C.text }}>
          Campaigns
        </h1>
        <div style={{ flex: 1 }} />
        <button
          onClick={openCreate}
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
          Create
        </button>
      </div>

      <div style={{ marginBottom: 16, position: "relative", maxWidth: 320 }}>
        <Search
          size={14}
          style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.textMuted }}
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search campaigns..."
          style={{
            width: "100%",
            padding: "9px 12px 9px 34px",
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            fontSize: ".82rem",
            boxSizing: "border-box",
          }}
        />
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
        ) : campaigns.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: C.textMuted }}>
            No campaigns yet
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".82rem" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}`, background: "#FAFBFD" }}>
                {["Name", "Status", "Created", "Actions"].map((h) => (
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
              {campaigns.map((c) => (
                <tr
                  key={c.id}
                  style={{ borderBottom: `1px solid ${C.border}`, cursor: "pointer" }}
                  onClick={() => navigate(`/dashboard/calling/outbound/campaigns/${c.id}`)}
                >
                  <td style={{ padding: "12px 16px", fontWeight: 600, color: C.text }}>
                    {c.name}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <StatusBadge status={c.status} />
                  </td>
                  <td style={{ padding: "12px 16px", color: C.textMuted }}>
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td
                    style={{ padding: "12px 16px" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => openEdit(c)}
                      style={{ background: "none", border: "none", cursor: "pointer", marginRight: 8, color: C.purple }}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => remove(c.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: C.red }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
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
          onClick={() => setModal(null)}
        >
          <div
            style={{
              background: C.card,
              borderRadius: 14,
              padding: 24,
              width: 400,
              maxWidth: "90vw",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 16px", fontWeight: 800 }}>
              {modal === "create" ? "New Campaign" : "Edit Campaign"}
            </h3>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Campaign name"
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 10,
                border: `1px solid ${C.border}`,
                marginBottom: 10,
                boxSizing: "border-box",
              }}
            />
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Description"
              rows={3}
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 10,
                border: `1px solid ${C.border}`,
                marginBottom: 16,
                boxSizing: "border-box",
                resize: "vertical",
              }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setModal(null)} style={{ padding: "8px 16px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.card, cursor: "pointer" }}>
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                style={{
                  padding: "8px 16px",
                  borderRadius: 10,
                  border: "none",
                  background: C.purple,
                  color: "#fff",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
