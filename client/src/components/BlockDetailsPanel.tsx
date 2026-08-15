import { useState } from "react";
import { api, type Hold } from "../lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ORG_LABEL } from "../lib/status";
import { ActivityTimeline } from "./ActivityTimeline";

interface Props {
  hold: Hold;
  onClose: () => void;
  onReleased: () => void;
  onApproved: () => void;
  onConfirmBooking: (hold: Hold) => void;
}

export function BlockDetailsPanel({ hold, onClose, onReleased, onApproved, onConfirmBooking }: Props) {
  const [busy, setBusy] = useState(false);
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
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                Submitted via public booking link — awaiting your review
              </Badge>
              {hold.reference && <span className="font-mono text-xs text-muted-foreground">{hold.reference}</span>}
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
            </div>
            {hold.company && <div className="text-muted-foreground">{hold.company}</div>}
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
    </Sheet>
  );
}
