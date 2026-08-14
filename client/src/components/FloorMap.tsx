import { useMemo } from "react";
import type { Stall } from "../lib/api";
import { formatCurrency } from "../lib/format";
import { STALL_STATUS_STYLES } from "../lib/status";
import { cn } from "@/lib/utils";

interface Props {
  stalls: Stall[];
  selected: Set<string>;
  blockMode: boolean;
  onToggleSelect: (stall: Stall) => void;
  onViewBooked: (stall: Stall) => void;
  onViewBlocked: (stall: Stall) => void;
  onReleaseBlock: (stall: Stall) => void;
}

export function FloorMap({
  stalls,
  selected,
  blockMode,
  onToggleSelect,
  onViewBooked,
  onViewBlocked,
  onReleaseBlock,
}: Props) {
  const rows = useMemo(() => {
    const byRow = new Map<number, Stall[]>();
    for (const s of stalls) {
      const arr = byRow.get(s.gridRow) ?? [];
      arr.push(s);
      byRow.set(s.gridRow, arr);
    }
    return [...byRow.entries()]
      .sort(([a], [b]) => a - b)
      .map(([row, items]) => [row, items.sort((a, b) => a.gridCol - b.gridCol)] as const);
  }, [stalls]);

  function tooltipFor(s: Stall) {
    let who: string | undefined;
    if (s.status === "BOOKED") {
      const booking = s.bookingLinks?.[0]?.booking;
      if (booking) who = booking.company ? `${booking.exhibitorName} (${booking.company})` : booking.exhibitorName;
    } else if (s.status === "BLOCKED") {
      who = s.holdLinks?.[0]?.hold.exhibitorName ?? undefined;
    }
    return `${s.code} · ${s.status}${who ? ` · ${who}` : ""}`;
  }

  function handleClick(stall: Stall) {
    if (blockMode) {
      if (stall.status === "AVAILABLE") onToggleSelect(stall);
      else if (stall.status === "BLOCKED") onReleaseBlock(stall);
      return;
    }
    if (stall.status === "AVAILABLE") onToggleSelect(stall);
    else if (stall.status === "BOOKED") onViewBooked(stall);
    else if (stall.status === "BLOCKED") onViewBlocked(stall);
  }

  return (
    <div className="space-y-1 overflow-x-auto rounded-xl border border-border bg-card p-3">
      {rows.map(([row, items]) => (
        <div key={row} className="flex items-center gap-3 py-0.5">
          <div className="w-32 shrink-0 text-right text-xs text-muted-foreground">
            <div className="truncate">{items[0]?.category.label}</div>
            <div className="text-[11px] text-muted-foreground/70">{formatCurrency(items[0]?.category.price ?? 0)}</div>
          </div>
          <div className="flex gap-1">
            {items.map((s) => {
              const isSelected = selected.has(s.id);
              const clickable =
                s.status === "AVAILABLE" || s.status === "BOOKED" || s.status === "BLOCKED";
              return (
                <button
                  key={s.id}
                  onClick={() => handleClick(s)}
                  title={tooltipFor(s)}
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-md border text-[10px] font-medium transition focus:outline-none",
                    isSelected ? "border-primary bg-primary text-primary-foreground" : STALL_STATUS_STYLES[s.status],
                    blockMode && s.status === "BLOCKED" && "ring-offset-1 hover:ring-2 hover:ring-warning",
                    clickable ? "cursor-pointer" : "cursor-not-allowed"
                  )}
                >
                  {s.code}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
