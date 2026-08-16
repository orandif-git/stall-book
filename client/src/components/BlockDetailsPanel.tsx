import { useState, type FormEvent } from "react";
import { Pencil } from "lucide-react";
import { api, type Hold } from "../lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ORG_LABEL } from "../lib/status";
import { ActivityTimeline } from "./ActivityTimeline";

interface Props {
  hold: Hold;
  onClose: () => void;
  onReleased: () => void;
  onApproved: () => void;
  onConfirmBooking: (hold: Hold) => void;
  onUpdated: (hold: Hold) => void;
}

export function BlockDetailsPanel({ hold, onClose, onReleased, onApproved, onConfirmBooking, onUpdated }: Props) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const isRequest = hold.source === "PUBLIC_REQUEST";

  async function release() {
    setBusy(true);
    try {
      await api.delete(`/holds/${hold.id}`);
      onReleased();
    } finally {
      setBusy(false);
    }
  }

  // Approve without collecting payment yet: the stall stays blocked/reserved for this
  // customer, the request just moves from "Requests" into the regular "Blocked" list —
  // payment is collected later via "Confirm as booking" on that same hold.
  async function approveOnly() {
    setBusy(true);
    try {
      await api.patch(`/holds/${hold.id}/approve`);
      onApproved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex flex-col">
        <SheetHeader>
          <SheetTitle>{isRequest ? "Booking request" : `Blocked stall${hold.stalls.length > 1 ? "s" : ""}`}</SheetTitle>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4">
          {isRequest && (
            <div className="space-y-1.5">
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                Submitted via public booking link — awaiting your review
              </Badge>
              {hold.reference && <div className="font-mono text-xs text-muted-foreground">{hold.reference}</div>}
            </div>
          )}

          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Stalls</div>
            <div className="flex flex-wrap gap-1.5">
              {hold.stalls.map(({ stall }) => (
                <Badge key={stall.id} variant="secondary">
                  {stall.code}
                </Badge>
              ))}
            </div>
          </div>

          {hold.productService && (
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
              <div className="text-xs font-medium text-muted-foreground">Exhibiting</div>
              <div className="text-sm text-foreground">{hold.productService}</div>
            </div>
          )}

          <Separator />

          <div className="space-y-1 text-sm">
            <div className="mb-1 flex items-center gap-2">
              <div className="font-medium text-foreground">{hold.exhibitorName || "No exhibitor named"}</div>
              <Badge variant="outline">{ORG_LABEL[hold.bookedByOrg]}</Badge>
              <Button
                variant="ghost"
                size="icon-sm"
                className="ml-auto"
                title="Edit details"
                onClick={() => setEditing(true)}
              >
                <Pencil />
              </Button>
            </div>
            {hold.company ? (
              <div className="text-muted-foreground">{hold.company}</div>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-warning underline-offset-2 hover:underline"
              >
                No company on file — add one
              </button>
            )}
            {hold.phone && <div className="text-muted-foreground">{hold.phone}</div>}
            {hold.email && <div className="text-muted-foreground">{hold.email}</div>}
            {(hold.address || hold.city) && (
              <div className="text-muted-foreground">{[hold.address, hold.city].filter(Boolean).join(", ")}</div>
            )}
            {hold.notes && <div className="text-muted-foreground">{hold.notes}</div>}
          </div>

          {!isRequest && (
            <div className="text-sm">
              <div className="text-xs text-muted-foreground">Auto-release</div>
              <div className="font-medium text-foreground">
                {hold.releaseAt ? new Date(hold.releaseAt).toLocaleDateString() : "Not set — manual release only"}
              </div>
            </div>
          )}

          <div className="space-y-2 pt-2">
            {isRequest ? (
              <>
                <Button className="w-full" disabled={busy} onClick={approveOnly}>
                  Approve
                </Button>
                <Button variant="outline" className="w-full" disabled={busy} onClick={() => onConfirmBooking(hold)}>
                  Approve &amp; collect payment
                </Button>
              </>
            ) : (
              <Button className="w-full" disabled={busy} onClick={() => onConfirmBooking(hold)}>
                Confirm as booking
              </Button>
            )}
            <Button variant="outline" className="w-full" disabled={busy} onClick={release}>
              {isRequest ? "Reject request" : "Release now"}
            </Button>
          </div>

          <Separator />

          <ActivityTimeline entries={hold.activity} />
        </div>
      </SheetContent>

      {editing && (
        <EditHoldDetailsSheet
          hold={hold}
          onClose={() => setEditing(false)}
          onSaved={(updated) => {
            onUpdated(updated);
            setEditing(false);
          }}
        />
      )}
    </Sheet>
  );
}

// Same stacked-Sheet-triggered-by-pencil pattern as BookingDetailPanel's edit sheet — lets an
// admin fill in details a public request came in without (companies are required going forward,
// but older requests/blocks can still predate that) or correct a plain block's.
function EditHoldDetailsSheet({
  hold,
  onClose,
  onSaved,
}: {
  hold: Hold;
  onClose: () => void;
  onSaved: (updated: Hold) => void;
}) {
  const [exhibitorName, setExhibitorName] = useState(hold.exhibitorName ?? "");
  const [company, setCompany] = useState(hold.company ?? "");
  const [phone, setPhone] = useState(hold.phone ?? "");
  const [email, setEmail] = useState(hold.email ?? "");
  const [address, setAddress] = useState(hold.address ?? "");
  const [city, setCity] = useState(hold.city ?? "");
  const [productService, setProductService] = useState(hold.productService ?? "");
  const [notes, setNotes] = useState(hold.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { data } = await api.patch<Hold>(`/holds/${hold.id}`, {
        exhibitorName: exhibitorName || undefined,
        company,
        phone: phone || undefined,
        email: email || undefined,
        address: address || undefined,
        city: city || undefined,
        productService: productService || undefined,
        notes: notes || undefined,
      });
      onSaved(data);
    } catch (err) {
      setError(axiosMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex flex-col">
        <SheetHeader>
          <SheetTitle>Edit details</SheetTitle>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4">
          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <form id="edit-hold-form" onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="eh-name">Exhibitor name</Label>
              <Input id="eh-name" value={exhibitorName} onChange={(e) => setExhibitorName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eh-company">Company</Label>
              <Input id="eh-company" value={company} onChange={(e) => setCompany(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eh-phone">Phone</Label>
              <Input id="eh-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eh-email">Email</Label>
              <Input id="eh-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eh-address">Address</Label>
              <Input id="eh-address" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eh-city">City</Label>
              <Input id="eh-city" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eh-product">Product / Service</Label>
              <Input id="eh-product" value={productService} onChange={(e) => setProductService(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eh-notes">Notes</Label>
              <Textarea id="eh-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </form>
        </div>

        <SheetFooter>
          <Button type="submit" form="edit-hold-form" disabled={submitting}>
            {submitting ? "Saving…" : "Save changes"}
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
