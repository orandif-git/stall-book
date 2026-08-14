import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { releaseExpiredHolds } from "../lib/holds.js";

export const reportsRouter = Router();

// GET /api/events/:eventId/reports/summary
reportsRouter.get("/events/:eventId/reports/summary", async (req, res) => {
  const eventId = req.params.eventId;
  await releaseExpiredHolds(eventId);

  const [categories, stalls, bookings] = await Promise.all([
    prisma.category.findMany({ where: { eventId } }),
    prisma.stall.findMany({ where: { eventId }, include: { category: true } }),
    prisma.booking.findMany({ where: { eventId } }),
  ]);

  const byCategory = categories.map((cat) => {
    const catStalls = stalls.filter((s) => s.categoryId === cat.id);
    const booked = catStalls.filter((s) => s.status === "BOOKED").length;
    const blocked = catStalls.filter((s) => s.status === "BLOCKED").length;
    const available = catStalls.length - booked - blocked;
    return {
      categoryId: cat.id,
      code: cat.code,
      label: cat.label,
      price: Number(cat.price),
      total: catStalls.length,
      booked,
      blocked,
      available,
      potentialRevenue: catStalls.length * Number(cat.price),
      bookedRevenue: booked * Number(cat.price),
    };
  });

  const totalStalls = stalls.length;
  const totalBooked = stalls.filter((s) => s.status === "BOOKED").length;
  const totalBlocked = stalls.filter((s) => s.status === "BLOCKED").length;
  const totalAvailable = totalStalls - totalBooked - totalBlocked;

  const totalCollected = bookings.reduce((sum, b) => sum + Number(b.amountPaid), 0);
  const totalInvoiced = bookings.reduce((sum, b) => sum + Number(b.totalAmount), 0);
  const totalPending = totalInvoiced - totalCollected;

  res.json({
    stalls: { total: totalStalls, booked: totalBooked, blocked: totalBlocked, available: totalAvailable },
    revenue: { invoiced: totalInvoiced, collected: totalCollected, pending: totalPending },
    bookingsCount: bookings.length,
    byCategory,
  });
});

// GET /api/events/:eventId/reports/exhibitors.csv
reportsRouter.get("/events/:eventId/reports/exhibitors.csv", async (req, res) => {
  const bookings = await prisma.booking.findMany({
    where: { eventId: req.params.eventId },
    include: { stalls: { include: { stall: true } } },
    orderBy: { createdAt: "asc" },
  });

  const header = [
    "Exhibitor Name",
    "Company",
    "Phone",
    "Email",
    "GST",
    "Stalls",
    "Total Amount",
    "Amount Paid",
    "Payment Status",
    "Booked On",
  ];

  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;

  const rows = bookings.map((b) =>
    [
      b.exhibitorName,
      b.company ?? "",
      b.phone,
      b.email ?? "",
      b.gst ?? "",
      b.stalls.map((s) => s.stall.code).join(" | "),
      Number(b.totalAmount).toFixed(2),
      Number(b.amountPaid).toFixed(2),
      b.paymentStatus,
      b.createdAt.toISOString().slice(0, 10),
    ]
      .map((v) => escape(String(v)))
      .join(",")
  );

  const csv = [header.map(escape).join(","), ...rows].join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="exhibitors-${req.params.eventId}.csv"`);
  res.send(csv);
});
