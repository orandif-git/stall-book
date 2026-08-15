import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Plus, Trash2, XCircle } from "lucide-react";
import { api, type FieldBinding, type MessageTemplate, type WhatsAppSettings } from "../lib/api";
import { Topbar } from "../components/Topbar";
import { TurnstileWidget } from "../components/public/TurnstileWidget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";

// Same shortcode.property convention as the BNI project's template field bindings — kept small
// since this app only sends one kind of message today. Extend this list (and BindingContext in
// server/src/lib/waSettings.ts) when a second purpose (e.g. request-approved notification) is
// added.
const KNOWN_BINDING_SOURCES = ["otp.code"];

function axiosMessage(err: unknown): string {
  if (err && typeof err === "object" && "response" in err) {
    const response = (err as { response?: { data?: { error?: unknown } } }).response;
    const e = response?.data?.error;
    if (typeof e === "string") return e;
    if (e) return JSON.stringify(e);
  }
  return "Something went wrong";
}

// Every external service this app talks to on the public booking portal's behalf — WhatsApp
// (OTP delivery) and Cloudflare Turnstile (bot protection) — lives on this one Super-Admin-only
// page rather than being split across service-named pages.
export function IntegrationsPage() {
  return (
    <div className="min-h-screen bg-muted/20">
      <Topbar crumb="Integrations" />
      <main className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Integrations</h1>
          <p className="text-sm text-muted-foreground">
            Configure the external services the public booking portal talks to.
          </p>
        </div>
        <Tabs defaultValue="whatsapp">
          <TabsList>
            <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
            <TabsTrigger value="turnstile">Turnstile</TabsTrigger>
          </TabsList>
          <TabsContent value="whatsapp" className="space-y-6">
            <BspConnectionCard />
            <OtpTunablesCard />
            <OtpTemplateCard />
          </TabsContent>
          <TabsContent value="turnstile" className="space-y-6">
            <TurnstileCard />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function SavedNote({ saved, error }: { saved: boolean; error: string | null }) {
  if (error) {
    return <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>;
  }
  if (saved) {
    return <p className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">Saved.</p>;
  }
  return null;
}

function BspConnectionCard() {
  const [settings, setSettings] = useState<WhatsAppSettings | null>(null);
  const [bspBaseUrl, setBspBaseUrl] = useState("");
  const [bspApiKey, setBspApiKey] = useState("");
  const [bspFromPhoneNumberId, setBspFromPhoneNumberId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<WhatsAppSettings>("/wa-settings").then(({ data }) => {
      setSettings(data);
      setBspBaseUrl(data.bspBaseUrl);
      setBspFromPhoneNumberId(data.bspFromPhoneNumberId);
    });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const { data } = await api.put<WhatsAppSettings>("/wa-settings", {
        bspBaseUrl,
        bspApiKey: bspApiKey || undefined,
        bspFromPhoneNumberId,
        otpLength: settings.otpLength,
        otpTtlSeconds: settings.otpTtlSeconds,
        otpMaxAttempts: settings.otpMaxAttempts,
        otpResendCooldownSeconds: settings.otpResendCooldownSeconds,
      });
      setSettings(data);
      setBspApiKey("");
      setSaved(true);
    } catch (err) {
      setError(axiosMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>WhatsApp BSP connection</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>WhatsApp BSP connection</CardTitle>
        <CardDescription>Business Solution Provider API used to send OTP codes.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="wa-base-url">Base URL</Label>
            <Input
              id="wa-base-url"
              placeholder="https://your-bsp.example.com"
              value={bspBaseUrl}
              onChange={(e) => setBspBaseUrl(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wa-api-key">API key (optional)</Label>
            <Input
              id="wa-api-key"
              type="password"
              placeholder={settings.bspApiKeySet ? "•••••••••••••••• (unchanged)" : "Optional — leave blank if not needed"}
              value={bspApiKey}
              onChange={(e) => setBspApiKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {settings.bspApiKeySet
                ? "A key is already saved — leave blank to keep it."
                : "Only needed if your BSP expects a bearer token. If the key is already embedded in the Base URL, leave this blank."}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wa-from-id">Default from_phone_number_id</Label>
            <Input
              id="wa-from-id"
              placeholder="Optional"
              value={bspFromPhoneNumberId}
              onChange={(e) => setBspFromPhoneNumberId(e.target.value)}
            />
          </div>
          <SavedNote saved={saved} error={error} />
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? "Saving…" : "Save connection"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function OtpTunablesCard() {
  const [settings, setSettings] = useState<WhatsAppSettings | null>(null);
  const [otpLength, setOtpLength] = useState("6");
  const [otpTtlSeconds, setOtpTtlSeconds] = useState("300");
  const [otpMaxAttempts, setOtpMaxAttempts] = useState("5");
  const [otpResendCooldownSeconds, setOtpResendCooldownSeconds] = useState("30");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<WhatsAppSettings>("/wa-settings").then(({ data }) => {
      setSettings(data);
      setOtpLength(String(data.otpLength));
      setOtpTtlSeconds(String(data.otpTtlSeconds));
      setOtpMaxAttempts(String(data.otpMaxAttempts));
      setOtpResendCooldownSeconds(String(data.otpResendCooldownSeconds));
    });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const { data } = await api.put<WhatsAppSettings>("/wa-settings", {
        bspBaseUrl: settings.bspBaseUrl,
        bspFromPhoneNumberId: settings.bspFromPhoneNumberId,
        otpLength: Number(otpLength),
        otpTtlSeconds: Number(otpTtlSeconds),
        otpMaxAttempts: Number(otpMaxAttempts),
        otpResendCooldownSeconds: Number(otpResendCooldownSeconds),
      });
      setSettings(data);
      setSaved(true);
    } catch (err) {
      setError(axiosMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>OTP verification</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>OTP verification</CardTitle>
        <CardDescription>Applies to every phone verification on the public booking portal.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="wa-otp-length">Code length</Label>
              <Input id="wa-otp-length" type="number" min={4} max={10} value={otpLength} onChange={(e) => setOtpLength(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wa-otp-ttl">Expires after (seconds)</Label>
              <Input id="wa-otp-ttl" type="number" min={30} value={otpTtlSeconds} onChange={(e) => setOtpTtlSeconds(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wa-otp-attempts">Max attempts</Label>
              <Input id="wa-otp-attempts" type="number" min={1} value={otpMaxAttempts} onChange={(e) => setOtpMaxAttempts(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wa-otp-cooldown">Resend cooldown (seconds)</Label>
              <Input
                id="wa-otp-cooldown"
                type="number"
                min={0}
                value={otpResendCooldownSeconds}
                onChange={(e) => setOtpResendCooldownSeconds(e.target.value)}
              />
            </div>
          </div>
          <SavedNote saved={saved} error={error} />
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? "Saving…" : "Save OTP settings"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function OtpTemplateCard() {
  const [template, setTemplate] = useState<MessageTemplate | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateLanguage, setTemplateLanguage] = useState("en");
  const [bindings, setBindings] = useState<FieldBinding[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<MessageTemplate>("/wa-settings/templates/OTP").then(({ data }) => {
      setTemplate(data);
      setTemplateName(data.templateName);
      setTemplateLanguage(data.templateLanguage);
      setBindings(data.fieldBindings.length > 0 ? data.fieldBindings : [{ field: "field_1", source: "otp.code" }, { field: "button_0", source: "otp.code" }]);
    });
  }, []);

  function updateBinding(index: number, patch: Partial<FieldBinding>) {
    setBindings((prev) => prev.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  }

  function removeBinding(index: number) {
    setBindings((prev) => prev.filter((_, i) => i !== index));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const { data } = await api.put<MessageTemplate>("/wa-settings/templates/OTP", {
        templateName,
        templateLanguage,
        fieldBindings: bindings.filter((b) => b.field.trim() && b.source.trim()),
      });
      setTemplate(data);
      setSaved(true);
    } catch (err) {
      setError(axiosMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!template) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>OTP message template</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>OTP message template</CardTitle>
        <CardDescription>The Meta-approved WhatsApp template used to deliver the code, and how its variables map to the code.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="wa-tpl-name">Template name (as approved by Meta)</Label>
              <Input id="wa-tpl-name" value={templateName} onChange={(e) => setTemplateName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wa-tpl-lang">Language</Label>
              <Input id="wa-tpl-lang" value={templateLanguage} onChange={(e) => setTemplateLanguage(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Field bindings</Label>
            <p className="text-xs text-muted-foreground">
              Each row maps a BSP payload key (e.g. <code className="font-mono">field_1</code>, <code className="font-mono">button_0</code>) to{" "}
              <code className="font-mono">otp.code</code>, or to fixed text via <code className="font-mono">static:your text</code>.
            </p>
            <datalist id="wa-binding-sources">
              {KNOWN_BINDING_SOURCES.map((source) => (
                <option key={source} value={source} />
              ))}
            </datalist>
            <div className="space-y-2">
              {bindings.map((binding, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={binding.field}
                    onChange={(e) => updateBinding(i, { field: e.target.value })}
                    placeholder="field_1"
                    className="w-32 shrink-0 font-mono text-xs"
                  />
                  <Input
                    value={binding.source}
                    onChange={(e) => updateBinding(i, { source: e.target.value })}
                    list="wa-binding-sources"
                    placeholder="otp.code"
                    className="flex-1 font-mono text-xs"
                  />
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeBinding(i)} title="Remove">
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setBindings((prev) => [...prev, { field: "", source: "" }])}
            >
              <Plus />
              Add field
            </Button>
          </div>

          <SavedNote saved={saved} error={error} />
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? "Saving…" : "Save template"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// Cloudflare Turnstile keys, gating /api/public/otp/request against scripted spam — kept here
// (DB-backed, Super Admin only) rather than in .env so they can be rotated without a deploy.
function TurnstileCard() {
  const [settings, setSettings] = useState<WhatsAppSettings | null>(null);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState("");
  const [turnstileSecretKey, setTurnstileSecretKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

  useEffect(() => {
    api.get<WhatsAppSettings>("/wa-settings").then(({ data }) => {
      setSettings(data);
      setTurnstileSiteKey(data.turnstileSiteKey);
    });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const { data } = await api.put<WhatsAppSettings>("/wa-settings", {
        bspBaseUrl: settings.bspBaseUrl,
        bspFromPhoneNumberId: settings.bspFromPhoneNumberId,
        otpLength: settings.otpLength,
        otpTtlSeconds: settings.otpTtlSeconds,
        otpMaxAttempts: settings.otpMaxAttempts,
        otpResendCooldownSeconds: settings.otpResendCooldownSeconds,
        turnstileSiteKey,
        turnstileSecretKey: turnstileSecretKey || undefined,
      });
      setSettings(data);
      setTurnstileSecretKey("");
      setSaved(true);
    } catch (err) {
      setError(axiosMessage(err));
    } finally {
      setSaving(false);
    }
  }

  // The on/off switch saves immediately, independent of the key fields below — an admin
  // reaching for this is usually reacting to something right now (Turnstile misbehaving,
  // customers stuck) and shouldn't have to also touch the keys just to flip it off.
  async function toggleEnabled(next: boolean) {
    if (!settings) return;
    setToggleError(null);
    setToggling(true);
    const previous = settings;
    setSettings({ ...settings, turnstileEnabled: next });
    try {
      const { data } = await api.put<WhatsAppSettings>("/wa-settings", {
        bspBaseUrl: settings.bspBaseUrl,
        bspFromPhoneNumberId: settings.bspFromPhoneNumberId,
        otpLength: settings.otpLength,
        otpTtlSeconds: settings.otpTtlSeconds,
        otpMaxAttempts: settings.otpMaxAttempts,
        otpResendCooldownSeconds: settings.otpResendCooldownSeconds,
        turnstileEnabled: next,
      });
      setSettings(data);
    } catch (err) {
      setSettings(previous);
      setToggleError(axiosMessage(err));
    } finally {
      setToggling(false);
    }
  }

  if (!settings) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bot protection (Turnstile)</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bot protection (Turnstile)</CardTitle>
        <CardDescription>
          Cloudflare Turnstile widget shown before a customer can request an OTP — stops scripted spam from
          costing WhatsApp send fees or getting the number flagged by Meta.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
          <div>
            <div className="text-sm font-medium text-foreground">Enabled</div>
            <p className="text-xs text-muted-foreground">
              {settings.turnstileEnabled
                ? "Customers must pass the check before requesting an OTP."
                : "Off — customers can request an OTP with no bot check. Keys stay saved."}
            </p>
          </div>
          <Switch checked={settings.turnstileEnabled} disabled={toggling} onCheckedChange={toggleEnabled} />
        </div>
        {toggleError && <p className="mt-2 text-xs text-destructive">{toggleError}</p>}
      </CardContent>
      <CardContent className="border-t pt-5">
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="wa-ts-site">Site key</Label>
            <Input
              id="wa-ts-site"
              placeholder="0x4AAAAAAA..."
              value={turnstileSiteKey}
              onChange={(e) => setTurnstileSiteKey(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wa-ts-secret">Secret key</Label>
            <Input
              id="wa-ts-secret"
              type="password"
              placeholder={settings.turnstileSecretKeySet ? "•••••••••••••••• (unchanged)" : "0x4AAAAAAA..."}
              value={turnstileSecretKey}
              onChange={(e) => setTurnstileSecretKey(e.target.value)}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              {settings.turnstileSecretKeySet
                ? "A key is already saved — leave blank to keep it."
                : "Never sent back to the browser once saved."}
            </p>
          </div>
          <SavedNote saved={saved} error={error} />
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? "Saving…" : "Save bot protection"}
          </Button>
        </form>
      </CardContent>
      {settings.turnstileSiteKey && settings.turnstileSecretKeySet && (
        <CardContent className="border-t pt-5">
          <TurnstileTest siteKey={settings.turnstileSiteKey} />
        </CardContent>
      )}
    </Card>
  );
}

// Solves a real Turnstile challenge and round-trips the token through the same server-side
// verification the public OTP endpoint uses — confirms the site key + secret key actually work
// together with Cloudflare, without needing to go through the whole booking flow to find out.
function TurnstileTest({ siteKey }: { siteKey: string }) {
  const [nonce, setNonce] = useState(0);
  const [status, setStatus] = useState<"idle" | "checking" | "success" | "failure">("idle");

  async function onVerify(token: string) {
    setStatus("checking");
    try {
      const { data } = await api.post<{ success: boolean }>("/wa-settings/turnstile/test", { token });
      setStatus(data.success ? "success" : "failure");
    } catch {
      setStatus("failure");
    }
  }

  function retry() {
    setStatus("idle");
    setNonce((n) => n + 1);
  }

  return (
    <div className="space-y-3">
      <Label>Test connection</Label>
      <p className="text-xs text-muted-foreground">Solve the widget below to confirm the keys actually work.</p>
      {status !== "success" && (
        <TurnstileWidget
          key={nonce}
          siteKey={siteKey}
          appearance="always"
          onVerify={onVerify}
          onExpire={() => setStatus("idle")}
        />
      )}
      {status === "checking" && <p className="text-sm text-muted-foreground">Checking…</p>}
      {status === "success" && (
        <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          <CheckCircle2 className="size-4" />
          Verified successfully — the widget and secret key are working together.
        </div>
      )}
      {status === "failure" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <XCircle className="size-4" />
            Verification failed — double-check the site key and secret key match the same Turnstile widget.
          </div>
          <Button type="button" variant="outline" size="sm" onClick={retry}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
