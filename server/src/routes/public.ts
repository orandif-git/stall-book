import type { Request } from "express";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { releaseExpiredHolds } from "../lib/holds.js";
import { validateMobile, toWhatsAppPhone } from "../lib/phone.js";
import {
  generateOtpCode,
  createOtpChallenge,
  isOnResendCooldown,
  getCooldownSecondsRemaining,
  verifyOtpChallenge,
} from "../lib/otp.js";
import { checkRateLimit } from "../lib/rateLimit.js";
import { getTurnstileSiteKey, isTurnstileConfigured, verifyTurnstileToken } from "../lib/turnstile.js";
import { sendOtpWhatsApp } from "../lib/whatsapp.js";
import { getOtpTunables } from "../lib/waSettings.js";
import { nextReference } from "../lib/reference.js";
import { signPublicOtpToken, verifyPublicOtpToken } from "../middleware/auth.js";

// Entirely unauthenticated — mounted at /api/public with no requireAuth, separate from every
// other router in this app. Every route here must be safe for anonymous, potentially hostile
// traffic: no PII in responses, rate-limited writes, and stall availability re-checked inside
// transactions rather than trusted from an earlier read (the admin routes' TOCTOU shortcut is
// fine for a handful of trusted admins; it is not fine here).
export const publicRouter = Router();

// OTP length/TTL/attempts/cooldown are admin-configurable (WA Setup, Super Admin only) — see
// getOtpTunables() for the DB-with-env-fallback resolution. Only the reservation hold TTL stays
// a fixed constant here; it's a booking-flow detail, not a WhatsApp/OTP setting.
const HOLD_TTL_MINUTES = 15;

class PublicRequestError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// req.ip (not a hand-parsed X-Forwarded-For header) — Express only trusts XFF at all when
// app.set("trust proxy", ...) says so, and then only takes the address exactly that many hops
// back from our own listener. That's what stops a client from just setting its own XFF header
// to a random value on every request to dodge the per-IP rate limits below.
function clientIp(req: Request): string {
  return req.ip || "unknown";
}

// GET /api/public/events/:slug — event lookup by slug only (no cuid fallback — the public URL
// is always the slug), no PII.
publicRouter.get("/events/:slug", async (req, res) => {
  const event = await prisma.event.findUnique({
    where: { slug: req.params.slug },
    select: {
      id: true,
      name: true,
      slug: true,
      venue: true,
      startDate: true,
      endDate: true,
      canvasWidth: true,
      canvasHeight: true,
      layoutImageUrl: true,
    },
  });
  if (!event) return res.status(404).json({ error: "Event not found" });
  res.json(event);
});

// GET /api/public/events/:slug/floorplan — a stripped-down version of the admin /floorplan
// endpoint: no exhibitor contact name/payment amounts/block reason, and BOOKED/BLOCKED both
// collapse to a single UNAVAILABLE status. The one deliberate exception is the booked stall's
// company name — shown publicly as a simple exhibitor directory (confirmed with the user this
// is wanted); a BLOCKED stall never has a Booking behind it, so this only ever surfaces for
// actual confirmed bookings, never an admin's in-progress hold. See server/src/routes/stalls.ts
// for the admin version this deliberately does not reuse.
publicRouter.get("/events/:slug/floorplan", async (req, res) => {
  const event = await prisma.event.findUnique({
    where: { slug: req.params.slug },
    select: { id: true, canvasWidth: true, canvasHeight: true, layoutImageUrl: true, showCompanyPublicly: true },
  });
  if (!event) return res.status(404).json({ error: "Event not found" });

  await releaseExpiredHolds(event.id);

  const [stalls, decor] = await Promise.all([
    prisma.stall.findMany({
      where: { eventId: event.id },
      include: { category: true, bookingLinks: { include: { booking: { select: { company: true } } } } },
    }),
    prisma.floorPlanDecor.findMany({ where: { eventId: event.id } }),
  ]);

  res.json({
    canvasWidth: event.canvasWidth,
    canvasHeight: event.canvasHeight,
    layoutImageUrl: event.layoutImageUrl,
    stalls: stalls.map((s) => ({
      id: s.id,
      code: s.code,
      categoryLabel: s.category.label,
      price: Number(s.category.price),
      colorHex: s.category.colorHex,
      posX: s.posX,
      posY: s.posY,
      width: s.width,
      height: s.height,
      rotation: s.rotation,
      shape: s.shape,
      points: s.points,
      status: s.status === "AVAILABLE" ? ("AVAILABLE" as const) : ("UNAVAILABLE" as const),
      company: event.showCompanyPublicly ? (s.bookingLinks[0]?.booking.company ?? null) : null,
    })),
    decor: decor.map((d) => ({
      id: d.id,
      kind: d.kind,
      posX: d.posX,
      posY: d.posY,
      width: d.width,
      height: d.height,
      text: d.text,
      points: d.points,
    })),
  });
});

// GET /api/public/config — the site key is a public value by design (Cloudflare's own docs:
// it's meant to be embedded in frontend JS), so serving it here is safe. The secret key never
// has an endpoint at all.
publicRouter.get("/config", async (_req, res) => {
  res.json({ turnstileSiteKey: await getTurnstileSiteKey() });
});

// --- OTP ---

const otpRequestSchema = z.object({ phone: z.string().min(1), turnstileToken: z.string().optional() });

publicRouter.post("/otp/request", async (req, res) => {
  const parsed = otpRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Enter a mobile number" });

  const { valid, mobile, error } = validateMobile(parsed.data.phone);
  if (!valid || !mobile) return res.status(400).json({ error: error ?? "Invalid mobile number" });

  const ip = clientIp(req);

  // The bot-check gate, ahead of the rate limiters below — a script has to solve a real
  // Turnstile challenge before it can even start burning through the per-IP/per-phone budget.
  // No-op when TURNSTILE_SECRET_KEY isn't configured (see isTurnstileConfigured()).
  if (await isTurnstileConfigured()) {
    const humanVerified = await verifyTurnstileToken(parsed.data.turnstileToken ?? "", ip);
    if (!humanVerified) {
      return res.status(400).json({ error: "Verification failed. Please try again." });
    }
  }

  if (!checkRateLimit(`otp-req-ip:${ip}`, 20, 3600)) {
    return res.status(429).json({ error: "Too many requests from this network. Please try again later." });
  }
  if (!checkRateLimit(`otp-req-phone:${mobile}`, 5, 3600)) {
    return res.status(429).json({ error: "Too many code requests for this number. Please try again later." });
  }

  if (await isOnResendCooldown(mobile)) {
    const remainingCooldownSeconds = await getCooldownSecondsRemaining(mobile);
    return res.status(429).json({
      error: `Please wait ${remainingCooldownSeconds}s before requesting another code.`,
      remainingCooldownSeconds,
    });
  }

  const tunables = await getOtpTunables();
  const code = generateOtpCode(tunables.otpLength);
  await createOtpChallenge({
    phone: mobile,
    code,
    ttlSeconds: tunables.otpTtlSeconds,
    maxAttempts: tunables.otpMaxAttempts,
    resendCooldownSeconds: tunables.otpResendCooldownSeconds,
  });

  const sendResult = await sendOtpWhatsApp(toWhatsAppPhone(mobile), code);
  if (!sendResult.success) {
    return res.status(502).json({ error: sendResult.error ?? "Failed to send code. Please try again in a moment." });
  }

  res.json({ ok: true, ttlSeconds: tunables.otpTtlSeconds });
});

const otpVerifySchema = z.object({ phone: z.string().min(1), code: z.string().min(1) });

publicRouter.post("/otp/verify", async (req, res) => {
  const parsed = otpVerifySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Enter the code" });

  const { valid, mobile } = validateMobile(parsed.data.phone);
  if (!valid || !mobile) return res.status(400).json({ error: "Invalid mobile number" });

  const result = await verifyOtpChallenge({ phone: mobile, code: parsed.data.code.trim() });
  if (result === "ok") {
    return res.json({ ok: true, token: signPublicOtpToken(mobile) });
  }

  const messages: Record<string, string> = {
    no_challenge: "Please request a new code.",
    expired: "Your code has expired. Please request a new one.",
    too_many_attempts: "Too many incorrect attempts. Please request a new code.",
    mismatch: "Incorrect code. Please try again.",
  };
  res.status(400).json({ error: messages[result] ?? "Verification failed" });
});

// --- Reservation hold + submission ---

const createHoldSchema = z.object({
  stallIds: z.array(z.string()).min(1),
  phone: z.string().min(1),
  token: z.string().min(1),
});

publicRouter.post("/events/:slug/holds", async (req, res) => {
  const parsed = createHoldSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Select at least one stall" });

  const { valid, mobile } = validateMobile(parsed.data.phone);
  if (!valid || !mobile) return res.status(400).json({ error: "Invalid mobile number" });

  const verifiedPhone = verifyPublicOtpToken(parsed.data.token);
  if (!verifiedPhone || verifiedPhone !== mobile) {
    return res.status(401).json({ error: "Please verify your phone number again." });
  }

  const event = await prisma.event.findUnique({ where: { slug: req.params.slug }, select: { id: true } });
  if (!event) return res.status(404).json({ error: "Event not found" });

  const ip = clientIp(req);
  if (!checkRateLimit(`hold-create-ip:${ip}`, 30, 3600)) {
    return res.status(429).json({ error: "Too many requests from this network. Please try again later." });
  }

  try {
    const hold = await prisma.$transaction(async (tx) => {
      // Availability is re-checked *inside* the transaction (not before it, like the admin
      // routes do) — closes the TOCTOU gap public traffic actually exposes. The @@unique on
      // HoldStall.stallId is the final backstop: if two requests somehow race past this check,
      // the losing insert throws and its whole transaction rolls back.
      const stalls = await tx.stall.findMany({
        where: { id: { in: parsed.data.stallIds }, eventId: event.id },
      });
      if (stalls.length !== parsed.data.stallIds.length) {
        throw new PublicRequestError(404, "One or more stalls could not be found");
      }
      const unavailable = stalls.filter((s) => s.status !== "AVAILABLE");
      if (unavailable.length > 0) {
        throw new PublicRequestError(
          409,
          `Sorry, ${unavailable.map((s) => s.code).join(", ")} ${unavailable.length > 1 ? "are" : "is"} no longer available. Please reselect.`,
        );
      }

      const created = await tx.hold.create({
        data: {
          eventId: event.id,
          phone: mobile,
          source: "PUBLIC_REQUEST",
          otpVerifiedAt: new Date(),
          releaseAt: new Date(Date.now() + HOLD_TTL_MINUTES * 60_000),
          stalls: { create: parsed.data.stallIds.map((stallId) => ({ stallId })) },
        },
        include: { stalls: { include: { stall: true } } },
      });
      await tx.stall.updateMany({ where: { id: { in: parsed.data.stallIds } }, data: { status: "BLOCKED" } });

      return created;
    });

    res.status(201).json({
      holdId: hold.id,
      releaseAt: hold.releaseAt,
      stallCodes: hold.stalls.map((s) => s.stall.code),
    });
  } catch (err) {
    if (err instanceof PublicRequestError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

const submitHoldSchema = z.object({
  phone: z.string().min(1),
  token: z.string().min(1),
  exhibitorName: z.string().min(1),
  company: z.string().min(1, "Company is required"),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().min(1),
  city: z.string().min(1),
  productService: z.string().min(1),
  notes: z.string().optional(),
});

// PATCH /api/public/holds/:id — the actual "submit request" action. Fills in the rest of the
// customer's details on the reservation Hold created above and clears releaseAt so
// releaseExpiredHolds() stops treating it as expirable — from here on it's a durable request
// sitting in the admin's queue (Hold.source === "PUBLIC_REQUEST"), same as any other Hold.
publicRouter.patch("/holds/:id", async (req, res) => {
  const parsed = submitHoldSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Please fill in all required fields" });

  const { valid, mobile } = validateMobile(parsed.data.phone);
  if (!valid || !mobile) return res.status(400).json({ error: "Invalid mobile number" });

  const verifiedPhone = verifyPublicOtpToken(parsed.data.token);
  if (!verifiedPhone || verifiedPhone !== mobile) {
    return res.status(401).json({ error: "Please verify your phone number again." });
  }

  const hold = await prisma.hold.findUnique({ where: { id: req.params.id }, include: { event: true } });
  if (!hold || hold.source !== "PUBLIC_REQUEST") {
    return res.status(404).json({ error: "Request not found" });
  }
  if (hold.phone !== mobile) {
    return res.status(403).json({ error: "This reservation belongs to a different phone number." });
  }
  if (hold.releaseAt && hold.releaseAt < new Date()) {
    return res.status(410).json({ error: "Your reservation expired. Please reselect your stalls." });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const reference = await nextReference(tx, hold.eventId, hold.event.startDate);

    return tx.hold.update({
      where: { id: hold.id },
      data: {
        exhibitorName: parsed.data.exhibitorName,
        company: parsed.data.company,
        email: parsed.data.email || undefined,
        address: parsed.data.address,
        city: parsed.data.city,
        productService: parsed.data.productService,
        notes: parsed.data.notes || undefined,
        releaseAt: null,
        reference,
      },
      include: { stalls: { include: { stall: { include: { category: true } } } } },
    });
  });

  const total = updated.stalls.reduce((sum, s) => sum + Number(s.stall.category.price), 0);
  res.status(200).json({
    ok: true,
    requestId: updated.id,
    reference: updated.reference,
    stallCodes: updated.stalls.map((s) => s.stall.code),
    total,
  });
});
