import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import type { AuthedRequest } from "../middleware/auth.js";

export const adminUsersRouter = Router();

// GET /api/admin-users
adminUsersRouter.get("/admin-users", async (_req, res) => {
  const users = await prisma.adminUser.findMany({
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  res.json(users);
});

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["SUPER_ADMIN", "STAFF"]).default("STAFF"),
});

adminUsersRouter.post("/admin-users", async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { name, email, password, role } = parsed.data;

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "A user with this email already exists" });

  const user = await prisma.adminUser.create({
    data: { name, email, role, passwordHash: await bcrypt.hash(password, 10) },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
  res.status(201).json(user);
});

// Delete a user — can't remove yourself, and can't remove the last super admin.
adminUsersRouter.delete("/admin-users/:id", async (req: AuthedRequest, res) => {
  if (req.params.id === req.admin?.id) {
    return res.status(400).json({ error: "You can't remove your own account" });
  }

  const target = await prisma.adminUser.findUnique({ where: { id: req.params.id } });
  if (!target) return res.status(404).json({ error: "User not found" });

  if (target.role === "SUPER_ADMIN") {
    const superAdminCount = await prisma.adminUser.count({ where: { role: "SUPER_ADMIN" } });
    if (superAdminCount <= 1) {
      return res.status(400).json({ error: "Can't remove the last super admin" });
    }
  }

  await prisma.adminUser.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
