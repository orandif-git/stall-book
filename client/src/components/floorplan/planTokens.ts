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
