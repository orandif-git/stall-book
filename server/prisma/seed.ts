import "dotenv/config";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { uniqueEventSlug } from "../src/lib/slug.js";

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Category price bands transcribed from the Chamber Trade Fair 2026 legend.
// Ranges are rendered as a simple sequential grid (schematic, not pixel-matched to the JPG) —
// admins can regenerate/adjust stall positions later via the bulk-generate API/UI.
const rangeCategories = [
  { code: "AA-75k", label: "3M x 3M (AA1 to AA2)", size: "3M x 3M", price: 75000, prefix: "AA", from: 1, to: 2 },
  { code: "AA-70k", label: "3M x 3M (AA3 to AA5)", size: "3M x 3M", price: 70000, prefix: "AA", from: 3, to: 5 },
  { code: "A1", label: "2.5M x 3M (A1)", size: "2.5M x 3M", price: 56000, prefix: "A", from: 1, to: 1 },
  { code: "A-65k", label: "3M x 3M (A2 to A10)", size: "3M x 3M", price: 65000, prefix: "A", from: 2, to: 10 },
  { code: "A11", label: "2.5M x 3M (A11)", size: "2.5M x 3M", price: 52000, prefix: "A", from: 11, to: 11 },
  { code: "B", label: "2.5M x 2.5M (B1 to B41)", size: "2.5M x 2.5M", price: 46000, prefix: "B", from: 1, to: 41 },
  { code: "CA", label: "3M x 3M (CA1 to CA3)", size: "3M x 3M", price: 60000, prefix: "CA", from: 1, to: 3 },
  { code: "C", label: "2.5M x 2.5M (C1 to C38)", size: "2.5M x 2.5M", price: 43000, prefix: "C", from: 1, to: 38 },
  { code: "CB", label: "2M x 2.5M (CB1 to CB6)", size: "2M x 2.5M", price: 33000, prefix: "CB", from: 1, to: 6 },
  { code: "D", label: "2.5M x 2.5M (D1 to D34)", size: "2.5M x 2.5M", price: 40000, prefix: "D", from: 1, to: 34 },
  { code: "DA", label: "3M x 3M (DA1 to DA4)", size: "3M x 3M", price: 55000, prefix: "DA", from: 1, to: 4 },
  { code: "DB", label: "2M x 2.5M (DB1 to DB11)", size: "2M x 2.5M", price: 31000, prefix: "DB", from: 1, to: 11 },
  { code: "E", label: "2.5M x 2.5M (E1 to E15)", size: "2.5M x 2.5M", price: 36000, prefix: "E", from: 1, to: 15 },
  { code: "EB", label: "2M x 2.5M (EB1 to EB8)", size: "2M x 2.5M", price: 27000, prefix: "EB", from: 1, to: 8 },
  { code: "F", label: "2M x 2M (F1 to F26)", size: "2M x 2M", price: 25000, prefix: "F", from: 1, to: 26 },
  { code: "GA", label: "3M x 3M (GA1 to GA3)", size: "3M x 3M", price: 60000, prefix: "GA", from: 1, to: 3 },
  { code: "G", label: "3M x 3M (G1 to G6)", size: "3M x 3M", price: 50000, prefix: "G", from: 1, to: 6 },
  { code: "H-22k", label: "2M x 2M (H1 to H12)", size: "2M x 2M", price: 22000, prefix: "H", from: 1, to: 12 },
  { code: "H-20k", label: "2M x 2M (H13 to H18)", size: "2M x 2M", price: 20000, prefix: "H", from: 13, to: 18 },
];

// Named halls/zones (S1-S18) — each is its own stall(s), sized in sqft rather than a range.
const zoneCategories = [
  { code: "S1", label: "780 Sqft (S1)", price: 400000, codes: ["S1"] },
  { code: "S2", label: "270 Sqft (S2)", price: 150000, codes: ["S2"] },
  { code: "S3", label: "410 Sqft (S3)", price: 200000, codes: ["S3"] },
  { code: "S4", label: "320 Sqft (S4)", price: 200000, codes: ["S4"] },
  { code: "S5", label: "92 Sqft (S5)", price: 65000, codes: ["S5"] },
  { code: "S6", label: "153 Sqft (S6)", price: 80000, codes: ["S6"] },
  { code: "S7", label: "128 Sqft (S7)", price: 110000, codes: ["S7"] },
  { code: "S8_S9", label: "208 Sqft (S8, S9)", price: 110000, codes: ["S8", "S9"] },
  { code: "S10", label: "128 Sqft (S10)", price: 100000, codes: ["S10"] },
  { code: "S11_S12", label: "208 Sqft (S11, S12)", price: 100000, codes: ["S11", "S12"] },
  { code: "S13", label: "128 Sqft (S13)", price: 90000, codes: ["S13"] },
  { code: "S14", label: "648 Sqft (S14)", price: 220000, codes: ["S14"] },
  { code: "S15", label: "355 Sqft (S15)", price: 140000, codes: ["S15"] },
  { code: "S16", label: "114 Sqft (S16)", price: 45000, codes: ["S16"] },
  { code: "S17", label: "78 Sqft (S17)", price: 40000, codes: ["S17"] },
  { code: "S18", label: "114 Sqft (S18)", price: 40000, codes: ["S18"] },
];

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@stallbooking.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "changeme123";

  const admin = await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: "Admin",
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 10),
      role: "SUPER_ADMIN",
    },
  });

  const name = "Chamber Trade Fair 2026";
  const event = await prisma.event.create({
    data: {
      name,
      slug: await uniqueEventSlug(name),
      venue: "Tamukkam Convention Centre",
      startDate: new Date("2026-12-24"),
      endDate: new Date("2026-12-28"),
    },
  });

  // Seed the layout photo too, so a fresh deploy has it attached from the start
  // instead of requiring a manual upload from Setup.
  const layoutSource = path.resolve(__dirname, "../../Stall Layout.jpg");
  if (fs.existsSync(layoutSource)) {
    const uploadsDir = path.resolve(__dirname, "../uploads");
    fs.mkdirSync(uploadsDir, { recursive: true });
    const filename = `${event.id}-seed.jpg`;
    fs.copyFileSync(layoutSource, path.join(uploadsDir, filename));
    await prisma.event.update({ where: { id: event.id }, data: { layoutImageUrl: `/uploads/${filename}` } });
  }

  let gridRow = 0;
  for (const rc of rangeCategories) {
    gridRow++;
    const category = await prisma.category.create({
      data: {
        eventId: event.id,
        code: rc.code,
        label: rc.label,
        size: rc.size,
        price: rc.price,
      },
    });

    const stalls = [];
    for (let n = rc.from; n <= rc.to; n++) {
      stalls.push({
        eventId: event.id,
        categoryId: category.id,
        code: `${rc.prefix}${n}`,
        zone: rc.prefix,
        gridRow,
        gridCol: n - rc.from + 1,
      });
    }
    await prisma.stall.createMany({ data: stalls, skipDuplicates: true });
  }

  for (const zc of zoneCategories) {
    gridRow++;
    const category = await prisma.category.create({
      data: {
        eventId: event.id,
        code: zc.code,
        label: zc.label,
        price: zc.price,
      },
    });

    await prisma.stall.createMany({
      data: zc.codes.map((code, i) => ({
        eventId: event.id,
        categoryId: category.id,
        code,
        zone: "S",
        gridRow,
        gridCol: i + 1,
      })),
      skipDuplicates: true,
    });
  }

  const stallCount = await prisma.stall.count({ where: { eventId: event.id } });
  console.log(`Seeded event "${event.name}" with ${stallCount} stalls.`);
  console.log(`Admin login: ${admin.email} / ${adminPassword}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
