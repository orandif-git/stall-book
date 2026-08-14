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
  onConfirmBooking: (hold: Hold) => void;
}

export function BlockDetailsPanel({ hold, onClose, onReleased, onConfirmBooking }: Props) {
  const [busy, setBusy] = useState(false);

  async function release() {
    setBusy(true);
    try {
      await api.delete(`/holds/${hold.id}`);
      onReleased();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex flex-col">
        <SheetHeader>
          <SheetTitle>Blocked stall{hold.stalls.length > 1 ? "s" : ""}</SheetTitle>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4">
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

          <Separator />

          <div className="space-y-1 text-sm">
            <div className="mb-1 flex items-center gap-2">
              <div className="font-medium text-foreground">{hold.exhibitorName || "No exhibitor named"}</div>
              <Badge variant="outline">{ORG_LABEL[hold.bookedByOrg]}</Badge>
            </div>
            {hold.phone && <div className="text-muted-foreground">{hold.phone}</div>}
            {hold.notes && <div className="text-muted-foreground">{hold.notes}</div>}
          </div>

          <div className="text-sm">
            <div className="text-xs text-muted-foreground">Auto-release</div>
            <div className="font-medium text-foreground">
              {hold.releaseAt ? new Date(hold.releaseAt).toLocaleDateString() : "Not set — manual release only"}
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <Button className="w-full" disabled={busy} onClick={() => onConfirmBooking(hold)}>
              Confirm as booking
            </Button>
            <Button variant="outline" className="w-full" disabled={busy} onClick={release}>
              Release now
            </Button>
          </div>

          <Separator />

          <ActivityTimeline entries={hold.activity} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
