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

export const STALLS: LayoutStall[] = [];
function add(code: string, x: number, y: number, w: number, h: number, categoryCode: string) {
  STALLS.push({ code, categoryCode, posX: x, posY: y, width: w, height: h, shape: "rect", points: [] });
}
function strip(codes: string[], x0: number, y: number, w: number, h: number, step: number, categoryCode: string) {
  codes.forEach((code, i) => add(code, x0 + i * step, y, w, h, categoryCode));
}
function seq(prefix: string, a: number, b: number): string[] {
  const out: string[] = [];
  const d = a <= b ? 1 : -1;
  for (let i = a; d > 0 ? i <= b : i >= b; i += d) out.push(`${prefix}${i}`);
  return out;
}

/* Row F — north wall */
strip(seq("F", 1, 11), 137, 155, 29, 28, 31, "F");
strip(seq("F", 12, 26), 540, 155, 29, 28, 30.5, "F");
/* Row EB / E */
strip(seq("EB", 8, 1), 108, 262, 29, 43, 31, "EB");
strip(seq("E", 15, 1), 356, 262, 36, 43, 37.5, "E");
/* Row DB / D20-34 */
strip(["DB4", "DB7", "DB6", "DB5", "DB8", "DB9", "DB10", "DB11"], 108, 308, 29, 42, 31, "DB");
strip(seq("D", 20, 34), 356, 308, 36, 42, 37.5, "D");
/* Row DB3-1 / D19-1 */
strip(seq("DB", 3, 1), 108, 428, 29, 42, 31, "DB");
strip(seq("D", 19, 1), 205, 428, 36, 42, 37.5, "D");
/* Row CB4-6 / C20-38 */
strip(seq("CB", 4, 6), 108, 472, 29, 42, 31, "CB");
strip(seq("C", 20, 38), 205, 472, 36, 42, 37.5, "C");
/* Row CB3-1 / C19-1 */
strip(seq("CB", 3, 1), 108, 590, 29, 42, 31, "CB");
strip(seq("C", 19, 1), 205, 590, 36, 42, 37.5, "C");
/* Row B20-41 and B19-1 */
strip(seq("B", 20, 41), 95, 645, 36, 42, 37.5, "B");
strip(seq("B", 19, 1), 95, 778, 35, 42, 37.5, "B");
/* East island: GA / DA / G / CA / A / AA */
add("GA1", 1025, 222, 50, 42, "GA");
add("GA2", 1078, 222, 48, 42, "GA");
add("DA4", 1025, 268, 50, 42, "DA");
add("G1", 1078, 268, 48, 42, "G");
add("DA3", 1025, 314, 50, 42, "DA");
add("G2", 1078, 314, 48, 42, "G");
add("DA2", 1025, 360, 50, 42, "DA");
add("G3", 1078, 360, 48, 42, "G");
add("DA1", 1025, 406, 50, 42, "DA");
add("G4", 1078, 406, 48, 42, "G");
add("CA3", 1025, 458, 50, 44, "CA");
add("CA2", 1025, 508, 50, 44, "CA");
add("A9", 1078, 508, 48, 44, "A-65k");
add("CA1", 1025, 556, 50, 44, "CA");
add("A10", 1078, 556, 48, 44, "A-65k");
add("AA5", 1025, 604, 50, 44, "AA-70k");
add("AA4", 1078, 604, 48, 44, "AA-70k");
add("G5", 1180, 265, 42, 38, "G");
add("G6", 1180, 307, 42, 38, "G");
add("GA3", 1180, 349, 42, 38, "GA");
/* H columns */
["H6", "H5", "H4", "H3", "H2", "H1"].forEach((code, i) => add(code, 1226, 185 + i * 34, 32, 32, "H-22k"));
["H7", "H8", "H9", "H10", "H11", "H12"].forEach((code, i) => add(code, 1300, 200 + i * 34, 36, 30, "H-22k"));
["H13", "H14", "H15", "H16", "H17", "H18"].forEach((code, i) => add(code, 1338, 200 + i * 34, 36, 30, "H-20k"));
/* A block near entry */
add("A4", 1226, 470, 46, 44, "A-65k");
add("A3", 1274, 470, 46, 44, "A-65k");
add("A2", 1322, 470, 40, 44, "A-65k");
add("A1", 1364, 470, 44, 44, "A1");
add("AA3", 1180, 580, 44, 42, "AA-70k");
add("AA2", 1226, 580, 46, 42, "AA-75k");
add("AA1", 1358, 580, 50, 42, "AA-75k");
add("A11", 1180, 624, 44, 44, "A11");
add("A8", 1230, 616, 46, 48, "A-65k");
add("A5", 1358, 624, 50, 48, "A-65k");
add("A7", 1230, 668, 46, 48, "A-65k");
add("A6", 1358, 676, 50, 44, "A-65k");
/* Premium S-blocks */
const SPOS: Record<string, [number, number, number, number]> = {
  S14: [30, 145, 75, 110],
  S12: [30, 290, 75, 60],
  S11: [30, 412, 75, 50],
  S9: [30, 470, 75, 55],
  S8: [30, 558, 75, 62],
  S6: [30, 652, 75, 50],
  S5: [30, 742, 75, 42],
  S13: [922, 262, 34, 88],
  S10: [925, 428, 46, 84],
  S7: [925, 590, 46, 90],
  S4: [905, 778, 86, 42],
  S15: [1145, 140, 75, 90],
  S2: [1078, 458, 120, 48],
  S17: [1300, 170, 74, 26],
  S16: [1285, 412, 50, 50],
  S18: [1338, 398, 52, 64],
  S3: [1075, 700, 145, 55],
  S1: [1226, 730, 180, 80],
};
Object.entries(SPOS).forEach(([code, [x, y, w, h]]) => add(code, x, y, w, h, code));

// S3 is not actually rectangular in the real drawing (Stall Layout.jpg) — it's an L-shape
// wedged between A11/A7/A8 and the entrance ramp. Traced via color-contour detection against
// the source photo (not eyeballed), then re-fit to S3's existing bounding box above so the
// shape is accurate without shifting anything and risking new overlaps with its neighbors.
// S5 and S6, which looked similar at a glance, were checked the same way and are genuinely
// plain rectangles — left as-is.
const s3 = STALLS.find((s) => s.code === "S3")!;
s3.shape = "poly";
s3.points = [1219, 701, 1177, 701, 1176, 728, 1077, 727, 1076, 754, 1218, 754];

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
  { kind: "ARROW", points: [1424, 415, 1484, 415], text: "EXIT" },
  { kind: "ARROW", points: [1484, 530, 1424, 530], text: "ENTRY" },
  { kind: "LABEL", posX: 1240, posY: 640, text: "PORTICO 16.00 x 8.20" },
  { kind: "LABEL", posX: 60, posY: 836, text: "MURAL" },
  { kind: "LABEL", posX: 300, posY: 836, text: "MURAL" },
  { kind: "LABEL", posX: 540, posY: 836, text: "MURAL" },
  { kind: "LABEL", posX: 760, posY: 836, text: "MURAL" },
  { kind: "LABEL", posX: 26, posY: 104, text: "NORTH WALL — B2" },
];
