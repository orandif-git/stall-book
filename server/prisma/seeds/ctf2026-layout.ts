// Floor-plan geometry for Chamber Trade Fair 2026, ported directly from the traced
// reference mockup (docs/floor-plan-reference.html) — its own T/SPEC tariff tables and
// add()/strip()/seq() geometry generator, translated 1:1 into TypeScript so numbers are
// never hand-retyped. Canvas unit space is 1500 x 850, matching Event.canvasWidth/Height.
//
// S8/S9 and S11/S12 are independent categories/stalls here (each carries its own full
// price), not combined pairs — confirmed against the real tariff intent, since the old
// combined S8_S9/S11_S12 categories were unbooked at the time of this change.

interface Tariff {
  size: string;
  price: number;
  colorHex: string;
}

// T — tariff per range band, keyed by the mockup's internal band name.
const T: Record<string, Tariff> = {
  A1: { size: "2.5M x 3M", price: 56000, colorHex: "#fbd34a" },
  A210: { size: "3M x 3M", price: 65000, colorHex: "#f3903a" },
  A11: { size: "2.5M x 3M", price: 52000, colorHex: "#f2606a" },
  AA12: { size: "3M x 3M", price: 75000, colorHex: "#efb4e7" },
  AA35: { size: "3M x 3M", price: 70000, colorHex: "#f5a2b0" },
  B: { size: "2.5M x 2.5M", price: 46000, colorHex: "#f0616b" },
  CA: { size: "3M x 3M", price: 60000, colorHex: "#f2938f" },
  C: { size: "2.5M x 2.5M", price: 43000, colorHex: "#e3c08d" },
  CB: { size: "2M x 2.5M", price: 33000, colorHex: "#fbdccb" },
  DA: { size: "3M x 3M", price: 55000, colorHex: "#7fb3ce" },
  D: { size: "2.5M x 2.5M", price: 40000, colorHex: "#35a8e0" },
  DB: { size: "2M x 2.5M", price: 31000, colorHex: "#8e5a92" },
  E: { size: "2.5M x 2.5M", price: 36000, colorHex: "#f39c5a" },
  EB: { size: "2M x 2.5M", price: 27000, colorHex: "#f9b8a4" },
  F: { size: "2M x 2M", price: 25000, colorHex: "#d6db4b" },
  GA: { size: "3M x 3M", price: 60000, colorHex: "#c3a3e8" },
  G: { size: "3M x 3M", price: 50000, colorHex: "#c9265e" },
  H112: { size: "2M x 2M", price: 22000, colorHex: "#a5d5cc" },
  H1318: { size: "2M x 2M", price: 20000, colorHex: "#f6b5c1" },
};

// SPEC — the 18 premium S-blocks, each an independent category (own area + price).
const SPEC: Record<string, { area: number; price: number; colorHex: string }> = {
  S1: { area: 780, price: 400000, colorHex: "#f07f22" },
  S2: { area: 270, price: 150000, colorHex: "#5b8fd6" },
  S3: { area: 410, price: 200000, colorHex: "#1a9b8a" },
  S4: { area: 320, price: 200000, colorHex: "#8ed49a" },
  S5: { area: 92, price: 65000, colorHex: "#4a6fa8" },
  S6: { area: 153, price: 80000, colorHex: "#aec6e8" },
  S7: { area: 128, price: 110000, colorHex: "#c8e86a" },
  S8: { area: 208, price: 110000, colorHex: "#5fbfa8" },
  S9: { area: 208, price: 110000, colorHex: "#6dd3d3" },
  S10: { area: 128, price: 100000, colorHex: "#fbd34a" },
  S11: { area: 208, price: 100000, colorHex: "#a8d5b0" },
  S12: { area: 208, price: 100000, colorHex: "#8fc49a" },
  S13: { area: 128, price: 90000, colorHex: "#e04a1a" },
  S14: { area: 648, price: 220000, colorHex: "#eae86a" },
  S15: { area: 355, price: 140000, colorHex: "#c08a6a" },
  S16: { area: 114, price: 45000, colorHex: "#a03a52" },
  S17: { area: 78, price: 40000, colorHex: "#e5a8ec" },
  S18: { area: 114, price: 40000, colorHex: "#d8a8f0" },
};

// Maps each range band to this app's existing category code/label convention
// (same codes/labels/order server/prisma/seed.ts has always used).
const RANGE_BANDS: { key: keyof typeof T; code: string; label: string }[] = [
  { key: "AA12", code: "AA-75k", label: "3M x 3M (AA1 to AA2)" },
  { key: "AA35", code: "AA-70k", label: "3M x 3M (AA3 to AA5)" },
  { key: "A1", code: "A1", label: "2.5M x 3M (A1)" },
  { key: "A210", code: "A-65k", label: "3M x 3M (A2 to A10)" },
  { key: "A11", code: "A11", label: "2.5M x 3M (A11)" },
  { key: "B", code: "B", label: "2.5M x 2.5M (B1 to B41)" },
  { key: "CA", code: "CA", label: "3M x 3M (CA1 to CA3)" },
  { key: "C", code: "C", label: "2.5M x 2.5M (C1 to C38)" },
  { key: "CB", code: "CB", label: "2M x 2.5M (CB1 to CB6)" },
  { key: "D", code: "D", label: "2.5M x 2.5M (D1 to D34)" },
  { key: "DA", code: "DA", label: "3M x 3M (DA1 to DA4)" },
  { key: "DB", code: "DB", label: "2M x 2.5M (DB1 to DB11)" },
  { key: "E", code: "E", label: "2.5M x 2.5M (E1 to E15)" },
  { key: "EB", code: "EB", label: "2M x 2.5M (EB1 to EB8)" },
  { key: "F", code: "F", label: "2M x 2M (F1 to F26)" },
  { key: "GA", code: "GA", label: "3M x 3M (GA1 to GA3)" },
  { key: "G", code: "G", label: "3M x 3M (G1 to G6)" },
  { key: "H112", code: "H-22k", label: "2M x 2M (H1 to H12)" },
  { key: "H1318", code: "H-20k", label: "2M x 2M (H13 to H18)" },
];

export interface LayoutCategory {
  code: string;
  label: string;
  size?: string;
  price: number;
  colorHex: string;
}

export const CATEGORIES: LayoutCategory[] = [
  ...RANGE_BANDS.map(({ key, code, label }) => ({
    code,
    label,
    size: T[key].size,
    price: T[key].price,
    colorHex: T[key].colorHex,
  })),
  ...Object.entries(SPEC).map(([code, s]) => ({
    code,
    label: `${s.area} Sqft (${code})`,
    price: s.price,
    colorHex: s.colorHex,
  })),
];

export interface LayoutStall {
  code: string;
  categoryCode: string;
  posX: number;
  posY: number;
  width: number;
  height: number;
  shape: "rect" | "poly";
  points: number[];
}

// Precise stall geometry, measured directly from the real "Chamber Trade Fair 2026 LAYOUT —
// Tamukkam Convention Centre" drawing (root: "Chamber Trade fair 2026 LAYOUT _ UPDATED
// .29.06.2026.pdf"), not approximated from the hand-built mockup this file originally traced.
// Method: the drawing's embedded raster (4961x3508) was color/border-segmented per stall — each
// cell's solid fill color is fully bounded by black grid lines, so a plain "not white, not
// black" connected-component mask isolates every stall as its own blob (irregular S-block
// shapes included, via contour extraction on each blob). Blobs were matched to the codes/
// categories below — already known and correct — by nearest-neighbor position rather than OCR
// (OCR on the small embedded labels wasn't reliable enough to trust), then verified by
// rendering every match back onto the source image and visually confirming all 247 labels sit
// on their real cell with zero collisions. Pixel coordinates were mapped into this file's
// 1500x850 canvas unit space via the same linear transform that produced PHOTO_MATRIX in
// planTokens.ts, which is why the stall shapes align exactly with the reference photo. Most
// premium S-blocks have real notches cut into them for aisles/doors and are "poly"; everything
// else is a plain "rect".
export const STALLS: LayoutStall[] = [
  { code: "F1", categoryCode: "F", posX: 136.2, posY: 153.1, width: 29.1, height: 31.4, shape: "rect", points: [] },
  { code: "F2", categoryCode: "F", posX: 166.3, posY: 153.1, width: 29.4, height: 31.4, shape: "rect", points: [] },
  { code: "F3", categoryCode: "F", posX: 196.6, posY: 153.1, width: 29.1, height: 31.4, shape: "rect", points: [] },
  { code: "F4", categoryCode: "F", posX: 226.6, posY: 153.1, width: 29.4, height: 31.4, shape: "rect", points: [] },
  { code: "F5", categoryCode: "F", posX: 256.7, posY: 153.1, width: 29.7, height: 31.4, shape: "rect", points: [] },
  { code: "F6", categoryCode: "F", posX: 287.0, posY: 153.1, width: 29.4, height: 31.4, shape: "rect", points: [] },
  { code: "F7", categoryCode: "F", posX: 317.4, posY: 153.1, width: 29.4, height: 31.4, shape: "rect", points: [] },
  { code: "F8", categoryCode: "F", posX: 347.7, posY: 153.1, width: 29.1, height: 31.4, shape: "rect", points: [] },
  { code: "F9", categoryCode: "F", posX: 377.7, posY: 153.1, width: 29.1, height: 31.4, shape: "rect", points: [] },
  { code: "F10", categoryCode: "F", posX: 407.8, posY: 153.1, width: 29.4, height: 31.4, shape: "rect", points: [] },
  { code: "F11", categoryCode: "F", posX: 438.1, posY: 153.1, width: 29.4, height: 31.4, shape: "rect", points: [] },
  { code: "F12", categoryCode: "F", posX: 540.5, posY: 153.1, width: 29.7, height: 31.4, shape: "rect", points: [] },
  { code: "F13", categoryCode: "F", posX: 570.8, posY: 153.1, width: 29.4, height: 31.4, shape: "rect", points: [] },
  { code: "F14", categoryCode: "F", posX: 601.2, posY: 153.1, width: 29.1, height: 31.4, shape: "rect", points: [] },
  { code: "F15", categoryCode: "F", posX: 631.2, posY: 153.1, width: 29.4, height: 31.4, shape: "rect", points: [] },
  { code: "F16", categoryCode: "F", posX: 661.5, posY: 153.1, width: 29.1, height: 31.4, shape: "rect", points: [] },
  { code: "F17", categoryCode: "F", posX: 691.6, posY: 153.1, width: 29.4, height: 31.4, shape: "rect", points: [] },
  { code: "F18", categoryCode: "F", posX: 721.9, posY: 153.1, width: 29.4, height: 31.4, shape: "rect", points: [] },
  { code: "F19", categoryCode: "F", posX: 751.9, posY: 153.1, width: 29.4, height: 31.4, shape: "rect", points: [] },
  { code: "F20", categoryCode: "F", posX: 782.3, posY: 153.1, width: 29.1, height: 31.4, shape: "rect", points: [] },
  { code: "F21", categoryCode: "F", posX: 812.3, posY: 153.1, width: 29.4, height: 31.4, shape: "rect", points: [] },
  { code: "F22", categoryCode: "F", posX: 842.3, posY: 153.1, width: 29.7, height: 31.4, shape: "rect", points: [] },
  { code: "F23", categoryCode: "F", posX: 873.0, posY: 153.1, width: 29.4, height: 31.4, shape: "rect", points: [] },
  { code: "F24", categoryCode: "F", posX: 903.0, posY: 153.1, width: 29.1, height: 31.4, shape: "rect", points: [] },
  { code: "F25", categoryCode: "F", posX: 933.1, posY: 153.1, width: 29.4, height: 31.4, shape: "rect", points: [] },
  { code: "F26", categoryCode: "F", posX: 963.4, posY: 153.1, width: 29.4, height: 31.4, shape: "rect", points: [] },
  { code: "EB8", categoryCode: "EB", posX: 114.3, posY: 266.2, width: 29.1, height: 39.7, shape: "rect", points: [] },
  { code: "EB7", categoryCode: "EB", posX: 144.3, posY: 266.2, width: 29.4, height: 39.7, shape: "rect", points: [] },
  { code: "EB6", categoryCode: "EB", posX: 174.6, posY: 266.2, width: 29.4, height: 39.7, shape: "rect", points: [] },
  { code: "EB5", categoryCode: "EB", posX: 205.0, posY: 266.2, width: 29.1, height: 39.7, shape: "rect", points: [] },
  { code: "EB4", categoryCode: "EB", posX: 235.0, posY: 266.2, width: 29.4, height: 39.7, shape: "rect", points: [] },
  { code: "EB3", categoryCode: "EB", posX: 265.4, posY: 266.2, width: 29.4, height: 39.7, shape: "rect", points: [] },
  { code: "EB2", categoryCode: "EB", posX: 295.7, posY: 266.2, width: 29.4, height: 39.7, shape: "rect", points: [] },
  { code: "EB1", categoryCode: "EB", posX: 326.1, posY: 266.2, width: 28.7, height: 39.7, shape: "rect", points: [] },
  { code: "E15", categoryCode: "E", posX: 355.8, posY: 266.2, width: 36.8, height: 39.7, shape: "rect", points: [] },
  { code: "E14", categoryCode: "E", posX: 393.5, posY: 266.2, width: 37.1, height: 39.7, shape: "rect", points: [] },
  { code: "E13", categoryCode: "E", posX: 431.6, posY: 266.2, width: 36.8, height: 39.7, shape: "rect", points: [] },
  { code: "E12", categoryCode: "E", posX: 469.4, posY: 266.2, width: 36.5, height: 39.7, shape: "rect", points: [] },
  { code: "E11", categoryCode: "E", posX: 506.9, posY: 266.2, width: 36.8, height: 39.7, shape: "rect", points: [] },
  { code: "E10", categoryCode: "E", posX: 544.7, posY: 266.2, width: 36.8, height: 39.7, shape: "rect", points: [] },
  { code: "E9", categoryCode: "E", posX: 582.4, posY: 266.2, width: 36.8, height: 39.7, shape: "rect", points: [] },
  { code: "E8", categoryCode: "E", posX: 620.2, posY: 266.2, width: 36.8, height: 39.7, shape: "rect", points: [] },
  { code: "E7", categoryCode: "E", posX: 658.0, posY: 266.2, width: 36.8, height: 39.7, shape: "rect", points: [] },
  { code: "E6", categoryCode: "E", posX: 695.8, posY: 266.2, width: 36.8, height: 39.7, shape: "rect", points: [] },
  { code: "E5", categoryCode: "E", posX: 733.5, posY: 266.2, width: 36.8, height: 39.7, shape: "rect", points: [] },
  { code: "E4", categoryCode: "E", posX: 771.3, posY: 266.2, width: 36.8, height: 39.7, shape: "rect", points: [] },
  { code: "E3", categoryCode: "E", posX: 808.8, posY: 266.2, width: 36.8, height: 39.7, shape: "rect", points: [] },
  { code: "E2", categoryCode: "E", posX: 846.5, posY: 266.2, width: 37.5, height: 39.7, shape: "rect", points: [] },
  { code: "E1", categoryCode: "E", posX: 884.6, posY: 266.2, width: 36.8, height: 39.7, shape: "rect", points: [] },
  { code: "DB4", categoryCode: "DB", posX: 114.3, posY: 306.9, width: 29.1, height: 39.4, shape: "rect", points: [] },
  { code: "DB7", categoryCode: "DB", posX: 144.3, posY: 306.9, width: 29.4, height: 39.4, shape: "rect", points: [] },
  { code: "DB6", categoryCode: "DB", posX: 174.6, posY: 306.9, width: 29.4, height: 39.4, shape: "rect", points: [] },
  { code: "DB5", categoryCode: "DB", posX: 205.0, posY: 306.9, width: 29.1, height: 39.1, shape: "rect", points: [] },
  { code: "DB8", categoryCode: "DB", posX: 235.0, posY: 306.9, width: 29.4, height: 39.1, shape: "rect", points: [] },
  { code: "DB9", categoryCode: "DB", posX: 265.4, posY: 306.9, width: 29.4, height: 39.1, shape: "rect", points: [] },
  { code: "DB10", categoryCode: "DB", posX: 295.7, posY: 306.9, width: 29.4, height: 39.1, shape: "rect", points: [] },
  { code: "DB11", categoryCode: "DB", posX: 326.1, posY: 306.9, width: 28.7, height: 39.1, shape: "rect", points: [] },
  { code: "D20", categoryCode: "D", posX: 355.8, posY: 306.6, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "D21", categoryCode: "D", posX: 393.5, posY: 306.6, width: 37.1, height: 39.4, shape: "rect", points: [] },
  { code: "D22", categoryCode: "D", posX: 431.6, posY: 306.6, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "D23", categoryCode: "D", posX: 469.4, posY: 306.6, width: 36.5, height: 39.4, shape: "rect", points: [] },
  { code: "D24", categoryCode: "D", posX: 506.9, posY: 306.6, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "D25", categoryCode: "D", posX: 544.7, posY: 306.6, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "D26", categoryCode: "D", posX: 582.4, posY: 306.6, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "D27", categoryCode: "D", posX: 620.2, posY: 306.6, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "D28", categoryCode: "D", posX: 658.0, posY: 306.6, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "D29", categoryCode: "D", posX: 695.8, posY: 306.6, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "D30", categoryCode: "D", posX: 733.5, posY: 306.6, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "D31", categoryCode: "D", posX: 771.3, posY: 306.6, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "D32", categoryCode: "D", posX: 808.8, posY: 306.6, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "D33", categoryCode: "D", posX: 846.5, posY: 306.6, width: 37.5, height: 39.4, shape: "rect", points: [] },
  { code: "D34", categoryCode: "D", posX: 884.6, posY: 306.6, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "DB3", categoryCode: "DB", posX: 114.3, posY: 435.6, width: 29.1, height: 39.4, shape: "rect", points: [] },
  { code: "DB2", categoryCode: "DB", posX: 144.3, posY: 435.6, width: 29.4, height: 39.4, shape: "rect", points: [] },
  { code: "DB1", categoryCode: "DB", posX: 174.6, posY: 435.6, width: 29.4, height: 39.4, shape: "rect", points: [] },
  { code: "D19", categoryCode: "D", posX: 205.0, posY: 435.6, width: 36.5, height: 39.4, shape: "rect", points: [] },
  { code: "D18", categoryCode: "D", posX: 242.4, posY: 435.6, width: 37.1, height: 39.4, shape: "rect", points: [] },
  { code: "D17", categoryCode: "D", posX: 280.5, posY: 435.6, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "D16", categoryCode: "D", posX: 318.0, posY: 435.6, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "D15", categoryCode: "D", posX: 355.8, posY: 435.6, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "D14", categoryCode: "D", posX: 393.5, posY: 435.6, width: 37.1, height: 39.4, shape: "rect", points: [] },
  { code: "D13", categoryCode: "D", posX: 431.6, posY: 435.6, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "D12", categoryCode: "D", posX: 469.4, posY: 435.6, width: 36.5, height: 39.4, shape: "rect", points: [] },
  { code: "D11", categoryCode: "D", posX: 506.9, posY: 435.6, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "D10", categoryCode: "D", posX: 544.7, posY: 435.6, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "D9", categoryCode: "D", posX: 582.4, posY: 435.6, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "D8", categoryCode: "D", posX: 620.2, posY: 435.6, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "D7", categoryCode: "D", posX: 658.0, posY: 435.6, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "D6", categoryCode: "D", posX: 695.8, posY: 435.6, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "D5", categoryCode: "D", posX: 733.5, posY: 435.6, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "D4", categoryCode: "D", posX: 771.3, posY: 435.6, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "D3", categoryCode: "D", posX: 808.8, posY: 435.6, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "D2", categoryCode: "D", posX: 846.5, posY: 435.6, width: 37.5, height: 39.4, shape: "rect", points: [] },
  { code: "D1", categoryCode: "D", posX: 884.6, posY: 435.6, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "CB4", categoryCode: "CB", posX: 114.3, posY: 476.0, width: 29.1, height: 39.7, shape: "rect", points: [] },
  { code: "CB5", categoryCode: "CB", posX: 144.3, posY: 476.0, width: 29.4, height: 39.7, shape: "rect", points: [] },
  { code: "CB6", categoryCode: "CB", posX: 174.6, posY: 476.0, width: 29.4, height: 39.4, shape: "rect", points: [] },
  { code: "C20", categoryCode: "C", posX: 205.0, posY: 476.0, width: 36.5, height: 39.4, shape: "rect", points: [] },
  { code: "C21", categoryCode: "C", posX: 242.4, posY: 476.0, width: 37.1, height: 39.4, shape: "rect", points: [] },
  { code: "C22", categoryCode: "C", posX: 280.5, posY: 476.0, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "C23", categoryCode: "C", posX: 318.0, posY: 476.0, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "C24", categoryCode: "C", posX: 355.8, posY: 476.0, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "C25", categoryCode: "C", posX: 393.5, posY: 476.0, width: 37.1, height: 39.4, shape: "rect", points: [] },
  { code: "C26", categoryCode: "C", posX: 431.6, posY: 476.0, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "C27", categoryCode: "C", posX: 469.4, posY: 476.0, width: 36.5, height: 39.4, shape: "rect", points: [] },
  { code: "C28", categoryCode: "C", posX: 506.9, posY: 476.0, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "C29", categoryCode: "C", posX: 544.7, posY: 476.0, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "C30", categoryCode: "C", posX: 582.4, posY: 476.0, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "C31", categoryCode: "C", posX: 620.2, posY: 476.0, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "C32", categoryCode: "C", posX: 658.0, posY: 476.0, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "C33", categoryCode: "C", posX: 695.8, posY: 476.0, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "C34", categoryCode: "C", posX: 733.5, posY: 476.0, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "C35", categoryCode: "C", posX: 771.3, posY: 476.0, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "C36", categoryCode: "C", posX: 808.8, posY: 476.0, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "C37", categoryCode: "C", posX: 846.5, posY: 476.0, width: 37.5, height: 39.4, shape: "rect", points: [] },
  { code: "C38", categoryCode: "C", posX: 884.6, posY: 476.0, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "CB3", categoryCode: "CB", posX: 114.3, posY: 602.5, width: 29.4, height: 39.4, shape: "rect", points: [] },
  { code: "CB2", categoryCode: "CB", posX: 144.3, posY: 602.5, width: 29.4, height: 39.4, shape: "rect", points: [] },
  { code: "CB1", categoryCode: "CB", posX: 174.6, posY: 602.5, width: 29.4, height: 39.4, shape: "rect", points: [] },
  { code: "C19", categoryCode: "C", posX: 205.0, posY: 602.5, width: 36.5, height: 39.4, shape: "rect", points: [] },
  { code: "C18", categoryCode: "C", posX: 242.4, posY: 602.5, width: 37.1, height: 39.4, shape: "rect", points: [] },
  { code: "C17", categoryCode: "C", posX: 280.5, posY: 602.5, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "C16", categoryCode: "C", posX: 318.0, posY: 602.5, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "C15", categoryCode: "C", posX: 355.8, posY: 602.5, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "C14", categoryCode: "C", posX: 393.5, posY: 602.5, width: 37.1, height: 39.4, shape: "rect", points: [] },
  { code: "C13", categoryCode: "C", posX: 431.6, posY: 602.5, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "C12", categoryCode: "C", posX: 469.4, posY: 602.5, width: 36.5, height: 39.4, shape: "rect", points: [] },
  { code: "C11", categoryCode: "C", posX: 506.9, posY: 602.5, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "C10", categoryCode: "C", posX: 544.7, posY: 602.5, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "C9", categoryCode: "C", posX: 582.4, posY: 602.5, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "C8", categoryCode: "C", posX: 620.2, posY: 602.5, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "C7", categoryCode: "C", posX: 658.0, posY: 602.5, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "C6", categoryCode: "C", posX: 695.8, posY: 602.5, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "C5", categoryCode: "C", posX: 733.5, posY: 602.5, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "C4", categoryCode: "C", posX: 771.3, posY: 602.5, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "C3", categoryCode: "C", posX: 808.8, posY: 602.5, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "C2", categoryCode: "C", posX: 846.5, posY: 602.5, width: 37.5, height: 39.4, shape: "rect", points: [] },
  { code: "C1", categoryCode: "C", posX: 884.6, posY: 602.5, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "B20", categoryCode: "B", posX: 91.3, posY: 642.9, width: 36.8, height: 39.7, shape: "rect", points: [] },
  { code: "B21", categoryCode: "B", posX: 129.1, posY: 642.9, width: 37.1, height: 39.7, shape: "rect", points: [] },
  { code: "B22", categoryCode: "B", posX: 166.9, posY: 642.9, width: 37.1, height: 39.7, shape: "rect", points: [] },
  { code: "B23", categoryCode: "B", posX: 205.0, posY: 642.9, width: 36.5, height: 39.7, shape: "rect", points: [] },
  { code: "B24", categoryCode: "B", posX: 242.4, posY: 642.9, width: 37.1, height: 39.7, shape: "rect", points: [] },
  { code: "B25", categoryCode: "B", posX: 280.5, posY: 642.9, width: 36.8, height: 39.7, shape: "rect", points: [] },
  { code: "B26", categoryCode: "B", posX: 318.0, posY: 642.9, width: 36.8, height: 39.7, shape: "rect", points: [] },
  { code: "B27", categoryCode: "B", posX: 355.8, posY: 642.9, width: 36.8, height: 39.7, shape: "rect", points: [] },
  { code: "B28", categoryCode: "B", posX: 393.5, posY: 642.9, width: 37.1, height: 39.7, shape: "rect", points: [] },
  { code: "B29", categoryCode: "B", posX: 431.6, posY: 642.9, width: 36.8, height: 39.7, shape: "rect", points: [] },
  { code: "B30", categoryCode: "B", posX: 469.4, posY: 642.9, width: 36.5, height: 39.7, shape: "rect", points: [] },
  { code: "B31", categoryCode: "B", posX: 506.9, posY: 642.9, width: 36.8, height: 39.7, shape: "rect", points: [] },
  { code: "B32", categoryCode: "B", posX: 544.7, posY: 642.9, width: 36.8, height: 39.7, shape: "rect", points: [] },
  { code: "B33", categoryCode: "B", posX: 582.4, posY: 642.9, width: 36.8, height: 39.7, shape: "rect", points: [] },
  { code: "B34", categoryCode: "B", posX: 620.2, posY: 642.9, width: 36.8, height: 39.7, shape: "rect", points: [] },
  { code: "B35", categoryCode: "B", posX: 658.0, posY: 642.9, width: 36.8, height: 39.7, shape: "rect", points: [] },
  { code: "B36", categoryCode: "B", posX: 695.8, posY: 642.9, width: 36.8, height: 39.7, shape: "rect", points: [] },
  { code: "B37", categoryCode: "B", posX: 733.5, posY: 642.9, width: 36.8, height: 39.7, shape: "rect", points: [] },
  { code: "B38", categoryCode: "B", posX: 771.3, posY: 642.9, width: 36.8, height: 39.7, shape: "rect", points: [] },
  { code: "B39", categoryCode: "B", posX: 808.8, posY: 642.9, width: 36.8, height: 39.7, shape: "rect", points: [] },
  { code: "B40", categoryCode: "B", posX: 846.5, posY: 642.9, width: 37.5, height: 39.7, shape: "rect", points: [] },
  { code: "B41", categoryCode: "B", posX: 884.6, posY: 642.9, width: 36.8, height: 39.7, shape: "rect", points: [] },
  { code: "B19", categoryCode: "B", posX: 91.7, posY: 780.6, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "B18", categoryCode: "B", posX: 129.4, posY: 780.6, width: 37.1, height: 39.4, shape: "rect", points: [] },
  { code: "B17", categoryCode: "B", posX: 167.5, posY: 780.6, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "B16", categoryCode: "B", posX: 205.0, posY: 780.6, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "B15", categoryCode: "B", posX: 242.8, posY: 780.6, width: 37.1, height: 39.4, shape: "rect", points: [] },
  { code: "B14", categoryCode: "B", posX: 280.9, posY: 780.6, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "B13", categoryCode: "B", posX: 318.6, posY: 780.6, width: 36.5, height: 39.4, shape: "rect", points: [] },
  { code: "B12", categoryCode: "B", posX: 356.1, posY: 780.6, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "B11", categoryCode: "B", posX: 393.9, posY: 780.6, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "B10", categoryCode: "B", posX: 431.6, posY: 780.6, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "B9", categoryCode: "B", posX: 469.4, posY: 780.6, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "B8", categoryCode: "B", posX: 507.2, posY: 780.6, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "B7", categoryCode: "B", posX: 545.0, posY: 780.6, width: 37.1, height: 39.4, shape: "rect", points: [] },
  { code: "B6", categoryCode: "B", posX: 582.7, posY: 780.6, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "B5", categoryCode: "B", posX: 620.5, posY: 780.6, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "B4", categoryCode: "B", posX: 658.3, posY: 780.6, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "B3", categoryCode: "B", posX: 695.8, posY: 780.6, width: 37.1, height: 39.4, shape: "rect", points: [] },
  { code: "B2", categoryCode: "B", posX: 733.9, posY: 780.6, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "B1", categoryCode: "B", posX: 771.6, posY: 780.6, width: 36.8, height: 39.4, shape: "rect", points: [] },
  { code: "GA1", categoryCode: "GA", posX: 1028.0, posY: 222.6, width: 44.9, height: 47.4, shape: "rect", points: [] },
  { code: "GA2", categoryCode: "GA", posX: 1073.2, posY: 222.6, width: 44.6, height: 47.4, shape: "rect", points: [] },
  { code: "DA4", categoryCode: "DA", posX: 1028.0, posY: 271.0, width: 44.9, height: 47.4, shape: "rect", points: [] },
  { code: "G1", categoryCode: "G", posX: 1073.2, posY: 271.0, width: 44.6, height: 47.4, shape: "rect", points: [] },
  { code: "DA3", categoryCode: "DA", posX: 1028.0, posY: 319.4, width: 44.9, height: 47.4, shape: "rect", points: [] },
  { code: "G2", categoryCode: "G", posX: 1073.2, posY: 319.4, width: 44.6, height: 47.4, shape: "rect", points: [] },
  { code: "DA2", categoryCode: "DA", posX: 1028.0, posY: 367.7, width: 44.9, height: 47.4, shape: "rect", points: [] },
  { code: "G3", categoryCode: "G", posX: 1073.2, posY: 367.7, width: 44.6, height: 47.4, shape: "rect", points: [] },
  { code: "DA1", categoryCode: "DA", posX: 1028.0, posY: 416.1, width: 44.9, height: 47.4, shape: "rect", points: [] },
  { code: "G4", categoryCode: "G", posX: 1073.2, posY: 416.1, width: 44.6, height: 47.4, shape: "rect", points: [] },
  { code: "CA3", categoryCode: "CA", posX: 1028.0, posY: 464.5, width: 44.9, height: 47.4, shape: "rect", points: [] },
  { code: "CA2", categoryCode: "CA", posX: 1028.0, posY: 512.8, width: 44.9, height: 47.4, shape: "rect", points: [] },
  { code: "A9", categoryCode: "A-65k", posX: 1073.2, posY: 512.8, width: 44.6, height: 47.4, shape: "rect", points: [] },
  { code: "CA1", categoryCode: "CA", posX: 1028.0, posY: 561.2, width: 44.9, height: 47.4, shape: "rect", points: [] },
  { code: "A10", categoryCode: "A-65k", posX: 1073.2, posY: 561.2, width: 44.6, height: 47.4, shape: "rect", points: [] },
  { code: "AA5", categoryCode: "AA-70k", posX: 1028.0, posY: 609.6, width: 44.9, height: 47.4, shape: "rect", points: [] },
  { code: "AA4", categoryCode: "AA-70k", posX: 1073.2, posY: 609.6, width: 44.6, height: 47.4, shape: "rect", points: [] },
  { code: "G5", categoryCode: "G", posX: 1179.1, posY: 233.8, width: 43.9, height: 47.4, shape: "rect", points: [] },
  { code: "G6", categoryCode: "G", posX: 1179.1, posY: 282.2, width: 43.9, height: 47.4, shape: "rect", points: [] },
  { code: "GA3", categoryCode: "GA", posX: 1179.1, posY: 330.6, width: 43.9, height: 47.4, shape: "rect", points: [] },
  { code: "H6", categoryCode: "H-22k", posX: 1227.5, posY: 187.1, width: 29.4, height: 31.4, shape: "rect", points: [] },
  { code: "H5", categoryCode: "H-22k", posX: 1227.5, posY: 219.4, width: 29.4, height: 31.4, shape: "rect", points: [] },
  { code: "H4", categoryCode: "H-22k", posX: 1227.5, posY: 251.8, width: 29.4, height: 31.1, shape: "rect", points: [] },
  { code: "H3", categoryCode: "H-22k", posX: 1227.5, posY: 283.8, width: 29.4, height: 31.4, shape: "rect", points: [] },
  { code: "H2", categoryCode: "H-22k", posX: 1227.5, posY: 316.2, width: 29.4, height: 31.1, shape: "rect", points: [] },
  { code: "H1", categoryCode: "H-22k", posX: 1227.5, posY: 348.2, width: 29.4, height: 31.4, shape: "rect", points: [] },
  { code: "H7", categoryCode: "H-22k", posX: 1304.7, posY: 204.7, width: 29.1, height: 31.1, shape: "rect", points: [] },
  { code: "H8", categoryCode: "H-22k", posX: 1304.7, posY: 236.7, width: 29.1, height: 31.4, shape: "rect", points: [] },
  { code: "H9", categoryCode: "H-22k", posX: 1304.7, posY: 269.1, width: 29.1, height: 31.4, shape: "rect", points: [] },
  { code: "H10", categoryCode: "H-22k", posX: 1304.7, posY: 301.4, width: 29.1, height: 31.4, shape: "rect", points: [] },
  { code: "H11", categoryCode: "H-22k", posX: 1304.7, posY: 333.8, width: 29.1, height: 31.4, shape: "rect", points: [] },
  { code: "H12", categoryCode: "H-22k", posX: 1304.7, posY: 366.1, width: 29.1, height: 31.1, shape: "rect", points: [] },
  { code: "H13", categoryCode: "H-20k", posX: 1334.7, posY: 204.7, width: 29.1, height: 31.1, shape: "rect", points: [] },
  { code: "H14", categoryCode: "H-20k", posX: 1334.7, posY: 236.7, width: 29.1, height: 31.4, shape: "rect", points: [] },
  { code: "H15", categoryCode: "H-20k", posX: 1334.7, posY: 269.1, width: 29.1, height: 31.4, shape: "rect", points: [] },
  { code: "H16", categoryCode: "H-20k", posX: 1334.7, posY: 301.4, width: 29.1, height: 31.4, shape: "rect", points: [] },
  { code: "H17", categoryCode: "H-20k", posX: 1334.7, posY: 333.8, width: 29.1, height: 31.4, shape: "rect", points: [] },
  { code: "H18", categoryCode: "H-20k", posX: 1334.7, posY: 366.1, width: 29.1, height: 31.1, shape: "rect", points: [] },
  { code: "A4", categoryCode: "A-65k", posX: 1226.9, posY: 466.1, width: 44.6, height: 47.4, shape: "rect", points: [] },
  { code: "A3", categoryCode: "A-65k", posX: 1272.4, posY: 466.1, width: 44.6, height: 47.1, shape: "rect", points: [] },
  { code: "A2", categoryCode: "A-65k", posX: 1317.9, posY: 466.1, width: 44.2, height: 47.4, shape: "rect", points: [] },
  { code: "A1", categoryCode: "A1", posX: 1363.1, posY: 465.7, width: 37.1, height: 47.4, shape: "rect", points: [] },
  { code: "AA3", categoryCode: "AA-70k", posX: 1178.8, posY: 576.6, width: 44.2, height: 47.7, shape: "rect", points: [] },
  { code: "AA2", categoryCode: "AA-75k", posX: 1227.2, posY: 576.6, width: 44.9, height: 47.7, shape: "rect", points: [] },
  { code: "AA1", categoryCode: "AA-75k", posX: 1363.1, posY: 576.6, width: 44.9, height: 47.7, shape: "rect", points: [] },
  { code: "A11", categoryCode: "A11", posX: 1178.8, posY: 624.9, width: 44.2, height: 40.4, shape: "rect", points: [] },
  { code: "A8", categoryCode: "A-65k", posX: 1227.5, posY: 624.9, width: 44.6, height: 47.4, shape: "rect", points: [] },
  { code: "A5", categoryCode: "A-65k", posX: 1363.1, posY: 624.9, width: 44.6, height: 47.4, shape: "rect", points: [] },
  { code: "A7", categoryCode: "A-65k", posX: 1227.5, posY: 673.6, width: 44.6, height: 47.1, shape: "rect", points: [] },
  { code: "A6", categoryCode: "A-65k", posX: 1363.1, posY: 673.6, width: 44.6, height: 47.1, shape: "rect", points: [] },
  { code: "S14", categoryCode: "S14", posX: 30.0, posY: 140.0, width: 104.9, height: 165.6, shape: "poly", points: [30.0, 140.0, 30.0, 305.3, 113.0, 305.6, 113.0, 184.8, 134.9, 184.2, 134.9, 140.0] },
  { code: "S12", categoryCode: "S12", posX: 30.0, posY: 306.6, width: 83.0, height: 84.8, shape: "poly", points: [113.0, 306.6, 30.0, 306.9, 30.3, 391.4, 66.5, 391.4, 66.5, 346.0, 113.0, 345.6] },
  { code: "S11", categoryCode: "S11", posX: 30.0, posY: 392.4, width: 83.0, height: 82.3, shape: "poly", points: [30.3, 392.4, 30.0, 474.4, 113.0, 474.7, 113.0, 435.6, 66.8, 435.3, 66.5, 392.7] },
  { code: "S9", categoryCode: "S9", posX: 30.0, posY: 475.7, width: 83.0, height: 82.6, shape: "poly", points: [30.0, 558.3, 66.5, 558.3, 66.8, 515.1, 113.0, 515.1, 113.0, 475.7, 30.0, 476.0] },
  { code: "S8", categoryCode: "S8", posX: 30.0, posY: 559.6, width: 83.0, height: 82.3, shape: "poly", points: [30.3, 559.6, 30.0, 641.6, 113.0, 641.9, 113.0, 602.5, 67.1, 602.5, 66.5, 559.6] },
  { code: "S6", categoryCode: "S6", posX: 30.3, posY: 642.9, width: 59.8, height: 93.2, shape: "poly", points: [30.6, 642.9, 30.3, 735.8, 65.8, 736.1, 66.2, 682.6, 90.1, 682.3, 90.1, 643.2] },
  { code: "S5", categoryCode: "S5", posX: 30.0, posY: 737.0, width: 60.7, height: 60.6, shape: "poly", points: [30.3, 737.0, 30.0, 797.6, 90.7, 797.6, 90.7, 780.6, 66.2, 780.0, 66.2, 737.0] },
  { code: "S13", categoryCode: "S13", posX: 922.4, posY: 266.2, width: 36.8, height: 79.8, shape: "rect", points: [] },
  { code: "S10", categoryCode: "S10", posX: 922.4, posY: 435.6, width: 36.8, height: 79.8, shape: "rect", points: [] },
  { code: "S7", categoryCode: "S7", posX: 922.4, posY: 602.5, width: 36.8, height: 80.1, shape: "rect", points: [] },
  { code: "S4", categoryCode: "S4", posX: 809.1, posY: 780.6, width: 196.3, height: 39.1, shape: "poly", points: [809.1, 780.6, 809.1, 819.7, 816.5, 819.7, 817.2, 798.2, 896.9, 798.2, 897.5, 819.7, 936.6, 819.7, 936.6, 811.7, 953.1, 819.7, 978.3, 811.7, 980.5, 819.7, 1005.4, 819.7, 1005.4, 780.6] },
  { code: "S15", categoryCode: "S15", posX: 1006.4, posY: 140.0, width: 216.3, height: 92.6, shape: "poly", points: [1006.4, 174.3, 1006.4, 184.8, 1178.8, 184.2, 1179.1, 232.6, 1222.7, 232.6, 1222.7, 140.0, 1122.9, 140.0, 1117.7, 174.3] },
  { code: "S2", categoryCode: "S2", posX: 1073.2, posY: 464.5, width: 125.3, height: 47.4, shape: "rect", points: [] },
  { code: "S17", categoryCode: "S17", posX: 1304.7, posY: 172.4, width: 59.1, height: 31.4, shape: "rect", points: [] },
  { code: "S16", categoryCode: "S16", posX: 1274.0, posY: 398.2, width: 59.4, height: 66.6, shape: "poly", points: [1333.4, 398.2, 1304.7, 398.2, 1304.0, 430.5, 1274.0, 430.5, 1274.3, 464.8, 1333.4, 464.5] },
  { code: "S18", categoryCode: "S18", posX: 1334.7, posY: 398.2, width: 59.1, height: 66.6, shape: "poly", points: [1334.7, 398.2, 1334.7, 464.5, 1393.8, 464.8, 1393.8, 430.5, 1364.1, 430.5, 1363.4, 398.2] },
  { code: "S3", categoryCode: "S3", posX: 1073.2, posY: 666.3, width: 149.5, height: 93.8, shape: "poly", points: [1222.7, 666.3, 1178.4, 666.6, 1177.8, 713.0, 1073.2, 713.0, 1073.2, 759.8, 1222.4, 760.1] },
  { code: "S1", categoryCode: "S1", posX: 1227.5, posY: 721.7, width: 180.2, height: 98.3, shape: "rect", points: [] },
];

// Non-interactive floor-plan furniture, ported from the mockup's `decor` template
// (hall outline, inner boundary, aisle dashes, stair blocks, entry/exit arrows, labels).
export interface LayoutDecor {
  kind: "WALL" | "AISLE" | "STAIRS" | "LABEL" | "ARROW";
  posX?: number;
  posY?: number;
  width?: number;
  height?: number;
  text?: string;
  points?: number[];
}

export const DECOR: LayoutDecor[] = [
  { kind: "WALL", posX: 22, posY: 126, width: 1400, height: 700 },
  { kind: "WALL", posX: 60, posY: 200, width: 900, height: 560 },
  { kind: "AISLE", points: [100, 225, 960, 225] },
  { kind: "AISLE", points: [100, 390, 1000, 390] },
  { kind: "AISLE", points: [100, 545, 1000, 545] },
  { kind: "AISLE", points: [100, 715, 1000, 715] },
  { kind: "STAIRS", posX: 478, posY: 150, width: 52, height: 34 },
  { kind: "STAIRS", posX: 1005, posY: 138, width: 95, height: 32 },
  { kind: "STAIRS", posX: 812, posY: 778, width: 88, height: 42 },
  { kind: "STAIRS", posX: 1000, posY: 760, width: 150, height: 60 },
  { kind: "ARROW", points: [1402.5, 444, 1454.2, 444], text: "EXIT" },
  { kind: "ARROW", points: [1460.6, 546.5, 1370.2, 546.5], text: "ENTRY" },
  { kind: "LABEL", posX: 1240, posY: 640, text: "PORTICO 16.00 x 8.20" },
  { kind: "LABEL", posX: 60, posY: 836, text: "MURAL" },
  { kind: "LABEL", posX: 300, posY: 836, text: "MURAL" },
  { kind: "LABEL", posX: 540, posY: 836, text: "MURAL" },
  { kind: "LABEL", posX: 760, posY: 836, text: "MURAL" },
  { kind: "LABEL", posX: 26, posY: 104, text: "NORTH WALL — B2" },
];
