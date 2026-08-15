import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { publicApi, type PublicConfig } from "../../lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TurnstileWidget } from "./TurnstileWidget";

function axiosMessage(err: unknown): string {
  if (err && typeof err === "object" && "response" in err) {
    const response = (err as { response?: { data?: { error?: unknown } } }).response;
    const e = response?.data?.error;
    if (typeof e === "string") return e;
    if (e) return JSON.stringify(e);
  }
  return "Something went wrong";
}

interface Props {
  phone: string;
  onPhoneChange: (phone: string) => void;
  onVerified: (token: string) => void;
}

// Phone verification — the gate between picking stalls and filling in the rest of the details.
// See the plan: verifying here (not before browsing, not at final submit) is the deliberate
// choice — nothing is written to the DB before this, and the customer only proves phone
// ownership once, right when their intent is already clear (they've picked stalls).
export function PublicVerifyStep({ phone, onPhoneChange, onVerified }: Props) {
  const [stage, setStage] = useState<"phone" | "code">("phone");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileNonce, setTurnstileNonce] = useState(0);

  useEffect(() => {
    publicApi.get<PublicConfig>("/config").then(({ data }) => setConfig(data));
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const requiresTurnstile = !!config?.turnstileSiteKey;

  async function sendCode() {
    setError(null);
    setBusy(true);
    try {
      await publicApi.post("/otp/request", { phone, turnstileToken: turnstileToken ?? undefined });
      setStage("code");
      setCooldown(30);
    } catch (err) {
      setError(axiosMessage(err));
    } finally {
      setBusy(false);
      // Turnstile tokens are single-use — force a fresh challenge for the next send/resend.
      setTurnstileToken(null);
      setTurnstileNonce((n) => n + 1);
    }
  }

  async function verifyCode() {
    setError(null);
    setBusy(true);
    try {
      const { data } = await publicApi.post<{ ok: true; token: string }>("/otp/verify", { phone, code });
      onVerified(data.token);
    } catch (err) {
      setError(axiosMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <ShieldCheck className="size-4.5 text-primary" />
        Verify your phone number
      </div>
      <p className="text-sm text-muted-foreground">
        We'll send a one-time code on WhatsApp to confirm it's really you before reserving your stalls.
      </p>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="pv-phone">Mobile number</Label>
        <div className="flex gap-2">
          <span className="flex items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">+91</span>
          <Input
            id="pv-phone"
            inputMode="numeric"
            maxLength={10}
            placeholder="10-digit mobile number"
            value={phone}
            disabled={stage === "code"}
            onChange={(e) => onPhoneChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
            className="flex-1"
          />
        </div>
      </div>

      {stage === "phone" ? (
        <div className="space-y-3">
          {requiresTurnstile && phone.length === 10 && (
            <TurnstileWidget
              key={turnstileNonce}
              siteKey={config!.turnstileSiteKey!}
              onVerify={setTurnstileToken}
              onExpire={() => setTurnstileToken(null)}
            />
          )}
          <Button
            onClick={sendCode}
            disabled={busy || phone.length !== 10 || (requiresTurnstile && !turnstileToken)}
            className="w-full"
          >
            Send code
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pv-code">6-digit code</Label>
            <Input
              id="pv-code"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="text-center text-lg tracking-[0.5em]"
            />
          </div>
          <Button onClick={verifyCode} disabled={busy || code.length !== 6} className="w-full">
            Verify &amp; continue
          </Button>
          {cooldown > 0 ? (
            <p className="w-full text-center text-sm text-muted-foreground">Resend code in {cooldown}s</p>
          ) : (
            <div className="space-y-3">
              {requiresTurnstile && (
                <TurnstileWidget
                  key={turnstileNonce}
                  siteKey={config!.turnstileSiteKey!}
                  onVerify={setTurnstileToken}
                  onExpire={() => setTurnstileToken(null)}
                />
              )}
              <button
                type="button"
                onClick={sendCode}
                disabled={busy || (requiresTurnstile && !turnstileToken)}
                className="w-full text-center text-sm text-muted-foreground underline-offset-2 disabled:no-underline disabled:opacity-50 enabled:hover:underline"
              >
                Resend code
              </button>
            </div>
          )}
        </div>
      )}

      {requiresTurnstile && (
        <p className="text-center text-xs text-muted-foreground">
          This site is protected by Cloudflare Turnstile.
        </p>
      )}
    </div>
  );
}
