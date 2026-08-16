// Copies the root "Stall Layout.jpg" into uploads/ under a fresh, cache-busting filename and
// points the Chamber Trade Fair 2026 event's layoutImageUrl at it.
//
//   npm run refresh:layout-photo
//
// Why this exists as its own script rather than relying on `npm run seed`: seed.ts deliberately
// skips setting layoutImageUrl once it's already set, so a re-seed never clobbers an admin's own
// manual upload. That's correct in general, but means swapping in a *new* reference photo (e.g.
// after re-measuring stall geometry against an updated source drawing — see the precise STALLS
// data in prisma/seeds/ctf2026-layout.ts) needs an explicit step. Reusing the same in-place
// filename would leave browsers that already cached the old image showing it stretched to the
// new photo's aspect ratio — a fresh filename avoids that entirely, no cache-header tuning
// needed. Safe to re-run: each run just points at one more fresh copy and removes the one it
// replaced.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const event = await prisma.event.findFirst({ where: { slug: "chamber-trade-fair-2026" } });
  if (!event) {
    console.log('No event with slug "chamber-trade-fair-2026" found — nothing to do.');
    return;
  }

  const source = path.resolve(__dirname, "../../Stall Layout.jpg");
  if (!fs.existsSync(source)) {
    throw new Error(`Expected the reference photo at ${source} — did the repo checkout include it?`);
  }

  const uploadsDir = path.resolve(__dirname, "../uploads");
  fs.mkdirSync(uploadsDir, { recursive: true });
  const filename = `${event.id}-${Date.now()}.jpg`;
  fs.copyFileSync(source, path.join(uploadsDir, filename));

  const previousUrl = event.layoutImageUrl;
  await prisma.event.update({ where: { id: event.id }, data: { layoutImageUrl: `/uploads/${filename}` } });
  console.log(`${event.name}: layoutImageUrl -> /uploads/${filename}`);

  if (previousUrl && previousUrl.startsWith("/uploads/")) {
    const previousPath = path.resolve(__dirname, "..", previousUrl.replace(/^\//, ""));
    if (fs.existsSync(previousPath)) {
      fs.unlinkSync(previousPath);
      console.log(`Removed superseded photo: ${previousUrl}`);
    }
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
