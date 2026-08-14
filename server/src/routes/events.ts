import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { prisma } from "../lib/prisma.js";

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

// --- Categories (per event) ---

const categorySchema = z.object({
  code: z.string().min(1),
  label: z.string().min(1),
  size: z.string().optional(),
  price: z.coerce.number().nonnegative(),
  colorHex: z.string().optional(),
});

eventsRouter.get("/:id/categories", async (req, res) => {
  const categories = await prisma.category.findMany({ where: { eventId: req.params.id } });
  res.json(categories);
});

eventsRouter.post("/:id/categories", async (req, res) => {
  const bodySchema = z.union([categorySchema, z.array(categorySchema)]);
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const items = Array.isArray(parsed.data) ? parsed.data : [parsed.data];

  const created = await prisma.$transaction(
    items.map((item) =>
      prisma.category.create({ data: { ...item, eventId: req.params.id } })
    )
  );
  res.status(201).json(created);
});
