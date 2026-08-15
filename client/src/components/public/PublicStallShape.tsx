import { Check } from "lucide-react";
import type { PublicFloorPlanStall } from "../../lib/api";
import { INK, fontSizeForBox } from "../floorplan/planTokens";

interface Props {
  stall: PublicFloorPlanStall;
  selected: boolean;
  onToggle: (stall: PublicFloorPlanStall) => void;
}

// Public-portal equivalent of the admin StallShape — same bounding-box-as-hit-target /
// clip-path-on-a-child-span structure (so polygon stalls stay fully clickable, see the admin
// component's comment for why), but only two real states here: available (colored by
// category, tappable) and unavailable (greyed out, inert). No admin status/payment styling.
export function PublicStallShape({ stall, selected, onToggle }: Props) {
  if (stall.posX == null || stall.posY == null || stall.width == null || stall.height == null) return null;

  const isAvailable = stall.status === "AVAILABLE";
  const fill = selected ? INK.green : isAvailable ? (stall.colorHex ?? "#ccc") : "#c9d3dd";
  const border = selected ? "#064530" : isAvailable ? "rgba(16,24,32,.5)" : "#9aa6b2";
  const textColor = selected ? "#fff" : isAvailable ? "#12181f" : "#5c6b7a";
  const fontSize = fontSizeForBox(stall.width, stall.height, stall.code.length);

  const clipPath =
    stall.shape === "poly" && stall.points.length >= 6
      ? `polygon(${chunkPairs(stall.points)
          .map(([px, py]) => `${((px - stall.posX!) / stall.width!) * 100}% ${((py - stall.posY!) / stall.height!) * 100}%`)
          .join(", ")})`
      : undefined;

  return (
    <button
      type="button"
      disabled={!isAvailable}
      onClick={() => isAvailable && onToggle(stall)}
      title={isAvailable ? `${stall.code} · ${stall.categoryLabel}` : `${stall.code} · Not available`}
      className="motion-safe:transition-transform motion-safe:duration-100 disabled:cursor-not-allowed enabled:hover:z-20 enabled:hover:scale-[1.14] enabled:active:scale-[1.05] focus-visible:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
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
        cursor: isAvailable ? "pointer" : "default",
        outlineColor: INK.red,
      }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: fill, border: `1px solid ${border}`, borderRadius: clipPath ? 0 : 1.5, clipPath, overflow: "hidden" }}
      />
      <span className="relative z-10 flex items-center gap-0.5 px-0.5">
        {selected && <Check className="size-2.5 shrink-0" />}
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
