import type { PublicFloorPlanStall } from "../../lib/api";
import { formatCurrency } from "../../lib/format";
import { INK } from "../floorplan/planTokens";

interface Props {
  stall: PublicFloorPlanStall | null;
  x: number;
  y: number;
}

// Public equivalent of the admin StallTooltip — same one-instance-shared-across-all-stalls
// pattern, but only ever shows code/category/price/availability, since that's all a
// PublicFloorPlanStall carries (no exhibitor name, no payment/balance data — the public
// floorplan endpoint never sends that, see server/src/routes/public.ts).
export function PublicStallTooltip({ stall, x, y }: Props) {
  if (!stall) return null;
  const isAvailable = stall.status === "AVAILABLE";

  return (
    <div
      className="pointer-events-none fixed z-[60] min-w-[170px] rounded-md px-2.5 py-2 shadow-2xl"
      style={{
        left: Math.min(x + 16, window.innerWidth - 200),
        top: Math.max(8, y - 90),
        background: INK.ink,
        color: "#fff",
        borderLeft: `3px solid ${stall.colorHex ?? "#9aa6b2"}`,
      }}
    >
      <div className="text-sm font-bold tracking-wide">{stall.code}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-white/60">{stall.categoryLabel}</div>
      <div className="mt-1.5 text-sm font-bold">{formatCurrency(stall.price)}</div>
      <div
        className="mt-1.5 text-[9.5px] font-bold tracking-wider uppercase"
        style={{ color: isAvailable ? "#5ce0a5" : "#ff8b90" }}
      >
        {isAvailable ? "● Available — tap to select" : "● Not available"}
      </div>
    </div>
  );
}
