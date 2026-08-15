// One-time-per-deploy backfill: assigns a reference (e.g. "MC-26-00001") to every existing
// Booking/Hold that predates the reference-number feature (server/src/lib/reference.ts).
// Idempotent — only touches rows where reference IS NULL, so it's safe to run more than once;
// a second run finds nothing left to do. Run manually after applying migrations on a database
// that already has bookings/holds from before this feature existed:
//
//   npm run backfill:references
//
// Ordering: per event, all not-yet-referenced bookings and holds are combined and sorted by
// createdAt (oldest first), then assigned sequentially through the same atomic per-event
// counter new records use going forward — so backfilled numbers slot in before any reference
// already issued after this feature shipped, and nothing collides.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { nextReference } from "../src/lib/reference.js";

const prisma = new PrismaClient();

async function main() {
  const events = await prisma.event.findMany();
  let totalBackfilled = 0;

  for (const event of events) {
    const [bookings, holds] = await Promise.all([
      prisma.booking.findMany({ where: { eventId: event.id, reference: null }, orderBy: { createdAt: "asc" } }),
      prisma.hold.findMany({ where: { eventId: event.id, reference: null }, orderBy: { createdAt: "asc" } }),
    ]);

    const combined = [
      ...bookings.map((b) => ({ kind: "booking" as const, id: b.id, createdAt: b.createdAt, name: b.exhibitorName })),
      ...holds.map((h) => ({ kind: "hold" as const, id: h.id, createdAt: h.createdAt, name: h.exhibitorName })),
    ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    if (combined.length === 0) continue;

    console.log(`\n${event.name} — backfilling ${combined.length} record(s)`);
    for (const item of combined) {
      const reference = await prisma.$transaction(async (tx) => {
        const ref = await nextReference(tx, event.id, event.startDate);
        if (item.kind === "booking") {
          await tx.booking.update({ where: { id: item.id }, data: { reference: ref } });
        } else {
          await tx.hold.update({ where: { id: item.id }, data: { reference: ref } });
        }
        return ref;
      });
      console.log(`  ${reference}  ${item.kind.padEnd(7)}  ${item.createdAt.toISOString()}  ${item.name ?? ""}`);
      totalBackfilled++;
    }
  }

  console.log(totalBackfilled > 0 ? `\nBackfilled ${totalBackfilled} record(s).` : "\nNothing to backfill — every record already has a reference.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
