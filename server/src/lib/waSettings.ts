// Resolves WhatsApp BSP connection, OTP tunables, and message templates — DB first (the
// WA Setup admin page, Super Admin only), falling back to the server/.env WHATSAPP_* vars this
// app shipped with originally, so nothing breaks before an admin has saved anything in the new
// UI. server/src/lib/whatsapp.ts falls back once more, to a dev-mode console log, if neither is
// configured — that innermost fallback is unchanged from before this file existed.
import { prisma } from "./prisma.js";

export interface ResolvedBspConnection {
  bspBaseUrl: string | null;
  bspApiKey: string | null;
  bspFromPhoneNumberId: string | null;
}

export interface OtpTunables {
  otpLength: number;
  otpTtlSeconds: number;
  otpMaxAttempts: number;
  otpResendCooldownSeconds: number;
}

const ENV_OTP_DEFAULTS: OtpTunables = {
  otpLength: 6,
  otpTtlSeconds: 300,
  otpMaxAttempts: 5,
  otpResendCooldownSeconds: 30,
};

export async function getBspConnection(): Promise<ResolvedBspConnection> {
  const row = await prisma.whatsAppSettings.findFirst();
  return {
    bspBaseUrl: row?.bspBaseUrl ?? process.env.WHATSAPP_BSP_BASE_URL ?? null,
    bspApiKey: row?.bspApiKey ?? process.env.WHATSAPP_BSP_API_KEY ?? null,
    bspFromPhoneNumberId: row?.bspFromPhoneNumberId ?? process.env.WHATSAPP_FROM_PHONE_NUMBER_ID ?? null,
  };
}

export async function getOtpTunables(): Promise<OtpTunables> {
  const row = await prisma.whatsAppSettings.findFirst();
  if (!row) return ENV_OTP_DEFAULTS;
  return {
    otpLength: row.otpLength,
    otpTtlSeconds: row.otpTtlSeconds,
    otpMaxAttempts: row.otpMaxAttempts,
    otpResendCooldownSeconds: row.otpResendCooldownSeconds,
  };
}

// --- Message template + field bindings (same {field, source} shape as the BNI project) ---

export interface FieldBinding {
  /** The BSP payload key, e.g. "field_1" or "button_0". */
  field: string;
  /** "otp.code", or "static:<literal text>" for a fixed value. */
  source: string;
}

export const KNOWN_BINDING_SOURCES = ["otp.code"] as const;

export type BindingContext = Partial<Record<"otp", Record<string, string>>>;

/// Resolves field bindings against a context into the payload sent to the BSP. Throws on a
/// binding that references data not present in the context, so a misconfigured template fails
/// loudly at send time rather than silently sending blanks.
export function evaluateFieldBindings(bindings: FieldBinding[], context: BindingContext): Record<string, string> {
  const result: Record<string, string> = {};
  for (const binding of bindings) {
    if (binding.source.startsWith("static:")) {
      result[binding.field] = binding.source.slice("static:".length);
      continue;
    }
    const [group, prop] = binding.source.split(".");
    const groupData = group ? context[group as keyof BindingContext] : undefined;
    const value = groupData && prop ? groupData[prop] : undefined;
    if (value === undefined) {
      throw new Error(`Template binding "${binding.source}" (-> ${binding.field}) has no matching data`);
    }
    result[binding.field] = value;
  }
  return result;
}

export interface ResolvedTemplate {
  templateName: string;
  templateLanguage: string;
  fieldBindings: FieldBinding[];
}

export async function getMessageTemplate(purpose: "OTP"): Promise<ResolvedTemplate | null> {
  const row = await prisma.messageTemplate.findUnique({ where: { purpose } });
  if (row) {
    return {
      templateName: row.templateName,
      templateLanguage: row.templateLanguage,
      fieldBindings: row.fieldBindings as unknown as FieldBinding[],
    };
  }

  if (purpose === "OTP" && process.env.WHATSAPP_OTP_TEMPLATE_NAME) {
    return {
      templateName: process.env.WHATSAPP_OTP_TEMPLATE_NAME,
      templateLanguage: process.env.WHATSAPP_OTP_TEMPLATE_LANGUAGE ?? "en",
      fieldBindings: [
        { field: process.env.WHATSAPP_OTP_BODY_FIELD ?? "field_1", source: "otp.code" },
        { field: "button_0", source: "otp.code" },
      ],
    };
  }

  return null;
}
