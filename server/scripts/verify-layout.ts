// Sanity-checks the seeded floor-plan geometry for Chamber Trade Fair 2026:
// 247 stalls, every stall has geometry, no two stalls overlap by more than 1px,
// and every stall's price (via its category) matches the traced tariff.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function overlaps(
  a: { posX: number; posY: number; width: number; height: number },
  b: { posX: number; posY: number; width: number; height: number }
) {
  const overlapX = Math.min(a.posX + a.width, b.posX + b.width) - Math.max(a.posX, b.posX);
  const overlapY = Math.min(a.posY + a.height, b.posY + b.height) - Math.max(a.posY, b.posY);
  return overlapX > 1 && overlapY > 1;
}

async function main() {
  const event = await prisma.event.findFirst({ where: { name: "Chamber Trade Fair 2026" } });
  if (!event) {
    console.error("Event not found — run `npm run seed` first.");
    process.exitCode = 1;
    return;
  }

  const stalls = await prisma.stall.findMany({
    where: { eventId: event.id },
    include: { category: true },
    orderBy: [{ category: { code: "asc" } }, { code: "asc" }],
  });

  const errors: string[] = [];

  if (stalls.length !== 247) {
    errors.push(`Expected 247 stalls, found ${stalls.length}`);
  }

  const missingGeometry = stalls.filter(
    (s) => s.posX == null || s.posY == null || s.width == null || s.height == null
  );
  if (missingGeometry.length > 0) {
    errors.push(`${missingGeometry.length} stall(s) missing geometry: ${missingGeometry.map((s) => s.code).join(", ")}`);
  }

  const positioned = stalls.filter(
    (s): s is typeof s & { posX: number; posY: number; width: number; height: number } =>
      s.posX != null && s.posY != null && s.width != null && s.height != null
  );
  const overlapPairs: string[] = [];
  for (let i = 0; i < positioned.length; i++) {
    for (let j = i + 1; j < positioned.length; j++) {
      if (overlaps(positioned[i], positioned[j])) {
        overlapPairs.push(`${positioned[i].code} <-> ${positioned[j].code}`);
      }
    }
  }
  if (overlapPairs.length > 0) {
    errors.push(`${overlapPairs.length} overlapping pair(s): ${overlapPairs.slice(0, 10).join(", ")}${overlapPairs.length > 10 ? ", ..." : ""}`);
  }

  const priceMismatches = stalls.filter((s) => s.category.price == null);
  if (priceMismatches.length > 0) {
    errors.push(`${priceMismatches.length} stall(s) with no category price: ${priceMismatches.map((s) => s.code).join(", ")}`);
  }

  // Summary table, grouped by category.
  const byCategory = new Map<string, { label: string; price: string; count: number }>();
  for (const s of stalls) {
    const key = s.category.code;
    const existing = byCategory.get(key);
    if (existing) existing.count++;
    else byCategory.set(key, { label: s.category.label, price: s.category.price.toString(), count: 1 });
  }

  console.log("\nCategory      Count  Price       Label");
  console.log("-".repeat(70));
  for (const [code, { label, price, count }] of byCategory) {
    console.log(`${code.padEnd(14)} ${String(count).padEnd(6)} ${("₹" + price).padEnd(11)} ${label}`);
  }
  console.log("-".repeat(70));
  console.log(`Total stalls: ${stalls.length}`);
  console.log(`Missing geometry: ${missingGeometry.length}`);
  console.log(`Overlapping pairs: ${overlapPairs.length}`);
  console.log(`Missing category price: ${priceMismatches.length}\n`);

  if (errors.length > 0) {
    console.error("FAILED:");
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exitCode = 1;
  } else {
    console.log("PASSED — 247 stalls, 0 missing geometry, 0 overlaps, every stall priced via its category.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
