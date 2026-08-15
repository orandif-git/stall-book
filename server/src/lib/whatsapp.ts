// BSP call: POST to the fully-configured bspBaseUrl (see waSettings.ts) as multipart/form-data
// — confirmed against this deployment's real BSP (app.jasinfo.in) via a working Postman
// request: field_1/field_2/button_0/phone_number/template_name/template_language as form
// fields, not a JSON body. Response contract is {result: "success"|"failed", message, data}
// (not the BNI project's {success: true/false} shape this was originally ported from).
// Connection + template config are resolved per-call from waSettings.ts (DB, via the WA Setup
// admin page — see server/src/routes/waSettings.ts), not read once at module load, so changes
// made in the UI take effect immediately without a server restart.
import { evaluateFieldBindings, getBspConnection, getMessageTemplate } from "./waSettings.js";

function logDelivery(data: Record<string, unknown>): void {
  console.log(JSON.stringify({ event: "whatsapp_send", at: new Date().toISOString(), ...data }));
}

function parseIntHeader(value: string | null): number | undefined {
  if (value === null) return undefined;
  const num = parseInt(value, 10);
  return Number.isNaN(num) ? undefined : num;
}

export interface SendOtpResult {
  success: boolean;
  error?: string;
}

/// Sends the OTP code via the configured WhatsApp BSP. If no connection/template is configured
/// yet (DB empty and no WHATSAPP_* env vars), falls back to logging the code to the server
/// console instead of failing outright — lets the whole flow be exercised end-to-end before
/// real credentials exist, and matches the app's pre-WA-Setup behavior exactly.
export async function sendOtpWhatsApp(phoneE164: string, code: string): Promise<SendOtpResult> {
  const [connection, template] = await Promise.all([getBspConnection(), getMessageTemplate("OTP")]);

  // API key is optional — some BSP setups put the key/token directly in the base URL instead
  // of a bearer header, so bspBaseUrl + a template are the only things actually required.
  if (!connection.bspBaseUrl || !template) {
    console.log(
      JSON.stringify({
        event: "whatsapp_otp_dev_fallback",
        note: "WhatsApp BSP not configured (WA Setup page or WHATSAPP_* env vars) — logging code instead of sending",
        phone: phoneE164,
        code,
        at: new Date().toISOString(),
      }),
    );
    return { success: true };
  }

  const fields = evaluateFieldBindings(template.fieldBindings, { otp: { code } });
  // bspBaseUrl is the complete, ready-to-POST endpoint — not a host to append a fixed path
  // suffix to. Some BSP setups (this one included) put an auth token directly in the URL's
  // query string, so appending anything after it would corrupt the token rather than route to
  // a sub-path.
  const endpointUrl = connection.bspBaseUrl;
  const maxRetries = 3;
  let attempt = 0;

  for (;;) {
    const fieldsToSend: Record<string, string> = {
      phone_number: phoneE164,
      template_name: template.templateName,
      template_language: template.templateLanguage,
      ...(connection.bspFromPhoneNumberId ? { from_phone_number_id: connection.bspFromPhoneNumberId } : {}),
      ...fields,
    };
    // multipart/form-data, not JSON — this BSP rejects a JSON body. Letting fetch set its own
    // Content-Type (with the multipart boundary) rather than setting one manually.
    const form = new FormData();
    for (const [key, value] of Object.entries(fieldsToSend)) form.append(key, value);

    // A network-level failure here (bad hostname, connection refused, timeout) throws instead
    // of resolving — must not be allowed to become an unhandled rejection, which would crash
    // the whole server process for every OTP request in flight, not just this one.
    let res: Response;
    try {
      res = await fetch(endpointUrl, {
        method: "POST",
        headers: connection.bspApiKey ? { Authorization: `Bearer ${connection.bspApiKey}` } : {},
        body: form,
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : "Network error reaching the WhatsApp BSP";
      logDelivery({ phoneNumber: phoneE164, templateName: template.templateName, attempt, success: false, error });
      return { success: false, error };
    }

    const rawText = await res.text();
    let json: Record<string, unknown> | null = null;
    try {
      json = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      // Non-JSON response — bspResponseRaw below carries it verbatim for diagnosis.
    }
    const rateLimitRemaining = parseIntHeader(res.headers.get("x-ratelimit-remaining"));
    const rateLimitResetUnix = parseIntHeader(res.headers.get("x-ratelimit-reset"));
    // This BSP reports success via {result: "success"}, not {success: true} — accept either
    // shape so this stays compatible if a future BSP uses the other convention.
    const success = res.ok && (json?.result === "success" || json?.success === true);
    const error = !success
      ? ((json && typeof json.message === "string" ? json.message : null) ??
        (json && typeof json.error === "string" ? json.error : null) ??
        `HTTP ${res.status}`)
      : undefined;
    const errorCode = json && typeof json.code === "string" ? json.code : undefined;

    // bspResponse(Raw) is only here to make send failures diagnosable.
    logDelivery({
      phoneNumber: phoneE164,
      templateName: template.templateName,
      responseStatus: res.status,
      attempt,
      success,
      error,
      errorCode,
      bspResponse: json,
      bspResponseRaw: json ? undefined : rawText.slice(0, 500),
    });

    if (success) return { success: true };

    const isRateLimited = errorCode === "RATE_LIMITED" || (rateLimitRemaining !== undefined && rateLimitRemaining <= 0);
    attempt++;
    if (!isRateLimited || attempt > maxRetries) return { success: false, error };

    const backoffMs = rateLimitResetUnix ? Math.max(0, rateLimitResetUnix * 1000 - Date.now()) : 500 * 2 ** attempt;
    await new Promise((resolve) => setTimeout(resolve, Math.min(backoffMs, 10_000)));
  }
}
