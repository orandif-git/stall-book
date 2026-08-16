import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { logActivity } from "../lib/activity.js";
import type { AuthedRequest } from "../middleware/auth.js";

export const holdsRouter = Router();

const createHoldSchema = z.object({
  stallIds: z.array(z.string()).min(1),
  exhibitorName: z.string().min(1, "Exhibitor name is required"),
  company: z.string().min(1, "Company is required"),
  phone: z.string().min(1, "Phone is required"),
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
              { stalls: { some: { stall: { code: { contains: String(q), mode: "insensitive" } } } } },
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

const updateHoldSchema = z.object({
  exhibitorName: z.string().min(1).optional(),
  company: z.string().min(1, "Company is required").optional(),
  phone: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().optional(),
  productService: z.string().optional(),
  notes: z.string().optional(),
  bookedByOrg: z.enum(["MEC", "CHAMBER_OF_COMMERCE"]).optional(),
});

const HOLD_FIELD_LABEL: Record<string, string> = {
  exhibitorName: "exhibitor name",
  company: "company",
  phone: "phone",
  email: "email",
  address: "address",
  city: "city",
  productService: "product/service",
  notes: "notes",
  bookedByOrg: "booked by",
};

// General edit — separate from /holds/:id/approve, which only ever flips source. Lets an
// admin fill in details a public request came in without (or correct a plain block's), same
// PATCH-with-activity-log shape as the Booking equivalent in bookings.ts.
holdsRouter.patch("/holds/:id", async (req: AuthedRequest, res) => {
  const parsed = updateHoldSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const before = await prisma.hold.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "Hold not found" });

  const changedFields = Object.keys(parsed.data).filter(
    (key) => (parsed.data as Record<string, unknown>)[key] !== (before as Record<string, unknown>)[key]
  );

  const hold = await prisma.$transaction(async (tx) => {
    await tx.hold.update({ where: { id: req.params.id }, data: parsed.data });
    if (changedFields.length > 0) {
      await logActivity(tx, {
        eventId: before.eventId,
        holdId: before.id,
        action: "EDITED",
        description: `Updated ${changedFields.map((f) => HOLD_FIELD_LABEL[f] ?? f).join(", ")}`,
        performedById: req.admin?.id,
      });
    }
    return tx.hold.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { stalls: { include: { stall: true } }, activity: { orderBy: { createdAt: "desc" } } },
    });
  });

  res.json(hold);
});

// Approve a public request WITHOUT collecting payment yet: the stall stays exactly as
// BLOCKED as it already is — the only change is source PUBLIC_REQUEST -> ADMIN, which moves
// it out of the admin's "Requests" queue into the regular "Blocked" list. Payment is collected
// later via the existing "Confirm as booking" action on that same (now-admin) hold, whenever
// it actually comes in. No stall-status change, no new state — a Hold already *is* "reserved,
// no payment yet"; this just reclassifies who owns following up on it.
holdsRouter.patch("/holds/:id/approve", async (req: AuthedRequest, res) => {
  const hold = await prisma.hold.findUnique({ where: { id: req.params.id }, include: { stalls: { include: { stall: true } } } });
  if (!hold) return res.status(404).json({ error: "Hold not found" });
  if (hold.source !== "PUBLIC_REQUEST") {
    return res.status(400).json({ error: "Only a pending public request can be approved this way" });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.hold.update({ where: { id: hold.id }, data: { source: "ADMIN" } });
    const stallCodes = hold.stalls.map((s) => s.stall.code).join(", ");
    await logActivity(tx, {
      eventId: hold.eventId,
      holdId: hold.id,
      action: "APPROVED",
      description: `Approved request for ${stallCodes} — reserved, payment to be collected later`,
      performedById: req.admin?.id,
    });
    // Fetched fresh (not returned from the update above) so `activity` includes the entry
    // just logged, not a stale snapshot from before it existed.
    return tx.hold.findUniqueOrThrow({
      where: { id: hold.id },
      include: { stalls: { include: { stall: true } }, activity: { orderBy: { createdAt: "desc" } } },
    });
  });

  res.json(updated);
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
