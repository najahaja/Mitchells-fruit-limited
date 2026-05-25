import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { loginApi } from "../api/api";
import { Eye, EyeOff } from "lucide-react";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { VaxisLogo } from "../components/VaxisLogo";

const STATS = [
  { num: "$0",  label: "missed order revenue" },
  { num: "99%", label: "order accuracy" },
  { num: "∞",   label: "simultaneous calls" },
];

const CHIPS = [
  { text: "SMS sent to James W.", dot: "#1DB87A", delay: "0s",    dur: "3.6s" },
  { text: "Call answered instantly", dot: "#7F77DD", delay: "-1.4s", dur: "4.1s" },
  { text: "+$47 recovered",        dot: "#C8973A", delay: "-2.8s", dur: "3.8s" },
];

const TESTIMONIAL = {
  quote: "We stopped missing weekend sales calls the week we turned Mitchell's AI on. It paid for itself in two shifts.",
  name: "Maria S.",
  role: "Sales Director, Mitchell's",
};

export default function SignIn() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const { isMobile, isTablet } = useBreakpoint();

  useEffect(() => { setMounted(true); }, []);

  const handleContinue = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await loginApi({ email, password });
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("refreshToken", data.refresh_token);
      localStorage.setItem("role", "admin");
      localStorage.setItem("email", email);
      toast.success("Welcome back!");
      navigate("/dashboard");
    } catch (err: unknown) {
      toast.error(typeof err === "string" ? err : "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (field: string): React.CSSProperties => ({
    width: "100%",
    padding: "12px 16px",
    borderRadius: "10px",
    border: `1.5px solid ${focusedField === field ? "#7F77DD" : "#EAEAF2"}`,
    outline: "none",
    fontFamily: "Sora, sans-serif",
    fontSize: ".9rem",
    color: "#0F0F1A",
    background: focusedField === field ? "#FDFCFF" : "#F8F8FC",
    boxShadow: focusedField === field ? "0 0 0 3px rgba(127,119,221,.12)" : "none",
    transition: "border-color .2s, box-shadow .2s, background .2s",
    boxSizing: "border-box" as const,
    opacity: loading ? 0.6 : 1,
  });

  return (
    <>
      <style>{`
        /* ── keyframes ── */
        @keyframes fadeUp   { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:none} }
        @keyframes fadeIn   { from{opacity:0} to{opacity:1} }
        @keyframes chipfloat{ 0%,100%{transform:translateY(0)} 50%{transform:translateY(-9px)} }
        @keyframes ldot     { 0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(29,184,122,.5)} 50%{opacity:.7;box-shadow:0 0 0 6px rgba(29,184,122,0)} }
        @keyframes slideRight{ from{opacity:0;transform:translateX(-32px)} to{opacity:1;transform:none} }
        @keyframes slideLeft { from{opacity:0;transform:translateX(32px)}  to{opacity:1;transform:none} }
        @keyframes orb      { 0%,100%{transform:scale(1) translateY(0)} 50%{transform:scale(1.06) translateY(-18px)} }
        @keyframes spin     { to{transform:rotate(360deg)} }
        @keyframes statPop  { 0%{transform:scale(.7);opacity:0} 70%{transform:scale(1.06)} 100%{transform:scale(1);opacity:1} }
        @keyframes barGrow  { from{width:0} to{width:var(--w)} }

        /* ── layout ── */
        .vx-split { display:flex;min-height:100vh;font-family:'Sora',sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale; }

        /* ── LEFT PANEL ── */
        .vx-panel-left {
          flex:1;position:relative;overflow:hidden;
          background:linear-gradient(145deg,#0F0F1A 0%,#1A1830 60%,#0e1520 100%);
          display:flex;flex-direction:column;justify-content:center;padding:64px 56px;
        }
        .vx-pl-orb1 {
          position:absolute;top:-120px;right:-120px;width:480px;height:480px;
          background:radial-gradient(circle,rgba(127,119,221,.22) 0%,transparent 70%);
          border-radius:50%;animation:orb 8s ease-in-out infinite;pointer-events:none;
        }
        .vx-pl-orb2 {
          position:absolute;bottom:-100px;left:-80px;width:380px;height:380px;
          background:radial-gradient(circle,rgba(29,184,122,.14) 0%,transparent 70%);
          border-radius:50%;animation:orb 11s ease-in-out infinite reverse;pointer-events:none;
        }
        .vx-pl-content { position:relative;z-index:1; }

        /* ── stat bar ── */
        .vx-stat-row { display:flex;gap:32px;margin:36px 0; }
        .vx-stat-num {
          font-size:2.4rem;font-weight:800;letter-spacing:-.04em;
          background:linear-gradient(135deg,#fff 30%,#A9A4F0 100%);
          -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
          line-height:1;
        }
        .vx-stat-label { font-size:.72rem;color:rgba(255,255,255,.4);font-weight:500;margin-top:3px;line-height:1.3; }

        /* ── chip ── */
        .vx-lp-chip {
          display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.06);
          border:1px solid rgba(255,255,255,.1);backdrop-filter:blur(12px);
          border-radius:100px;padding:9px 16px;font-size:.82rem;font-weight:600;
          color:rgba(255,255,255,.88);white-space:nowrap;
        }

        /* ── testimonial ── */
        .vx-testimonial {
          margin-top:40px;padding:22px 24px;
          background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);
          border-radius:16px;backdrop-filter:blur(16px);
        }

        /* ── RIGHT PANEL ── */
        .vx-panel-right {
          width:480px;flex-shrink:0;background:#fff;display:flex;flex-direction:column;
          justify-content:center;align-items:center;padding:48px 56px;
          border-left:1px solid #EAEAF2;
        }
        .vx-login-card { width:100%;max-width:380px; }

        /* ── form elements ── */
        .vx-login-submit {
          width:100%;padding:13px;border-radius:10px;border:none;
          background:linear-gradient(135deg,#534AB7 0%,#7F77DD 100%);
          color:#fff;font-family:'Sora',sans-serif;font-size:.95rem;font-weight:700;
          cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;
          box-shadow:0 4px 18px rgba(83,74,183,.28);
          transition:filter .2s,transform .2s,box-shadow .2s;
        }
        .vx-login-submit:hover:not(:disabled){ filter:brightness(1.09);transform:translateY(-1px);box-shadow:0 8px 28px rgba(83,74,183,.4); }
        .vx-login-submit:disabled { opacity:.65;cursor:not-allowed; }

        .vx-spin { animation:spin .8s linear infinite; }

        /* ── responsive ── */
        @media(max-width:1023px){
          .vx-panel-left { display:none; }
          .vx-panel-right { width:100%;border-left:none;background:#fff;padding:48px 40px; }
          .vx-login-card { max-width:440px; }
        }
        @media(max-width:639px){
          .vx-panel-right { padding:32px 20px;background:#F8F8FC; }
          .vx-login-card { max-width:100%; }
          .vx-stat-row { gap:20px; flex-wrap:wrap; margin:24px 0; }
          .vx-stat-num { font-size:1.8rem; }
        }
      `}</style>

      <div className="vx-split">

        {/* ════ LEFT PANEL ════ */}
        <div className="vx-panel-left">
          <div className="vx-pl-orb1" />
          <div className="vx-pl-orb2" />

          <div className="vx-pl-content">

            {/* Logo */}
            <div
              style={{
                display: "flex", alignItems: "center", gap: "10px", cursor: "pointer",
                marginBottom: "44px",
                opacity: mounted ? 1 : 0,
                animation: mounted ? "fadeUp .6s ease both" : "none",
              }}
            >
              <VaxisLogo height={32} color="#ffffff" />
              <span style={{
                fontSize: "1.38rem", fontWeight: 800, letterSpacing: "-.03em",
                background: "linear-gradient(135deg,#fff 30%,#A9A4F0 100%)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>Mitchell's</span>
            </div>

            {/* Headline */}
            <div style={{
              opacity: mounted ? 1 : 0,
              animation: mounted ? "fadeUp .65s .1s ease both" : "none",
            }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: "7px",
                background: "rgba(29,184,122,.12)", border: "1px solid rgba(29,184,122,.25)",
                borderRadius: "100px", padding: "5px 14px", marginBottom: "18px",
              }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#1DB87A", display: "inline-block", animation: "ldot 1.6s ease-in-out infinite" }} />
                <span style={{ fontSize: ".72rem", fontWeight: 700, letterSpacing: ".08em", color: "#1DB87A", textTransform: "uppercase" as const }}>Live — answering calls now</span>
              </div>
              <h2 style={{
                margin: 0, fontSize: "clamp(1.8rem,2.8vw,2.5rem)", fontWeight: 800,
                color: "#fff", lineHeight: 1.15, letterSpacing: "-.03em",
              }}>
                Your phone is costing<br />
                <span style={{
                  background: "linear-gradient(135deg,#A9A4F0,#7F77DD)",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                }}>you real money.</span>
              </h2>
              <p style={{ marginTop: "14px", fontSize: ".95rem", color: "rgba(255,255,255,.48)", lineHeight: 1.65, maxWidth: "400px" }}>
                Every missed call is a missed sale. Mitchell's AI answers every call, captures every order, and pays for itself in the first weekend.
              </p>
            </div>

            {/* Stats */}
            <div className="vx-stat-row" style={{
              opacity: mounted ? 1 : 0,
              animation: mounted ? "fadeUp .65s .22s ease both" : "none",
            }}>
              {STATS.map((s) => (
                <div key={s.num}>
                  <div className="vx-stat-num">{s.num}</div>
                  <div className="vx-stat-label">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Live chips */}
            <div style={{
              display: "flex", flexWrap: "wrap" as const, gap: "10px",
              opacity: mounted ? 1 : 0,
              animation: mounted ? "fadeUp .65s .34s ease both" : "none",
            }}>
              {CHIPS.map((c) => (
                <div
                  key={c.text}
                  className="vx-lp-chip"
                  style={{ animation: `chipfloat ${c.dur} ease-in-out infinite`, animationDelay: c.delay }}
                >
                  <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
                  {c.text}
                </div>
              ))}
            </div>

            {/* Testimonial */}
            <div className="vx-testimonial" style={{
              opacity: mounted ? 1 : 0,
              animation: mounted ? "fadeUp .65s .46s ease both" : "none",
            }}>
              <p style={{ margin: 0, fontSize: ".95rem", fontStyle: "italic", fontFamily: "'Lora',Georgia,serif", color: "rgba(255,255,255,.75)", lineHeight: 1.65 }}>
                "{TESTIMONIAL.quote}"
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "14px" }}>
                <div style={{
                  width: "34px", height: "34px", borderRadius: "50%", flexShrink: 0,
                  background: "linear-gradient(135deg,#7F77DD,#534AB7)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: ".8rem", fontWeight: 700, color: "#fff",
                }}>
                  {TESTIMONIAL.name[0]}
                </div>
                <div>
                  <div style={{ fontSize: ".85rem", fontWeight: 700, color: "rgba(255,255,255,.9)" }}>{TESTIMONIAL.name}</div>
                  <div style={{ fontSize: ".75rem", color: "rgba(255,255,255,.4)" }}>{TESTIMONIAL.role}</div>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", gap: "2px" }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg key={i} width="11" height="11" fill="#C8973A" viewBox="0 0 24 24">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ════ RIGHT PANEL ════ */}
        <div className="vx-panel-right">
          <div
            className="vx-login-card"
            style={{
              opacity: mounted ? 1 : 0,
              animation: mounted ? "slideLeft .6s .1s ease both" : "none",
            }}
          >
            {/* Logo — shown only when left panel is hidden */}
            {(isMobile || isTablet) && (
              <div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "32px" }}>
                <VaxisLogo height={26} color="#0F0F1A" />
                <span style={{ fontSize: "1.28rem", fontWeight: 800, letterSpacing: "-.03em", background: "linear-gradient(135deg,#0F0F1A 30%,#534AB7 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Mitchell's</span>
              </div>
            )}

            {/* Header */}
            <div style={{ marginBottom: "32px" }}>
              <h1 style={{ margin: 0, fontSize: "1.45rem", fontWeight: 800, color: "#0F0F1A", letterSpacing: "-.03em" }}>
                Sign in
              </h1>
              <p style={{ margin: "6px 0 0", fontSize: ".88rem", color: "#8888A8" }}>
                Welcome back — your sales portal awaits.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleContinue} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

              {/* Email */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: ".82rem", fontWeight: 600, color: "#525270" }}>Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@mitchells.com"
                  required
                  disabled={loading}
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField(null)}
                  style={inputStyle("email")}
                />
              </div>

              {/* Password */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={{ fontSize: ".82rem", fontWeight: 600, color: "#525270" }}>Password</label>
                  <Link to="/forgot-password" style={{ fontSize: ".8rem", fontWeight: 600, color: "#534AB7", textDecoration: "none" }}>
                    Forgot password?
                  </Link>
                </div>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    disabled={loading}
                    onFocus={() => setFocusedField("password")}
                    onBlur={() => setFocusedField(null)}
                    style={{ ...inputStyle("password"), paddingRight: "44px" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    style={{
                      position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer", color: "#8888A8",
                      display: "flex", alignItems: "center", padding: 0, transition: "color .15s",
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.color = "#534AB7")}
                    onMouseOut={(e) => (e.currentTarget.style.color = "#8888A8")}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button type="submit" disabled={loading} className="vx-login-submit" style={{ marginTop: "4px" }}>
                {loading ? (
                  <>
                    <svg className="vx-spin" width="16" height="16" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,.3)" strokeWidth="4" />
                      <path fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Signing in…
                  </>
                ) : "Sign in"}
              </button>
            </form>

            <p style={{ marginTop: "20px", textAlign: "center", fontSize: ".85rem", color: "#5F5F6E" }}>
              Don't have an account?{" "}
              <Link to="/register" style={{ color: "#534AB7", fontWeight: 700, textDecoration: "none" }}>
                Sign Up
              </Link>
            </p>

            <p style={{ marginTop: "28px", textAlign: "center", fontSize: ".78rem", color: "#C0C0D0" }}>
              By signing in you agree to Mitchell's{" "}
              <span style={{ color: "#7F77DD", cursor: "pointer" }}>Terms</span> &amp;{" "}
              <span style={{ color: "#7F77DD", cursor: "pointer" }}>Privacy Policy</span>
            </p>
          </div>
        </div>

      </div>
    </>
  );
}
