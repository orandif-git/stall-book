import { useState } from "react";
import { api, type Booking, type PaymentMode } from "../lib/api";
import { formatCurrency } from "../lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { ORG_LABEL, PAYMENT_MODES, PAYMENT_REFERENCE_LABEL, PAYMENT_STATUS_LABEL, PAYMENT_STATUS_STYLES } from "../lib/status";
import { ActivityTimeline } from "./ActivityTimeline";

interface Props {
  booking: Booking;
  onClose: () => void;
  onCancelled: () => void;
  onPaymentAdded: () => void;
}

export function BookingDetailPanel({ booking, onClose, onCancelled, onPaymentAdded }: Props) {
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<PaymentMode>("CASH");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pending = Number(booking.totalAmount) - Number(booking.amountPaid);

  async function addPayment() {
    setError(null);
    setBusy(true);
    try {
      await api.post(`/bookings/${booking.id}/payments`, {
        amount: Number(amount),
        mode,
        reference: mode !== "CASH" ? reference || undefined : undefined,
      });
      setAmount("");
      setReference("");
      onPaymentAdded();
    } catch {
      setError("Could not record payment");
    } finally {
      setBusy(false);
    }
  }

  async function cancelBooking() {
    setBusy(true);
    try {
      await api.delete(`/bookings/${booking.id}`);
      onCancelled();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex flex-col">
        <SheetHeader>
          <SheetTitle>Booking details</SheetTitle>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <div className="font-semibold text-foreground">{booking.exhibitorName}</div>
              <Badge variant="outline">{ORG_LABEL[booking.bookedByOrg]}</Badge>
            </div>
            {booking.company && <div className="text-sm text-muted-foreground">{booking.company}</div>}
            <div className="text-sm text-muted-foreground">{booking.phone}</div>
            {booking.email && <div className="text-sm text-muted-foreground">{booking.email}</div>}
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium text-muted-foreground">Stalls</div>
            <div className="flex flex-wrap gap-1.5">
              {booking.stalls.map(({ stall }) => (
                <Badge key={stall.id} variant="secondary">
                  {stall.code}
                </Badge>
              ))}
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="font-semibold text-foreground">{formatCurrency(booking.totalAmount)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Paid</div>
              <div className="font-semibold text-foreground">{formatCurrency(booking.amountPaid)}</div>
            </div>
            <div className="col-span-2">
              <div className="text-xs text-muted-foreground">Pending</div>
              <div className={cn("font-semibold", pending > 0 ? "text-warning" : "text-success")}>
                {formatCurrency(pending)}
              </div>
            </div>
            <div className="col-span-2">
              <Badge variant="outline" className={PAYMENT_STATUS_STYLES[booking.paymentStatus]}>
                {PAYMENT_STATUS_LABEL[booking.paymentStatus]}
              </Badge>
            </div>
          </div>

          {pending > 0 && (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <div className="text-xs font-medium text-muted-foreground">Record a payment</div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="flex-1"
                />
                <Select value={mode} onValueChange={(v) => setMode(v as PaymentMode)}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_MODES.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {mode !== "CASH" && (
                <Input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder={PAYMENT_REFERENCE_LABEL[mode]}
                />
              )}
              <Button onClick={addPayment} disabled={busy || !amount} className="w-full" size="sm">
                Add payment
              </Button>
            </div>
          )}

          <Separator />

          <ActivityTimeline entries={booking.activity} />

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full" disabled={busy}>
                Cancel booking & release stalls
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
                <AlertDialogDescription>
                  This releases {booking.stalls.map(({ stall }) => stall.code).join(", ")} back to available. This
                  can't be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep booking</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={cancelBooking}>
                  Cancel booking
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </SheetContent>
    </Sheet>
  );
}
