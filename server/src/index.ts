import "dotenv/config";
import path from "node:path";
import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.js";
import { eventsRouter } from "./routes/events.js";
import { stallsRouter } from "./routes/stalls.js";
import { bookingsRouter } from "./routes/bookings.js";
import { holdsRouter } from "./routes/holds.js";
import { reportsRouter } from "./routes/reports.js";
import { adminUsersRouter } from "./routes/adminUsers.js";
import { requireAuth, requireSuperAdmin } from "./middleware/auth.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Uploaded layout images are served directly (no auth) so plain <img> tags can load them.
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

app.use("/api/auth", authRouter);

// Everything below requires an authenticated admin.
app.use("/api/events", requireAuth, eventsRouter);
app.use("/api", requireAuth, stallsRouter);
app.use("/api", requireAuth, bookingsRouter);
app.use("/api", requireAuth, holdsRouter);
app.use("/api", requireAuth, reportsRouter);
app.use("/api", requireAuth, requireSuperAdmin, adminUsersRouter);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`Stall Booking API listening on http://localhost:${port}`);
});
