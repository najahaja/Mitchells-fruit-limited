export const C = {
  pageBg: "#F8F8FC",
  card: "#ffffff",
  border: "#EAEAF2",
  text: "#0F0F1A",
  textSub: "#525270",
  textMuted: "#8888A8",
  purple: "#534AB7",
  purpleBg: "rgba(83,74,183,.08)",
  green: "#1DB87A",
  greenBg: "rgba(29,184,122,.08)",
  red: "#E54545",
  redBg: "rgba(229,69,69,.08)",
  gold: "#C8973A",
  goldBg: "rgba(200,151,58,.08)",
};

export function formatDuration(ms) {
  if (!ms) return "—";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

export const STATUS_COLORS = {
  draft: { bg: C.purpleBg, color: C.purple },
  active: { bg: C.greenBg, color: C.green },
  paused: { bg: C.goldBg, color: C.gold },
  completed: { bg: C.greenBg, color: C.green },
  pending: { bg: C.purpleBg, color: C.purple },
  calling: { bg: C.goldBg, color: C.gold },
  failed: { bg: C.redBg, color: C.red },
  ended: { bg: C.greenBg, color: C.green },
  ongoing: { bg: C.goldBg, color: C.gold },
};

export function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || { bg: C.purpleBg, color: C.purple };
  return (
    <span
      style={{
        fontSize: ".7rem",
        fontWeight: 700,
        padding: "3px 8px",
        borderRadius: 100,
        background: s.bg,
        color: s.color,
        textTransform: "capitalize",
      }}
    >
      {status}
    </span>
  );
}
