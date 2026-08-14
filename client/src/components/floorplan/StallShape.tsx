import { Lock, Check } from "lucide-react";
import type { FloorPlanStall } from "../../lib/api";
import { STATUS_STYLES, fontSizeForBox, INK } from "./planTokens";

interface Props {
  stall: FloorPlanStall;
  selected: boolean;
  dimmed: boolean;
  hit: boolean;
  onClick: (evt: React.MouseEvent) => void;
  onHover: (stall: FloorPlanStall | null, evt?: React.MouseEvent) => void;
}

export function StallShape({ stall, selected, dimmed, hit, onClick, onHover }: Props) {
  if (stall.posX == null || stall.posY == null || stall.width == null || stall.height == null) return null;

  const style = STATUS_STYLES[stall.status];
  const isAvailable = stall.status === "AVAILABLE";
  const fill = selected ? INK.green : isAvailable ? stall.colorHex ?? "#ccc" : style.background;
  const border = selected ? "#064530" : style.border;
  const textColor = selected ? "#fff" : style.textColor;
  const fontSize = fontSizeForBox(stall.width, stall.height, stall.code.length);

  // Partial payments get a filled bottom bar showing % paid, on top of the hatch.
  const paidPct =
    stall.status === "BOOKED_PARTIAL" && stall.totalAmount && stall.amountPaid
      ? Math.min(100, Math.round((stall.amountPaid / stall.totalAmount) * 100))
      : null;

  // Non-rectangular stalls: posX/posY/width/height stay the bounding-box hit target (button
  // size/position, label centering all unchanged), but the visible shape is clipped down to
  // the actual traced polygon via clip-path, expressed as percentages of that same box.
  const clipPath =
    stall.shape === "poly" && stall.points.length >= 6
      ? `polygon(${chunkPairs(stall.points)
          .map(([px, py]) => `${((px - stall.posX!) / stall.width!) * 100}% ${((py - stall.posY!) / stall.height!) * 100}%`)
          .join(", ")})`
      : undefined;

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={(e) => onHover(stall, e)}
      onMouseMove={(e) => onHover(stall, e)}
      onMouseLeave={() => onHover(null)}
      title={`${stall.code} · ${style.label}`}
      className="motion-safe:transition-transform motion-safe:duration-100 hover:z-20 hover:scale-[1.14] focus-visible:z-20 focus-visible:scale-[1.14] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
      style={{
        position: "absolute",
        left: stall.posX,
        top: stall.posY,
        width: stall.width,
        height: stall.height,
        background: "transparent",
        border: "none",
        padding: 0,
        color: textColor,
        fontWeight: 700,
        fontSize,
        lineHeight: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: dimmed ? 0.16 : 1,
        filter: dimmed ? "grayscale(1)" : undefined,
        cursor: "pointer",
        outlineColor: INK.red,
        // The hit target is always the full bounding box, even for "poly" stalls — clip-path
        // restricts pointer events to the visible shape, which would make the box's own
        // corners unclickable. So the box shadow ring and fill/border below are visual-only,
        // never clipped on the button element itself.
        boxShadow: hit ? `0 0 0 3px ${INK.red}` : undefined,
      }}
    >
      {/* Purely decorative visual fill — clipped to the traced polygon when shape="poly",
          but pointer-events-none so it never narrows the button's own clickable area. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: fill,
          border: `1px solid ${border}`,
          borderRadius: clipPath ? 0 : 1.5,
          clipPath,
          overflow: "hidden",
        }}
      >
        {style.hatch && !selected && <span className="absolute inset-0" style={{ background: style.hatch }} />}
        {paidPct != null && !selected && (
          <span className="absolute inset-x-0 bottom-0 bg-white/45" style={{ height: `${paidPct}%` }} />
        )}
      </span>
      <span className="relative z-10 flex items-center gap-0.5 px-0.5">
        {style.glyph === "lock" && <Lock className="size-2.5 shrink-0" />}
        {style.glyph === "check" && <Check className="size-2.5 shrink-0" />}
        <span className="truncate">{stall.code}</span>
      </span>
    </button>
  );
}

function chunkPairs(flat: number[]): [number, number][] {
  const pairs: [number, number][] = [];
  for (let i = 0; i < flat.length - 1; i += 2) pairs.push([flat[i], flat[i + 1]]);
  return pairs;
}
