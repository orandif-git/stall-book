import { Check } from "lucide-react";
import type { PublicFloorPlanStall } from "../../lib/api";
import { INK, fontSizeForBox, polygonCentroid } from "../floorplan/planTokens";

interface Props {
  stall: PublicFloorPlanStall;
  selected: boolean;
  onToggle: (stall: PublicFloorPlanStall) => void;
  // Position-based rather than tied to a specific event type — driven by real mouse hover on
  // desktop (mouseenter/mousemove/mouseleave), but touch/pen has no hover concept at all, so
  // touch instead fires this once on pointerdown (see onPointerDown below) and the caller
  // auto-dismisses it after a delay rather than waiting for a "leave" that will never come.
  onHover: (stall: PublicFloorPlanStall | null, pos?: { x: number; y: number }) => void;
}

// Public-portal equivalent of the admin StallShape — same bounding-box-as-hit-target /
// clip-path-on-a-child-span structure (so polygon stalls stay fully clickable, see the admin
// component's comment for why), but only two real states here: available (colored by
// category, tappable) and unavailable (greyed out, inert). No admin status/payment styling.
export function PublicStallShape({ stall, selected, onToggle, onHover }: Props) {
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

  // Label anchor: the polygon centroid for "poly" stalls (stays inside notched shapes), the
  // plain box center otherwise — see polygonCentroid's comment in planTokens.ts.
  const labelAnchor =
    stall.shape === "poly" && stall.points.length >= 6
      ? polygonCentroid(stall.points)
      : { x: stall.posX! + stall.width! / 2, y: stall.posY! + stall.height! / 2 };
  const labelLeftPct = ((labelAnchor.x - stall.posX!) / stall.width!) * 100;
  const labelTopPct = ((labelAnchor.y - stall.posY!) / stall.height!) * 100;

  return (
    <button
      type="button"
      disabled={!isAvailable}
      onClick={() => isAvailable && onToggle(stall)}
      onMouseEnter={(e) => onHover(stall, { x: e.clientX, y: e.clientY })}
      onMouseMove={(e) => onHover(stall, { x: e.clientX, y: e.clientY })}
      onMouseLeave={() => onHover(null)}
      onPointerDown={(e) => {
        if (e.pointerType === "touch" || e.pointerType === "pen") onHover(stall, { x: e.clientX, y: e.clientY });
      }}
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
        cursor: isAvailable ? "pointer" : "default",
        outlineColor: INK.red,
      }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: fill, border: `1px solid ${border}`, borderRadius: clipPath ? 0 : 1.5, clipPath, overflow: "hidden" }}
      />
      <span
        className="absolute z-10 flex items-center gap-0.5 px-0.5"
        style={{
          left: `${labelLeftPct}%`,
          top: `${labelTopPct}%`,
          transform: "translate(-50%, -50%)",
          // Only poly stalls need a hard width cap (their centroid can sit near a notch edge,
          // where unconstrained text would run outside the shape) — rect stalls keep the old
          // unconstrained behavior so short codes that were already fine stay pixel-identical.
          ...(stall.shape === "poly" ? { maxWidth: stall.width!, overflow: "hidden" } : {}),
        }}
      >
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
