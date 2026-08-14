import { prisma } from "./prisma.js";

// Auto-release any holds past their release date: stall goes back to AVAILABLE, hold is removed.
// Called opportunistically wherever stall state is read, rather than via a background scheduler.
export async function releaseExpiredHolds(eventId: string) {
  const expired = await prisma.hold.findMany({
    where: { eventId, releaseAt: { lte: new Date() } },
    include: { stalls: true },
  });
  if (expired.length === 0) return;

  const stallIds = expired.flatMap((h) => h.stalls.map((s) => s.stallId));
  await prisma.$transaction([
    prisma.stall.updateMany({ where: { id: { in: stallIds } }, data: { status: "AVAILABLE" } }),
    prisma.hold.deleteMany({ where: { id: { in: expired.map((h) => h.id) } } }),
  ]);
}
