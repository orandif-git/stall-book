import { useState, type FormEvent } from "react";
import { api, type BookedByOrg, type Stall } from "../lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { OrgToggle } from "./OrgToggle";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface Props {
  eventId: string;
  stalls: Stall[];
  onClose: () => void;
  onBlocked: () => void;
}

export function BlockStallsPanel({ eventId, stalls, onClose, onBlocked }: Props) {
  const [exhibitorName, setExhibitorName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [bookedByOrg, setBookedByOrg] = useState<BookedByOrg>("MEC");
  const [releaseAt, setReleaseAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post(`/events/${eventId}/holds`, {
        stallIds: stalls.map((s) => s.id),
        exhibitorName,
        company,
        phone,
        notes: notes || undefined,
        bookedByOrg,
        releaseAt: releaseAt || undefined,
      });
      onBlocked();
    } catch (err) {
      setError(axiosMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    // Non-modal, no overlay, outside clicks pass through: same reasoning as NewBookingPanel —
    // the floor map must stay clickable behind this so more stalls can be added to the block.
    <Sheet open modal={false} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        showOverlay={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="flex flex-col shadow-2xl ring-1 ring-border"
      >
        <SheetHeader>
          <SheetTitle>Block {stalls.length === 1 ? "stall" : `${stalls.length} stalls`}</SheetTitle>
          <SheetDescription>Take these off the market — reserve, hold, or mark unavailable.</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4">
          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Stalls</div>
            <div className="flex flex-wrap gap-1.5">
              {stalls.map((s) => (
                <Badge key={s.id} variant="secondary">
                  {s.code}
                </Badge>
              ))}
            </div>
          </div>

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <form id="block-stalls-form" onSubmit={onSubmit} className="space-y-4">
            <OrgToggle value={bookedByOrg} onChange={setBookedByOrg} />
            <div className="space-y-1.5">
              <Label htmlFor="bl-name">Exhibitor name</Label>
              <Input
                id="bl-name"
                value={exhibitorName}
                onChange={(e) => setExhibitorName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bl-company">Company</Label>
              <Input
                id="bl-company"
                placeholder="Shown on hover, and publicly if that's turned on"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bl-phone">Phone</Label>
              <Input id="bl-phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bl-notes">Notes</Label>
              <Textarea id="bl-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bl-release">Auto-release date (optional)</Label>
              <Input id="bl-release" type="date" value={releaseAt} onChange={(e) => setReleaseAt(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Left blank, this stays blocked until you release it manually.
              </p>
            </div>
          </form>
        </div>

        <SheetFooter>
          <Button type="submit" form="block-stalls-form" disabled={submitting}>
            {submitting ? "Blocking…" : "Block stalls"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function axiosMessage(err: unknown): string {
  if (err && typeof err === "object" && "response" in err) {
    const response = (err as { response?: { data?: { error?: unknown } } }).response;
    const e = response?.data?.error;
    if (typeof e === "string") return e;
    if (e) return JSON.stringify(e);
  }
  return "Something went wrong";
}
