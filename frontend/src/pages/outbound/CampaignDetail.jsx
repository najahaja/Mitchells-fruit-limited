import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Upload,
  Phone,
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
  startOutboundCallApi,
} from "../../api/api";
import { C, StatusBadge, Btn, spinStyle } from "./outboundStyles";

const CSV_IMPORT_FIELDS = [
  {
    column: "phone_number",
    required: true,
    aliases: "phone",
    example: "03475574848",
    note: "Required. E.164 or local PK format (auto-normalized to +92…)",
  },
  {
    column: "owner_name",
    required: false,
    aliases: "name",
    example: "Ali Khan",
    note: "Contact / owner name spoken by the agent",
  },
  {
    column: "shop_name",
    required: false,
    aliases: "company",
    example: "Fresh Mart",
    note: "Business or shop name",
  },
  {
    column: "email",
    required: false,
    aliases: null,
    example: "ali@example.com",
    note: "Optional email",
  },
  {
    column: "customer_city",
    required: false,
    aliases: "city",
    example: "Lahore",
    note: "City passed to the agent as dynamic variable",
  },
  {
    column: "last_order",
    required: false,
    aliases: null,
    example: "2x Mango Jam",
    note: "Previous order summary for returning customers",
  },
  {
    column: "customer_type",
    required: false,
    aliases: null,
    example: "existing",
    note: "new or existing",
  },
];

const CSV_SAMPLE = [
  "phone_number,owner_name,shop_name,email,customer_city,last_order,customer_type",
  "03475574848,Ali Khan,Fresh Mart,ali@example.com,Lahore,2x Mango Jam,existing",
  "03001234567,Sara Ali,City Store,,Karachi,,new",
].join("\n");

function downloadSampleCsv() {
  const blob = new Blob([CSV_SAMPLE], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "outbound-contacts-sample.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const fetchLock = useRef(false);
  const [campaign, setCampaign] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [stats, setStats] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [callingId, setCallingId] = useState(null);
  const [quickPhone, setQuickPhone] = useState("");
  const [importing, setImporting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone_number: "",
    email: "",
    company: "",
  });

  const fetchAll = useCallback(async (silent = false) => {
    if (fetchLock.current) return;
    fetchLock.current = true;
    if (!silent) setRefreshing(true);
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
      if (!silent) toast.error("Failed to load campaign");
    } finally {
      fetchLock.current = false;
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAll(false);
  }, [fetchAll]);

  useEffect(() => {
    if (showAdd || savingContact || callingId) return undefined;
    const interval = setInterval(() => fetchAll(true), 20000);
    return () => clearInterval(interval);
  }, [fetchAll, showAdd, savingContact, callingId]);

  const apiError = (err, fallback) => {
    const detail = err?.response?.data?.detail ?? err;
    if (typeof detail === "string") return detail;
    if (detail?.message) return detail.message;
    return fallback;
  };

  const callContact = async (contactId) => {
    if (callingId) return;
    setCallingId(contactId);
    try {
      const call = await startOutboundCallApi({ contact_id: contactId });
      toast.success(`Calling ${call.phone_number}`);
      await fetchAll(true);
    } catch (err) {
      toast.error(apiError(err, "Failed to start call"));
    } finally {
      setCallingId(null);
    }
  };

  const quickCall = async (e) => {
    e.preventDefault();
    if (callingId) return;
    if (!quickPhone.trim()) {
      toast.error("Enter a phone number");
      return;
    }
    setCallingId("quick");
    try {
      const call = await startOutboundCallApi({
        campaign_id: id,
        phone_number: quickPhone.trim(),
      });
      toast.success(`Calling ${call.phone_number}`);
      setQuickPhone("");
      await fetchAll(true);
    } catch (err) {
      toast.error(apiError(err, "Failed to start call"));
    } finally {
      setCallingId(null);
    }
  };

  const addContact = async (e) => {
    e.preventDefault();
    if (savingContact) return;
    if (!form.phone_number.trim()) {
      toast.error("Phone number is required");
      return;
    }
    setSavingContact(true);
    try {
      await addOutboundContactApi(id, form);
      toast.success("Contact added");
      setShowAdd(false);
      setForm({ name: "", phone_number: "", email: "", company: "" });
      await fetchAll(true);
    } catch (err) {
      toast.error(apiError(err, "Failed to add contact"));
    } finally {
      setSavingContact(false);
    }
  };

  const removeContact = async (contactId) => {
    if (deletingId) return;
    if (!window.confirm("Delete contact?")) return;
    setDeletingId(contactId);
    try {
      await deleteOutboundContactApi(contactId);
      toast.success("Contact deleted");
      await fetchAll(true);
    } catch {
      toast.error("Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || importing) return;
    setImporting(true);
    try {
      const result = await importOutboundContactsApi(id, file);
      toast.success(`Imported ${result.imported} contacts`);
      await fetchAll(true);
    } catch {
      toast.error("Import failed");
    } finally {
      setImporting(false);
    }
  };

  if (initialLoading) {
    return (
      <div style={{ padding: 60, textAlign: "center" }}>
        <Loader2 size={28} style={spinStyle} />
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
        <Btn variant="ghost" onClick={() => navigate("/dashboard/calling/outbound/campaigns")}>
          <ArrowLeft size={18} />
        </Btn>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: C.text }}>
            {campaign.name}
          </h1>
          <p style={{ margin: "2px 0 0", fontSize: ".82rem", color: C.textMuted }}>
            {campaign.description || "No description"}
          </p>
        </div>
        <StatusBadge status={campaign.status} />
        <Btn variant="secondary" loading={refreshing} onClick={() => fetchAll(false)} style={{ padding: 8 }}>
          <RefreshCw size={14} />
        </Btn>
      </div>

      <form
        onSubmit={quickCall}
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 20,
          flexWrap: "wrap",
          alignItems: "center",
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          padding: "14px 16px",
        }}
      >
        <Phone size={18} style={{ color: C.purple, flexShrink: 0 }} />
        <input
          value={quickPhone}
          onChange={(e) => setQuickPhone(e.target.value)}
          placeholder="Phone number to call now (e.g. 03475574848)"
          disabled={!!callingId}
          style={{
            flex: 1,
            minWidth: 200,
            padding: "10px 12px",
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            fontSize: ".85rem",
          }}
        />
        <Btn
          type="submit"
          variant="primary"
          loading={callingId === "quick"}
          disabled={!!callingId && callingId !== "quick"}
        >
          <Phone size={14} />
          {callingId === "quick" ? "Calling…" : "Call Now"}
        </Btn>
      </form>

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

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <Btn variant="primary" onClick={() => setShowAdd(true)}>
          <Plus size={14} />
          Add Contact
        </Btn>
        <Btn variant="secondary" loading={importing} onClick={() => fileRef.current?.click()}>
          <Upload size={14} />
          {importing ? "Importing…" : "CSV / JSON Upload"}
        </Btn>
        <Btn variant="secondary" onClick={downloadSampleCsv}>
          Download sample CSV
        </Btn>
        <input ref={fileRef} type="file" accept=".csv,.json" hidden onChange={handleFile} />
      </div>

      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          padding: "16px 18px",
          marginBottom: 16,
        }}
      >
        <p
          style={{
            margin: "0 0 10px",
            fontSize: ".82rem",
            fontWeight: 800,
            color: C.text,
          }}
        >
          CSV / JSON import format
        </p>
        <p style={{ margin: "0 0 12px", fontSize: ".75rem", color: C.textMuted, lineHeight: 1.5 }}>
          First row must be column headers. Only{" "}
          <strong style={{ color: C.text }}>phone_number</strong> is required; all other
          columns are optional but improve personalization on outbound calls.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: ".75rem",
            }}
          >
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {["Column", "Required", "Also accepts", "Example", "Notes"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "8px 10px",
                      fontWeight: 700,
                      color: C.textMuted,
                      fontSize: ".68rem",
                      textTransform: "uppercase",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CSV_IMPORT_FIELDS.map((f) => (
                <tr key={f.column} style={{ borderBottom: `1px solid ${C.borderFaint}` }}>
                  <td style={{ padding: "8px 10px", fontFamily: "monospace", fontWeight: 700 }}>
                    {f.column}
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    {f.required ? (
                      <span style={{ color: C.red, fontWeight: 700 }}>Yes</span>
                    ) : (
                      <span style={{ color: C.textMuted }}>No</span>
                    )}
                  </td>
                  <td
                    style={{
                      padding: "8px 10px",
                      fontFamily: "monospace",
                      color: C.textMuted,
                    }}
                  >
                    {f.aliases || "—"}
                  </td>
                  <td
                    style={{
                      padding: "8px 10px",
                      fontFamily: "monospace",
                      color: C.textSub,
                    }}
                  >
                    {f.example}
                  </td>
                  <td style={{ padding: "8px 10px", color: C.textMuted }}>{f.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p
          style={{
            margin: "12px 0 0",
            fontSize: ".72rem",
            color: C.textMuted,
            fontFamily: "monospace",
            background: "#FAFBFD",
            padding: "10px 12px",
            borderRadius: 8,
            border: `1px solid ${C.borderFaint}`,
            overflowX: "auto",
          }}
        >
          {CSV_SAMPLE.split("\n")[0]}
        </p>
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
                    <div style={{ display: "flex", gap: 6 }}>
                      <Btn
                        variant="primary"
                        loading={callingId === ct.id}
                        disabled={
                          ct.status === "calling" ||
                          (!!callingId && callingId !== ct.id)
                        }
                        onClick={() => callContact(ct.id)}
                        style={{ padding: "6px 10px" }}
                      >
                        <Phone size={14} />
                      </Btn>
                      <Btn
                        variant="danger"
                        loading={deletingId === ct.id}
                        disabled={!!deletingId || !!callingId}
                        onClick={() => removeContact(ct.id)}
                      >
                        <Trash2 size={14} />
                      </Btn>
                    </div>
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
            zIndex: 1000,
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowAdd(false);
          }}
        >
          <div
            style={{ background: C.card, borderRadius: 14, padding: 24, width: 400, maxWidth: "90vw" }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 16px", fontWeight: 800 }}>Add Contact</h3>
            <form onSubmit={addContact}>
              {["name", "phone_number", "email", "company"].map((field) => (
                <input
                  key={field}
                  value={form[field]}
                  onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                  placeholder={field.replace("_", " ")}
                  disabled={savingContact}
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
                <Btn
                  variant="secondary"
                  disabled={savingContact}
                  onClick={() => setShowAdd(false)}
                >
                  Cancel
                </Btn>
                <Btn type="submit" variant="primary" loading={savingContact}>
                  {savingContact ? "Adding…" : "Add"}
                </Btn>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
