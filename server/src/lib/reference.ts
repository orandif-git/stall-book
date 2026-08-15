import type { Prisma, PrismaClient } from "@prisma/client";

type Tx = PrismaClient | Prisma.TransactionClient;

// Assigns the next sequential, human-readable reference for an event — e.g. "MC-26-00001".
// Shared by both the public booking-request submission (server/src/routes/public.ts) and
// booking creation (server/src/routes/bookings.ts), backed by one EventRequestCounter per
// event so every reference issued for that event — whether a pending request or a booking
// created directly by an admin — comes from the same never-reused sequence. A Prisma
// `increment` update compiles to an atomic SQL `UPDATE ... SET count = count + 1`, so
// concurrent callers can never be assigned the same number.
export async function nextReference(tx: Tx, eventId: string, eventStartDate: Date): Promise<string> {
  const counter = await tx.eventRequestCounter.upsert({
    where: { eventId },
    update: { count: { increment: 1 } },
    create: { eventId, count: 1 },
  });
  const yy = String(eventStartDate.getFullYear()).slice(-2);
  return `MC-${yy}-${String(counter.count).padStart(5, "0")}`;
}
