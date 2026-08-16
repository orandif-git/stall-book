import type { FloorPlanStall } from "../../lib/api";
import { formatCurrency } from "../../lib/format";
import { INK, STATUS_STYLES } from "./planTokens";

interface Props {
  stall: FloorPlanStall | null;
  x: number;
  y: number;
}

// A single tooltip instance shared across all stalls (not one per shape) — cheaper, and
// matches the reference mockup's pattern of one floating card that follows the pointer.
export function StallTooltip({ stall, x, y }: Props) {
  if (!stall) return null;
  const style = STATUS_STYLES[stall.status];
  const balanceDue =
    stall.totalAmount != null && stall.amountPaid != null ? stall.totalAmount - stall.amountPaid : null;

  return (
    <div
      className="pointer-events-none fixed z-[60] min-w-[170px] rounded-md px-2.5 py-2 shadow-2xl"
      style={{
        left: Math.min(x + 16, window.innerWidth - 200),
        top: Math.max(8, y - 90),
        background: INK.ink,
        color: "#fff",
        borderLeft: `3px solid ${stall.colorHex ?? style.background}`,
      }}
    >
      <div className="text-sm font-bold tracking-wide">{stall.code}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-white/60">{stall.categoryLabel}</div>
      <div className="mt-1.5 text-sm font-bold">{formatCurrency(stall.price)}</div>
      <div className="mt-1.5 text-[9.5px] font-bold tracking-wider uppercase" style={{ color: statusTextColor(stall.status) }}>
        {statusLine(stall)}
      </div>
      {balanceDue != null && balanceDue > 0 && (
        <div className="mt-1 text-[10px] text-white/70">Balance due: {formatCurrency(balanceDue)}</div>
      )}
    </div>
  );
}

function statusTextColor(status: FloorPlanStall["status"]) {
  if (status === "AVAILABLE") return "#5ce0a5";
  if (status === "BLOCKED") return "#ffcf7a";
  return "#ff8b90";
}

function statusLine(stall: FloorPlanStall) {
  switch (stall.status) {
    case "AVAILABLE":
      return "● Available — click to book";
    case "BLOCKED": {
      // Company first when it's on file — that's the more useful business detail on hover —
      // falling back to "held for" (exhibitor name/reason), same as before, when there's no
      // company yet.
      const who = stall.company || stall.blockedFor;
      return `▲ Blocked${who ? ` — ${who}` : ""}`;
    }
    case "BOOKED_PAID":
      return `● Paid — ${stall.exhibitorName ?? ""}`;
    case "BOOKED_PARTIAL":
      return `● Partial — ${stall.exhibitorName ?? ""}`;
    case "BOOKED_UNPAID":
      return `● Unpaid — ${stall.exhibitorName ?? ""}`;
  }
}
