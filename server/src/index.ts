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
import { waSettingsRouter } from "./routes/waSettings.js";
import { publicRouter } from "./routes/public.js";
import { requireAuth, requireSuperAdmin } from "./middleware/auth.js";

const app = express();
// Trust exactly one reverse-proxy hop (nginx / the demo.jasinfo.in tunnel) for X-Forwarded-For.
// Without this, Express ignores the proxy and falls back to the socket address anyway — but if
// it's ever set wrong (e.g. "true", which trusts the whole chain), a client can prepend a fake
// IP to XFF and spoof their way past the public OTP endpoints' per-IP rate limits. "1" makes
// Express take the address one hop back from our own listener, which is the only value that's
// both correct behind our proxy and safe against a spoofed header.
app.set("trust proxy", 1);
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Uploaded layout images are served directly (no auth) so plain <img> tags can load them.
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

app.use("/api/auth", authRouter);

// Public customer booking portal — deliberately unauthenticated, kept separate from every
// mount below. See server/src/routes/public.ts for why each route there is safe for
// anonymous traffic (no PII, rate-limited, transactional availability checks).
app.use("/api/public", publicRouter);

// Everything below requires an authenticated admin.
app.use("/api/events", requireAuth, eventsRouter);
app.use("/api", requireAuth, stallsRouter);
app.use("/api", requireAuth, bookingsRouter);
app.use("/api", requireAuth, holdsRouter);
app.use("/api", requireAuth, reportsRouter);
app.use("/api", requireAuth, requireSuperAdmin, adminUsersRouter);
app.use("/api", requireAuth, requireSuperAdmin, waSettingsRouter);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`Stall Booking API listening on http://localhost:${port}`);
});
