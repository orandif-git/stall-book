import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { releaseExpiredHolds } from "../lib/holds.js";

export const stallsRouter = Router();

// GET /api/events/:eventId/stalls?status=AVAILABLE&categoryId=xxx
stallsRouter.get("/events/:eventId/stalls", async (req, res) => {
  await releaseExpiredHolds(req.params.eventId);

  const { status, categoryId } = req.query;
  const stalls = await prisma.stall.findMany({
    where: {
      eventId: req.params.eventId,
      ...(status ? { status: status as "AVAILABLE" | "BOOKED" | "BLOCKED" } : {}),
      ...(categoryId ? { categoryId: String(categoryId) } : {}),
    },
    include: {
      category: true,
      bookingLinks: { include: { booking: true } },
      holdLinks: { include: { hold: true } },
    },
    orderBy: [{ gridRow: "asc" }, { gridCol: "asc" }],
  });
  res.json(stalls);
});

// Suggests where a new stall should go for a category — continuing right after that
// category's last stall if it has any, or a fresh unused row if it's brand new. Powers
// the auto-fill on the Bulk-generate form so admins don't have to know row/column numbers.
stallsRouter.get("/events/:eventId/stalls/next-position", async (req, res) => {
  const categoryId = String(req.query.categoryId ?? "");
  if (!categoryId) return res.status(400).json({ error: "categoryId is required" });

  const lastStall = await prisma.stall.findFirst({
    where: { eventId: req.params.eventId, categoryId },
    orderBy: [{ gridRow: "desc" }, { gridCol: "desc" }],
  });

  if (lastStall) {
    const prefixMatch = lastStall.code.match(/^(\D+)/);
    const numMatch = lastStall.code.match(/(\d+)$/);
    return res.json({
      gridRow: lastStall.gridRow,
      startCol: lastStall.gridCol + 1,
      suggestedPrefix: prefixMatch?.[1] ?? "",
      suggestedFrom: numMatch ? Number(numMatch[1]) + 1 : 1,
      afterCode: lastStall.code,
    });
  }

  const agg = await prisma.stall.aggregate({ where: { eventId: req.params.eventId }, _max: { gridRow: true } });
  res.json({
    gridRow: (agg._max.gridRow ?? 0) + 1,
    startCol: 1,
    suggestedPrefix: "",
    suggestedFrom: 1,
    afterCode: null,
  });
});

// Bulk-generate a run of stalls, e.g. B1..B41 in one row, or a grid block.
const bulkGenerateSchema = z.object({
  categoryId: z.string(),
  prefix: z.string().min(1), // e.g. "B"
  from: z.coerce.number().int().positive(),
  to: z.coerce.number().int().positive(),
  zone: z.string().optional(),
  gridRow: z.coerce.number().int(),
  startCol: z.coerce.number().int(),
  colStep: z.coerce.number().int().default(1),
});

stallsRouter.post("/events/:eventId/stalls/bulk-generate", async (req, res) => {
  const parsed = bulkGenerateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { categoryId, prefix, from, to, zone, gridRow, startCol, colStep } = parsed.data;

  if (to < from) return res.status(400).json({ error: "'to' must be >= 'from'" });

  const data = [];
  for (let n = from; n <= to; n++) {
    data.push({
      eventId: req.params.eventId,
      categoryId,
      code: `${prefix}${n}`,
      zone,
      gridRow,
      gridCol: startCol + (n - from) * colStep,
    });
  }

  const created = await prisma.stall.createMany({ data, skipDuplicates: true });
  res.status(201).json({ created: created.count });
});

const stallUpdateSchema = z.object({
  status: z.enum(["AVAILABLE", "BOOKED", "BLOCKED"]).optional(),
  zone: z.string().optional(),
  gridRow: z.coerce.number().int().optional(),
  gridCol: z.coerce.number().int().optional(),
  rowSpan: z.coerce.number().int().optional(),
  colSpan: z.coerce.number().int().optional(),
});

stallsRouter.patch("/stalls/:id", async (req, res) => {
  const parsed = stallUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const stall = await prisma.stall.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(stall);
});
