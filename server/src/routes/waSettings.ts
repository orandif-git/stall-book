import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { verifyTurnstileToken } from "../lib/turnstile.js";

// Mounted with requireAuth + requireSuperAdmin in front (see index.ts) — every route here is
// Super Admin only, both because the BSP API key is sensitive and because misconfiguring the
// OTP template breaks the public booking portal for every customer at once.
export const waSettingsRouter = Router();

// GET /api/wa-settings — never returns the real API key, only whether one is set. The WA Setup
// page renders a masked placeholder for it and only sends a new value when the admin actually
// types one (see PUT below).
waSettingsRouter.get("/wa-settings", async (_req, res) => {
  const row = await prisma.whatsAppSettings.findFirst();
  res.json({
    bspBaseUrl: row?.bspBaseUrl ?? "",
    bspApiKeySet: !!row?.bspApiKey,
    bspFromPhoneNumberId: row?.bspFromPhoneNumberId ?? "",
    otpLength: row?.otpLength ?? 6,
    otpTtlSeconds: row?.otpTtlSeconds ?? 300,
    otpMaxAttempts: row?.otpMaxAttempts ?? 5,
    otpResendCooldownSeconds: row?.otpResendCooldownSeconds ?? 30,
    turnstileSiteKey: row?.turnstileSiteKey ?? "",
    turnstileSecretKeySet: !!row?.turnstileSecretKey,
    turnstileEnabled: row?.turnstileEnabled ?? true,
  });
});

const updateSettingsSchema = z.object({
  bspBaseUrl: z.string().optional(),
  // Blank/omitted = leave the stored key untouched — the field is never pre-filled with the
  // real value, so an empty string here means "the admin didn't type a new one," not "clear it."
  bspApiKey: z.string().optional(),
  bspFromPhoneNumberId: z.string().optional(),
  otpLength: z.coerce.number().int().min(4).max(10),
  otpTtlSeconds: z.coerce.number().int().min(30),
  otpMaxAttempts: z.coerce.number().int().min(1),
  otpResendCooldownSeconds: z.coerce.number().int().min(0),
  // Site key is public, so it's fine to always overwrite with whatever is submitted (blank
  // clears it). Secret key follows the same leave-untouched-if-blank rule as bspApiKey.
  turnstileSiteKey: z.string().optional(),
  turnstileSecretKey: z.string().optional(),
  turnstileEnabled: z.coerce.boolean().optional(),
});

waSettingsRouter.put("/wa-settings", async (req, res) => {
  const parsed = updateSettingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { bspApiKey, turnstileSecretKey, ...rest } = parsed.data;

  const existing = await prisma.whatsAppSettings.findFirst();
  const data = {
    ...rest,
    ...(bspApiKey ? { bspApiKey } : {}),
    ...(turnstileSecretKey ? { turnstileSecretKey } : {}),
  };

  const row = existing
    ? await prisma.whatsAppSettings.update({ where: { id: existing.id }, data })
    : await prisma.whatsAppSettings.create({ data });

  res.json({
    bspBaseUrl: row.bspBaseUrl ?? "",
    bspApiKeySet: !!row.bspApiKey,
    bspFromPhoneNumberId: row.bspFromPhoneNumberId ?? "",
    otpLength: row.otpLength,
    otpTtlSeconds: row.otpTtlSeconds,
    otpMaxAttempts: row.otpMaxAttempts,
    otpResendCooldownSeconds: row.otpResendCooldownSeconds,
    turnstileSiteKey: row.turnstileSiteKey ?? "",
    turnstileSecretKeySet: !!row.turnstileSecretKey,
    turnstileEnabled: row.turnstileEnabled,
  });
});

// POST /api/wa-settings/turnstile/test — lets the admin solve a real Turnstile challenge from
// the Integrations page and confirm the saved secret key actually verifies it with Cloudflare,
// without having to go through the whole public booking flow to find out.
const testTurnstileSchema = z.object({ token: z.string().min(1) });

waSettingsRouter.post("/wa-settings/turnstile/test", async (req, res) => {
  const parsed = testTurnstileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Missing token" });

  const row = await prisma.whatsAppSettings.findFirst();
  if (!row?.turnstileSecretKey) {
    return res.status(400).json({ error: "Save a secret key first." });
  }

  const success = await verifyTurnstileToken(parsed.data.token, req.ip || "unknown");
  res.json({ success });
});

const purposeSchema = z.enum(["OTP"]);

waSettingsRouter.get("/wa-settings/templates/:purpose", async (req, res) => {
  const purpose = purposeSchema.safeParse(req.params.purpose);
  if (!purpose.success) return res.status(400).json({ error: "Unknown template purpose" });

  const row = await prisma.messageTemplate.findUnique({ where: { purpose: purpose.data } });
  res.json({
    purpose: purpose.data,
    templateName: row?.templateName ?? "",
    templateLanguage: row?.templateLanguage ?? "en",
    fieldBindings: row?.fieldBindings ?? [],
  });
});

const fieldBindingSchema = z.object({ field: z.string().min(1), source: z.string().min(1) });
const updateTemplateSchema = z.object({
  templateName: z.string().min(1),
  templateLanguage: z.string().min(1).default("en"),
  fieldBindings: z.array(fieldBindingSchema),
});

waSettingsRouter.put("/wa-settings/templates/:purpose", async (req, res) => {
  const purpose = purposeSchema.safeParse(req.params.purpose);
  if (!purpose.success) return res.status(400).json({ error: "Unknown template purpose" });

  const parsed = updateTemplateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const row = await prisma.messageTemplate.upsert({
    where: { purpose: purpose.data },
    update: parsed.data,
    create: { purpose: purpose.data, ...parsed.data },
  });
  res.json({ purpose: row.purpose, templateName: row.templateName, templateLanguage: row.templateLanguage, fieldBindings: row.fieldBindings });
});
