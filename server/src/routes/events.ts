import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { prisma } from "../lib/prisma.js";
import { logActivity } from "../lib/activity.js";
import { requireSuperAdmin, type AuthedRequest } from "../middleware/auth.js";

export const eventsRouter = Router();

const uploadsDir = path.resolve(process.cwd(), "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || ".jpg";
      cb(null, `${req.params.id}-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\//.test(file.mimetype)) return cb(new Error("Only image uploads are allowed"));
    cb(null, true);
  },
});

const eventSchema = z.object({
  name: z.string().min(1),
  venue: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  layoutImageUrl: z.string().optional(),
});

eventsRouter.get("/", async (_req, res) => {
  const events = await prisma.event.findMany({ orderBy: { startDate: "desc" } });
  res.json(events);
});

eventsRouter.post("/", async (req, res) => {
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const event = await prisma.event.create({ data: parsed.data });
  res.status(201).json(event);
});

eventsRouter.get("/:id", async (req, res) => {
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    include: { categories: true },
  });
  if (!event) return res.status(404).json({ error: "Event not found" });
  res.json(event);
});

eventsRouter.patch("/:id", async (req, res) => {
  const parsed = eventSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const event = await prisma.event.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(event);
});

eventsRouter.post("/:id/layout-image", (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image uploaded" });
  const layoutImageUrl = `/uploads/${req.file.filename}`;
  const event = await prisma.event.update({ where: { id: req.params.id }, data: { layoutImageUrl } });
  res.json(event);
});

// --- Categories (per event) — creating/editing is Super Admin only ---

const categorySchema = z.object({
  code: z.string().min(1),
  label: z.string().min(1),
  size: z.string().optional(),
  price: z.coerce.number().nonnegative(),
  colorHex: z.string().optional(),
});

const categoryActivityInclude = { activity: { orderBy: { createdAt: "desc" as const } } };

eventsRouter.get("/:id/categories", async (req, res) => {
  const categories = await prisma.category.findMany({
    where: { eventId: req.params.id },
    include: categoryActivityInclude,
  });
  res.json(categories);
});

eventsRouter.post("/:id/categories", requireSuperAdmin, async (req: AuthedRequest, res) => {
  const bodySchema = z.union([categorySchema, z.array(categorySchema)]);
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const items = Array.isArray(parsed.data) ? parsed.data : [parsed.data];

  const created = await prisma.$transaction(async (tx) => {
    const rows = await Promise.all(items.map((item) => tx.category.create({ data: { ...item, eventId: req.params.id } })));
    for (const row of rows) {
      await logActivity(tx, {
        eventId: req.params.id,
        categoryId: row.id,
        action: "CREATED",
        description: `Category ${row.code} created`,
        performedById: req.admin?.id,
      });
    }
    return rows;
  });

  res.status(201).json(created);
});

const updateCategorySchema = z.object({
  code: z.string().min(1).optional(),
  label: z.string().min(1).optional(),
  size: z.string().optional(),
  price: z.coerce.number().nonnegative().optional(),
});

const CATEGORY_FIELD_LABEL: Record<string, string> = {
  code: "code",
  label: "label",
  size: "size",
  price: "price",
};

eventsRouter.patch("/:id/categories/:categoryId", requireSuperAdmin, async (req: AuthedRequest, res) => {
  const parsed = updateCategorySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const before = await prisma.category.findUnique({ where: { id: req.params.categoryId } });
  if (!before || before.eventId !== req.params.id) return res.status(404).json({ error: "Category not found" });

  const changedFields = Object.keys(parsed.data).filter((key) => {
    const next = (parsed.data as Record<string, unknown>)[key];
    const prev = (before as Record<string, unknown>)[key];
    if (key === "price") return Number(next) !== Number(prev);
    return next !== prev;
  });

  const category = await prisma.$transaction(async (tx) => {
    const updated = await tx.category.update({
      where: { id: req.params.categoryId },
      data: parsed.data,
      include: categoryActivityInclude,
    });
    if (changedFields.length > 0) {
      await logActivity(tx, {
        eventId: req.params.id,
        categoryId: updated.id,
        action: "EDITED",
        description: `Updated ${changedFields.map((f) => CATEGORY_FIELD_LABEL[f] ?? f).join(", ")}`,
        performedById: req.admin?.id,
      });
    }
    return updated;
  });

  res.json(category);
});
