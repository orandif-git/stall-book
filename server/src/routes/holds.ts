import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { logActivity } from "../lib/activity.js";
import type { AuthedRequest } from "../middleware/auth.js";

export const holdsRouter = Router();

const createHoldSchema = z.object({
  stallIds: z.array(z.string()).min(1),
  exhibitorName: z.string().optional(),
  phone: z.string().optional(),
  notes: z.string().optional(),
  bookedByOrg: z.enum(["MEC", "CHAMBER_OF_COMMERCE"]).default("MEC"),
  releaseAt: z.coerce.date().optional(),
});

// GET /api/events/:eventId/holds?q=&bookedByOrg= — powers the "Blocked" rows in the Bookings list.
holdsRouter.get("/events/:eventId/holds", async (req, res) => {
  const { q, bookedByOrg } = req.query;
  const holds = await prisma.hold.findMany({
    where: {
      eventId: req.params.eventId,
      ...(bookedByOrg ? { bookedByOrg: bookedByOrg as "MEC" | "CHAMBER_OF_COMMERCE" } : {}),
      ...(q
        ? {
            OR: [
              { exhibitorName: { contains: String(q), mode: "insensitive" } },
              { phone: { contains: String(q) } },
            ],
          }
        : {}),
    },
    include: { stalls: { include: { stall: true } }, activity: { orderBy: { createdAt: "desc" } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(holds);
});

holdsRouter.post("/events/:eventId/holds", async (req: AuthedRequest, res) => {
  const parsed = createHoldSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { stallIds, ...details } = parsed.data;

  const stalls = await prisma.stall.findMany({
    where: { id: { in: stallIds }, eventId: req.params.eventId },
  });
  if (stalls.length !== stallIds.length) {
    return res.status(404).json({ error: "One or more stalls not found in this event" });
  }
  const unavailable = stalls.filter((s) => s.status !== "AVAILABLE");
  if (unavailable.length > 0) {
    return res.status(409).json({
      error: "Some stalls are no longer available",
      stalls: unavailable.map((s) => s.code),
    });
  }

  const hold = await prisma.$transaction(async (tx) => {
    const created = await tx.hold.create({
      data: {
        eventId: req.params.eventId,
        ...details,
        stalls: { create: stallIds.map((stallId) => ({ stallId })) },
      },
      include: { stalls: { include: { stall: true } } },
    });
    await tx.stall.updateMany({ where: { id: { in: stallIds } }, data: { status: "BLOCKED" } });

    const stallCodes = stalls.map((s) => s.code).join(", ");
    await logActivity(tx, {
      eventId: req.params.eventId,
      holdId: created.id,
      action: "CREATED",
      description: `Blocked ${stallCodes}${details.exhibitorName ? ` for ${details.exhibitorName}` : ""}`,
      performedById: req.admin?.id,
    });

    return created;
  });

  res.status(201).json(hold);
});

holdsRouter.get("/holds/:id", async (req, res) => {
  const hold = await prisma.hold.findUnique({
    where: { id: req.params.id },
    include: { stalls: { include: { stall: true } }, activity: { orderBy: { createdAt: "desc" } } },
  });
  if (!hold) return res.status(404).json({ error: "Hold not found" });
  res.json(hold);
});

// Release now: stalls go back to AVAILABLE, hold is removed.
holdsRouter.delete("/holds/:id", async (req, res) => {
  const hold = await prisma.hold.findUnique({ where: { id: req.params.id }, include: { stalls: true } });
  if (!hold) return res.status(404).json({ error: "Hold not found" });

  await prisma.$transaction(async (tx) => {
    const stallIds = hold.stalls.map((s) => s.stallId);
    await tx.stall.updateMany({ where: { id: { in: stallIds } }, data: { status: "AVAILABLE" } });
    await tx.hold.delete({ where: { id: req.params.id } });
  });

  res.status(204).send();
});
