import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { logActivity } from "../lib/activity.js";
import type { AuthedRequest } from "../middleware/auth.js";

export const bookingsRouter = Router();

const PAYMENT_MODE_LABEL: Record<string, string> = {
  CASH: "Cash",
  CHEQUE: "Cheque",
  UPI: "UPI",
  BANK_TRANSFER: "Bank transfer",
  OTHER: "Other",
};

const createBookingSchema = z.object({
  stallIds: z.array(z.string()).min(1),
  exhibitorName: z.string().min(1),
  company: z.string().optional(),
  phone: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  gst: z.string().optional(),
  notes: z.string().optional(),
  bookedByOrg: z.enum(["MEC", "CHAMBER_OF_COMMERCE"]).default("MEC"),
  amountPaid: z.coerce.number().nonnegative().default(0),
  paymentMode: z.enum(["CASH", "CHEQUE", "UPI", "BANK_TRANSFER", "OTHER"]).default("CASH"),
  paymentReference: z.string().optional(),
});

function paymentStatusFor(totalAmount: number, amountPaid: number) {
  if (amountPaid <= 0) return "UNPAID" as const;
  if (amountPaid >= totalAmount) return "PAID" as const;
  return "PARTIAL" as const;
}

const activityInclude = { activity: { orderBy: { createdAt: "desc" as const } } };

// GET /api/events/:eventId/bookings?q=&paymentStatus=
bookingsRouter.get("/events/:eventId/bookings", async (req, res) => {
  const { q, paymentStatus } = req.query;
  const bookings = await prisma.booking.findMany({
    where: {
      eventId: req.params.eventId,
      ...(paymentStatus ? { paymentStatus: paymentStatus as "UNPAID" | "PARTIAL" | "PAID" } : {}),
      ...(q
        ? {
            OR: [
              { exhibitorName: { contains: String(q), mode: "insensitive" } },
              { company: { contains: String(q), mode: "insensitive" } },
              { phone: { contains: String(q) } },
            ],
          }
        : {}),
    },
    include: { stalls: { include: { stall: true } }, payments: true, ...activityInclude },
    orderBy: { createdAt: "desc" },
  });
  res.json(bookings);
});

bookingsRouter.post("/events/:eventId/bookings", async (req: AuthedRequest, res) => {
  const parsed = createBookingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { stallIds, amountPaid, paymentMode, paymentReference, ...exhibitor } = parsed.data;

  const stalls = await prisma.stall.findMany({
    where: { id: { in: stallIds }, eventId: req.params.eventId },
    include: { category: true },
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

  const totalAmount = stalls.reduce((sum, s) => sum + Number(s.category.price), 0);

  const booking = await prisma.$transaction(async (tx) => {
    const created = await tx.booking.create({
      data: {
        eventId: req.params.eventId,
        ...exhibitor,
        email: exhibitor.email || undefined,
        totalAmount,
        amountPaid,
        paymentStatus: paymentStatusFor(totalAmount, amountPaid),
        bookedById: req.admin?.id,
        stalls: { create: stallIds.map((stallId) => ({ stallId })) },
        ...(amountPaid > 0
          ? { payments: { create: [{ amount: amountPaid, mode: paymentMode, reference: paymentReference }] } }
          : {}),
      },
      include: { stalls: { include: { stall: true } }, payments: true },
    });
    await tx.stall.updateMany({ where: { id: { in: stallIds } }, data: { status: "BOOKED" } });

    const stallCodes = stalls.map((s) => s.code).join(", ");
    await logActivity(tx, {
      eventId: req.params.eventId,
      bookingId: created.id,
      action: "CREATED",
      description: `Booked ${stallCodes} for ${exhibitor.exhibitorName}`,
      performedById: req.admin?.id,
    });
    if (amountPaid > 0) {
      await logActivity(tx, {
        eventId: req.params.eventId,
        bookingId: created.id,
        action: "PAYMENT_ADDED",
        description: `Recorded ₹${amountPaid.toLocaleString("en-IN")} via ${PAYMENT_MODE_LABEL[paymentMode]}${paymentReference ? ` (ref: ${paymentReference})` : ""}`,
        performedById: req.admin?.id,
      });
    }

    return created;
  });

  res.status(201).json(booking);
});

bookingsRouter.get("/bookings/:id", async (req, res) => {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.id },
    include: { stalls: { include: { stall: true } }, payments: true, ...activityInclude },
  });
  if (!booking) return res.status(404).json({ error: "Booking not found" });
  res.json(booking);
});

const updateBookingSchema = z.object({
  exhibitorName: z.string().min(1).optional(),
  company: z.string().optional(),
  phone: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal("")),
  gst: z.string().optional(),
  notes: z.string().optional(),
  bookedByOrg: z.enum(["MEC", "CHAMBER_OF_COMMERCE"]).optional(),
});

const FIELD_LABEL: Record<string, string> = {
  exhibitorName: "exhibitor name",
  company: "company",
  phone: "phone",
  email: "email",
  gst: "GST",
  notes: "notes",
  bookedByOrg: "booked by",
};

bookingsRouter.patch("/bookings/:id", async (req: AuthedRequest, res) => {
  const parsed = updateBookingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const before = await prisma.booking.findUnique({ where: { id: req.params.id } });
  if (!before) return res.status(404).json({ error: "Booking not found" });

  const changedFields = Object.keys(parsed.data).filter(
    (key) => (parsed.data as Record<string, unknown>)[key] !== (before as Record<string, unknown>)[key]
  );

  const booking = await prisma.$transaction(async (tx) => {
    const updated = await tx.booking.update({
      where: { id: req.params.id },
      data: parsed.data,
      include: { stalls: { include: { stall: true } }, payments: true, ...activityInclude },
    });
    if (changedFields.length > 0) {
      await logActivity(tx, {
        eventId: updated.eventId,
        bookingId: updated.id,
        action: "EDITED",
        description: `Updated ${changedFields.map((f) => FIELD_LABEL[f] ?? f).join(", ")}`,
        performedById: req.admin?.id,
      });
    }
    return updated;
  });

  res.json(booking);
});

// Cancel a booking: release its stalls back to AVAILABLE.
bookingsRouter.delete("/bookings/:id", async (req, res) => {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.id },
    include: { stalls: true },
  });
  if (!booking) return res.status(404).json({ error: "Booking not found" });

  await prisma.$transaction(async (tx) => {
    const stallIds = booking.stalls.map((s) => s.stallId);
    await tx.stall.updateMany({ where: { id: { in: stallIds } }, data: { status: "AVAILABLE" } });
    await tx.booking.delete({ where: { id: req.params.id } });
  });

  res.status(204).send();
});

// --- Payments ledger ---

const addPaymentSchema = z.object({
  amount: z.coerce.number().positive(),
  mode: z.enum(["CASH", "CHEQUE", "UPI", "BANK_TRANSFER", "OTHER"]),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

bookingsRouter.post("/bookings/:id/payments", async (req: AuthedRequest, res) => {
  const parsed = addPaymentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
  if (!booking) return res.status(404).json({ error: "Booking not found" });

  const newAmountPaid = Number(booking.amountPaid) + parsed.data.amount;
  const updated = await prisma.$transaction(async (tx) => {
    await tx.payment.create({ data: { bookingId: booking.id, ...parsed.data } });
    const result = await tx.booking.update({
      where: { id: booking.id },
      data: {
        amountPaid: newAmountPaid,
        paymentStatus: paymentStatusFor(Number(booking.totalAmount), newAmountPaid),
      },
      include: { payments: true, stalls: { include: { stall: true } }, ...activityInclude },
    });
    await logActivity(tx, {
      eventId: booking.eventId,
      bookingId: booking.id,
      action: "PAYMENT_ADDED",
      description: `Recorded ₹${parsed.data.amount.toLocaleString("en-IN")} via ${PAYMENT_MODE_LABEL[parsed.data.mode]}${parsed.data.reference ? ` (ref: ${parsed.data.reference})` : ""}`,
      performedById: req.admin?.id,
    });
    return result;
  });

  res.status(201).json(updated);
});
