import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Store } from "lucide-react";
import { AnimatedCheck } from "../components/public/AnimatedCheck";
import chamberLogo from "../assets/chamber-trade-fair-logo.jpg";

// Sponsor logo for this one event only (Tamil Nadu Chamber of Commerce & Industry / Madurai
// Economic Chamber) — not a general per-event feature, so it's just matched by slug rather than
// a new DB field. Bundled as a frontend asset (not an admin-uploaded file) so it ships with
// every deploy automatically — no separate seed step needed in prod.
const CHAMBER_LOGO_EVENT_SLUG = "chamber-trade-fair-2026";
import { publicApi, type PublicEvent, type PublicFloorPlanData } from "../lib/api";
import { formatCurrency } from "../lib/format";
import { Button } from "@/components/ui/button";
import { PublicStallPicker } from "../components/public/PublicStallPicker";
import { PublicVerifyStep } from "../components/public/PublicVerifyStep";
import { PublicDetailsForm } from "../components/public/PublicDetailsForm";

function axiosMessage(err: unknown): string {
  if (err && typeof err === "object" && "response" in err) {
    const response = (err as { response?: { data?: { error?: unknown } } }).response;
    const e = response?.data?.error;
    if (typeof e === "string") return e;
    if (e) return JSON.stringify(e);
  }
  return "Something went wrong";
}

type Step = "pick" | "verify" | "details" | "done";

// The whole public, no-login customer journey: pick stalls -> verify phone -> fill details ->
// submit for admin review. See the plan doc for why phone verification sits right after stall
// selection (not before browsing, not at final submit) and why the reservation Hold is created
// at verification time, not at submission. This page owns the step machine; each step is a
// separate component under components/public/.
export function PublicBookingPage() {
  const { eventSlug = "" } = useParams();

  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [floorplan, setFloorplan] = useState<PublicFloorPlanData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>("pick");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [phone, setPhone] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [holdId, setHoldId] = useState<string | null>(null);
  const [releaseAt, setReleaseAt] = useState<string | null>(null);
  const [holdError, setHoldError] = useState<string | null>(null);
  const [creatingHold, setCreatingHold] = useState(false);

  const [result, setResult] = useState<{ requestId: string; reference: string; stallCodes: string[]; total: number } | null>(null);

  const loadFloorplan = useCallback(async () => {
    const { data } = await publicApi.get<PublicFloorPlanData>(`/events/${eventSlug}/floorplan`);
    setFloorplan(data);
  }, [eventSlug]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await publicApi.get<PublicEvent>(`/events/${eventSlug}`);
        setEvent(data);
        await loadFloorplan();
      } catch (err) {
        setLoadError(axiosMessage(err));
      }
    })();
  }, [eventSlug, loadFloorplan]);

  const selectedStalls = useMemo(
    () => (floorplan?.stalls ?? []).filter((s) => selected.has(s.id)),
    [floorplan, selected],
  );
  const total = selectedStalls.reduce((sum, s) => sum + s.price, 0);

  function toggleStall(stall: { id: string }) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(stall.id)) next.delete(stall.id);
      else next.add(stall.id);
      return next;
    });
  }

  async function createHold(tok: string) {
    setHoldError(null);
    setCreatingHold(true);
    try {
      const { data } = await publicApi.post<{ holdId: string; releaseAt: string; stallCodes: string[] }>(
        `/events/${eventSlug}/holds`,
        { stallIds: Array.from(selected), phone, token: tok },
      );
      setHoldId(data.holdId);
      setReleaseAt(data.releaseAt);
      setStep("details");
    } catch (err) {
      const status = err && typeof err === "object" && "response" in err ? (err as { response?: { status?: number } }).response?.status : undefined;
      if (status === 401) {
        setToken(null);
        setStep("verify");
      } else {
        setHoldError(axiosMessage(err));
        await loadFloorplan();
        setStep("pick");
      }
    } finally {
      setCreatingHold(false);
    }
  }

  function handleContinueFromPick() {
    setHoldError(null);
    if (token) {
      createHold(token);
    } else {
      setStep("verify");
    }
  }

  function handleVerified(tok: string) {
    setToken(tok);
    createHold(tok);
  }

  function handleReselect() {
    setHoldId(null);
    setReleaseAt(null);
    setSelected(new Set());
    setStep("pick");
    loadFloorplan();
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4 text-center">
        <div>
          <p className="text-lg font-semibold text-foreground">This booking link isn't available</p>
          <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!event || !floorplan) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 pb-28">
      <header className="border-b border-border bg-background px-4 py-4">
        <div className="mx-auto flex max-w-xl items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Store className="size-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-foreground">{event.name}</div>
            <div className="truncate text-xs text-muted-foreground">{event.venue}</div>
          </div>
          {event.slug === CHAMBER_LOGO_EVENT_SLUG && (
            <img
              src={chamberLogo}
              alt="Tamil Nadu Chamber of Commerce & Industry, Madurai — Madurai Economic Chamber"
              className="h-14 w-auto max-w-[45%] shrink-0 object-contain sm:h-16"
            />
          )}
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-4">
        {step === "pick" && (
          <div className="space-y-3">
            <div>
              <h1 className="text-lg font-semibold text-foreground">Choose your stalls</h1>
              <p className="text-sm text-muted-foreground">Tap to select — you can pick more than one.</p>
            </div>
            {holdError && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{holdError}</p>
            )}
            <PublicStallPicker data={floorplan} selected={selected} onToggle={toggleStall} />
          </div>
        )}

        {step === "verify" && (
          <div className="rounded-lg border border-border bg-background p-4">
            <PublicVerifyStep phone={phone} onPhoneChange={setPhone} onVerified={handleVerified} />
          </div>
        )}

        {step === "details" && holdId && (
          <div className="space-y-3">
            {releaseAt && <ReservationCountdown releaseAt={releaseAt} onExpired={handleReselect} />}
            <div className="rounded-lg border border-border bg-background p-4">
              <PublicDetailsForm
                holdId={holdId}
                phone={phone}
                token={token ?? ""}
                selectedStalls={selectedStalls}
                onSubmitted={(r) => {
                  setResult(r);
                  setStep("done");
                }}
                onExpired={handleReselect}
              />
            </div>
          </div>
        )}

        {step === "done" && result && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-background p-6 text-center">
            <AnimatedCheck />
            <h1 className="text-lg font-semibold text-foreground">Request submitted</h1>
            <p className="text-sm text-muted-foreground">
              We've received your request for {result.stallCodes.join(", ")} ({formatCurrency(result.total)}). Our team will review it and
              contact you on your registered number.
            </p>
            <p className="font-mono text-sm font-semibold text-foreground">{result.reference}</p>
          </div>
        )}
      </main>

      {step === "pick" && selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
          <div className="mx-auto flex max-w-xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs text-muted-foreground">{selected.size} stall{selected.size > 1 ? "s" : ""} selected</div>
              <div className="text-base font-semibold text-foreground">{formatCurrency(total)}</div>
            </div>
            <Button onClick={handleContinueFromPick} disabled={creatingHold} size="lg">
              {creatingHold ? "Reserving…" : "Continue"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReservationCountdown({ releaseAt, onExpired }: { releaseAt: string; onExpired: () => void }) {
  const [secondsLeft, setSecondsLeft] = useState(() => Math.max(0, Math.round((new Date(releaseAt).getTime() - Date.now()) / 1000)));

  useEffect(() => {
    const t = setInterval(() => {
      const s = Math.max(0, Math.round((new Date(releaseAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(s);
      if (s === 0) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
  }, [releaseAt]);

  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, "0");

  if (secondsLeft === 0) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        <span>Your reservation expired.</span>
        <Button size="sm" variant="outline" onClick={onExpired}>
          Reselect stalls
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-center text-sm text-amber-900">
      Reserved for <span className="font-mono font-semibold">{mm}:{ss}</span> — complete your details before this expires
    </div>
  );
}
