import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./prisma.js";

type Tx = PrismaClient | Prisma.TransactionClient;

// Compact, inline activity trail — no separate audit page. performedByName is
// snapshotted at write time so entries still read correctly even after that
// admin's account is later deleted (their name just stops being a live link).
export async function logActivity(
  tx: Tx,
  params: {
    eventId: string;
    bookingId?: string;
    holdId?: string;
    action: string;
    description: string;
    performedById?: string;
  }
) {
  const performer = params.performedById
    ? await prisma.adminUser.findUnique({ where: { id: params.performedById }, select: { name: true } })
    : null;

  await tx.activityLog.create({
    data: {
      eventId: params.eventId,
      bookingId: params.bookingId,
      holdId: params.holdId,
      action: params.action,
      description: params.description,
      performedById: params.performedById,
      performedByName: performer?.name ?? "Unknown",
    },
  });
}
