// Colors/patterns are a distinct visual register from the rest of the admin dashboard,
// matching docs/floor-plan-reference.html — but typography stays the app's own font
// (Geist, from index.css), not a separate monospace stack, so the plan still reads as
// part of this app rather than an embedded foreign tool.
import type { FloorPlanStatus } from "../../lib/api";

export const INK = {
  ink: "#101820",
  ink2: "#3c4a58",
  ink3: "#78889a",
  line: "#c9d3dd",
  line2: "#e3e9ef",
  paper: "#eef1f4",
  plan: "#fbfcfd",
  red: "#c81d25",
  redDark: "#8f1219",
  gold: "#b8860b",
  green: "#0f7a52",
} as const;

export interface StatusStyle {
  label: string;
  background: string;
  border: string;
  textColor: string;
  /** Diagonal hatch overlay, applied as a second background layer. */
  hatch?: string;
  glyph?: "lock" | "check";
}

// AVAILABLE uses the category's own colorHex as its fill — everything else is styled
// independent of category color so status reads correctly regardless of category.
export const STATUS_STYLES: Record<FloorPlanStatus, StatusStyle> = {
  AVAILABLE: {
    label: "Available",
    background: "", // filled from category.colorHex at render time
    border: "rgba(16,24,32,.5)",
    textColor: "#12181f",
  },
  BLOCKED: {
    label: "Blocked",
    background: "#e8b04a",
    border: "#8a6417",
    textColor: "#3a2c05",
    hatch: "repeating-linear-gradient(45deg, rgba(16,24,32,.22) 0 3px, transparent 3px 6px)",
    glyph: "lock",
  },
  BOOKED_UNPAID: {
    label: "Booked — unpaid",
    background: "#55636f",
    border: "#2b353f",
    textColor: "#fff",
    hatch: "repeating-linear-gradient(45deg, rgba(255,255,255,.14) 0 3px, transparent 3px 6px)",
  },
  BOOKED_PARTIAL: {
    label: "Booked — partial",
    background: "#55636f",
    border: "#2b353f",
    textColor: "#fff",
    hatch: "repeating-linear-gradient(45deg, rgba(255,255,255,.14) 0 3px, transparent 3px 6px)",
  },
  BOOKED_PAID: {
    label: "Booked — paid",
    background: "#2b3947",
    border: "#101820",
    textColor: "#fff",
    glyph: "check",
  },
};

export function fontSizeForBox(width: number, height: number, codeLength: number): number {
  const f = Math.min(height * 0.42, width / (codeLength * 0.62));
  return Math.max(6, Math.min(f, 13));
}

// Area-weighted polygon centroid (shoelace formula) — for irregular "poly" stalls (mostly the
// premium S-blocks, which have real aisle/door notches cut into them), the bounding-box center
// can land in the cut-out and float the code label off the visible shape entirely onto the
// background. The centroid stays inside every notched shape currently in use (verified against
// all of them), so stall labels anchor here instead of naively centering on the bounding box.
export function polygonCentroid(points: number[]): { x: number; y: number } {
  let area = 0;
  let cx = 0;
  let cy = 0;
  const n = points.length / 2;
  for (let i = 0; i < n; i++) {
    const x1 = points[i * 2];
    const y1 = points[i * 2 + 1];
    const j = (i + 1) % n;
    const x2 = points[j * 2];
    const y2 = points[j * 2 + 1];
    const cross = x1 * y2 - x2 * y1;
    area += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  area /= 2;
  return { x: cx / (6 * area), y: cy / (6 * area) };
}

// Maps the real layout photo's pixel space (2200x1033) onto the canvas coordinate space. Unlike
// the previous photo (a hand-traced mockup, calibrated via least-squares fit against
// approximate reference points), this one *is* the ground truth every stall's geometry below
// was measured from — color/border-segmented per stall against the real "Chamber Trade Fair
// 2026 LAYOUT" drawing, matched to known codes, and transformed into canvas units via this
// exact scale+offset. So the matrix is derived, not fitted: it's the same linear mapping used
// to produce every posX/posY/width/height/points value in ctf2026-layout.ts, which is why the
// photo and the stall shapes align exactly with no drift. Shared by the admin floor plan
// (toggleable) and the public stall picker (always on).
export const PHOTO_MATRIX = [0.72807, 0, 0, 0.72228, 1.265, 115.657] as const;
export const PHOTO_WIDTH = 2200;
export const PHOTO_HEIGHT = 1033;
