import "dotenv/config";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { uniqueEventSlug } from "../src/lib/slug.js";
import { CATEGORIES, STALLS, DECOR, type LayoutStall } from "./seeds/ctf2026-layout.js";

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  let event = await prisma.event.findFirst({ where: { name } });
  if (!event) {
    event = await prisma.event.create({
      data: {
        name,
        slug: await uniqueEventSlug(name),
        venue: "Tamukkam Convention Centre",
        startDate: new Date("2026-12-24"),
        endDate: new Date("2026-12-28"),
      },
    });
  }

  // Seed the layout photo too, so a fresh deploy has it attached from the start
  // instead of requiring a manual upload from Setup. Skip if already set (re-running
  // the seed shouldn't re-copy/overwrite an image an admin may have replaced since).
  if (!event.layoutImageUrl) {
    const layoutSource = path.resolve(__dirname, "../../Stall Layout.jpg");
    if (fs.existsSync(layoutSource)) {
      const uploadsDir = path.resolve(__dirname, "../uploads");
      fs.mkdirSync(uploadsDir, { recursive: true });
      const filename = `${event.id}-seed.jpg`;
      fs.copyFileSync(layoutSource, path.join(uploadsDir, filename));
      event = await prisma.event.update({ where: { id: event.id }, data: { layoutImageUrl: `/uploads/${filename}` } });
    }
  }

  // Categories — idempotent upsert on (eventId, code).
  const categoryIdByCode = new Map<string, string>();
  for (const c of CATEGORIES) {
    const category = await prisma.category.upsert({
      where: { eventId_code: { eventId: event.id, code: c.code } },
      update: { label: c.label, size: c.size, price: c.price, colorHex: c.colorHex },
      create: { eventId: event.id, code: c.code, label: c.label, size: c.size, price: c.price, colorHex: c.colorHex },
    });
    categoryIdByCode.set(c.code, category.id);
  }

  // Stalls — idempotent upsert on (eventId, code). gridRow is one per category (same
  // order as CATEGORIES); gridCol is 1..N within a category sorted by the stall code's
  // numeric suffix — this reproduces exactly what the pre-existing schematic seed
  // produced, so the grid view's row/column order is unchanged even though this
  // module's stall insertion order (grouped by physical layout section, not category)
  // differs from before.
  const stallsByCategory = new Map<string, LayoutStall[]>();
  for (const s of STALLS) {
    const arr = stallsByCategory.get(s.categoryCode) ?? [];
    arr.push(s);
    stallsByCategory.set(s.categoryCode, arr);
  }

  let gridRow = 0;
  for (const c of CATEGORIES) {
    gridRow++;
    const categoryId = categoryIdByCode.get(c.code)!;
    const members = (stallsByCategory.get(c.code) ?? []).slice().sort((a, b) => {
      const na = Number(a.code.match(/(\d+)$/)?.[1] ?? 0);
      const nb = Number(b.code.match(/(\d+)$/)?.[1] ?? 0);
      return na - nb;
    });
    for (let i = 0; i < members.length; i++) {
      const s = members[i];
      await prisma.stall.upsert({
        where: { eventId_code: { eventId: event.id, code: s.code } },
        update: {
          categoryId,
          zone: c.code,
          gridRow,
          gridCol: i + 1,
          posX: s.posX,
          posY: s.posY,
          width: s.width,
          height: s.height,
          shape: s.shape,
          points: s.points,
        },
        create: {
          eventId: event.id,
          categoryId,
          code: s.code,
          zone: c.code,
          gridRow,
          gridCol: i + 1,
          posX: s.posX,
          posY: s.posY,
          width: s.width,
          height: s.height,
          shape: s.shape,
          points: s.points,
        },
      });
    }
  }

  // S8/S9 and S11/S12 used to be combined categories (S8_S9, S11_S12) before this split
  // into four independent stalls each carrying their own full price. Every stall now
  // points at its new category (upserted above), so the old combined ones are orphaned
  // and safe to remove.
  await prisma.category.deleteMany({ where: { eventId: event.id, code: { in: ["S8_S9", "S11_S12"] } } });

  // Decor has no natural unique key (it's not user-editable data) — clear and recreate
  // each run so re-seeding after a DECOR edit doesn't leave stale rows behind.
  await prisma.floorPlanDecor.deleteMany({ where: { eventId: event.id } });
  await prisma.floorPlanDecor.createMany({
    data: DECOR.map((d) => ({
      eventId: event!.id,
      kind: d.kind,
      posX: d.posX,
      posY: d.posY,
      width: d.width,
      height: d.height,
      text: d.text,
      points: d.points ?? [],
    })),
  });

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
