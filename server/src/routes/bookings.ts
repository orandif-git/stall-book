import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import type { AuthedRequest } from "../middleware/auth.js";

export const bookingsRouter = Router();

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
    include: { stalls: { include: { stall: true } }, payments: true },
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
    return created;
  });

  res.status(201).json(booking);
});

bookingsRouter.get("/bookings/:id", async (req, res) => {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.id },
    include: { stalls: { include: { stall: true } }, payments: true },
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

bookingsRouter.patch("/bookings/:id", async (req, res) => {
  const parsed = updateBookingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const booking = await prisma.booking.update({ where: { id: req.params.id }, data: parsed.data });
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

bookingsRouter.post("/bookings/:id/payments", async (req, res) => {
  const parsed = addPaymentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
  if (!booking) return res.status(404).json({ error: "Booking not found" });

  const newAmountPaid = Number(booking.amountPaid) + parsed.data.amount;
  const updated = await prisma.$transaction(async (tx) => {
    await tx.payment.create({ data: { bookingId: booking.id, ...parsed.data } });
    return tx.booking.update({
      where: { id: booking.id },
      data: {
        amountPaid: newAmountPaid,
        paymentStatus: paymentStatusFor(Number(booking.totalAmount), newAmountPaid),
      },
      include: { payments: true, stalls: { include: { stall: true } } },
    });
  });

  res.status(201).json(updated);
});
