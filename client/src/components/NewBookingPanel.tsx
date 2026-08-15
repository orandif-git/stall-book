import { useState, type FormEvent } from "react";
import { api, type BookedByOrg, type PaymentMode, type Stall } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { formatCurrency } from "../lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OrgToggle } from "./OrgToggle";
import { PAYMENT_MODES, PAYMENT_REFERENCE_LABEL } from "../lib/status";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface Props {
  eventId: string;
  stalls: Stall[];
  onClose: () => void;
  onBooked: () => void;
  initialExhibitorName?: string;
  initialCompany?: string;
  initialPhone?: string;
  initialEmail?: string;
  initialAddress?: string;
  initialCity?: string;
  initialProductService?: string;
  initialNotes?: string;
  initialBookedByOrg?: BookedByOrg;
  holdId?: string;
}

export function NewBookingPanel({
  eventId,
  stalls,
  onClose,
  onBooked,
  initialExhibitorName = "",
  initialCompany = "",
  initialPhone = "",
  initialEmail = "",
  initialAddress = "",
  initialCity = "",
  initialProductService = "",
  initialNotes = "",
  initialBookedByOrg = "MEC",
  holdId,
}: Props) {
  const { admin } = useAuth();
  // Admins have a fixed org on their profile — their bookings always use it, no manual choice.
  // Super Admins keep the full manual selector, unchanged.
  const isStaff = admin?.role === "STAFF";

  const [exhibitorName, setExhibitorName] = useState(initialExhibitorName);
  const [company, setCompany] = useState(initialCompany);
  const [phone, setPhone] = useState(initialPhone);
  const [email, setEmail] = useState(initialEmail);
  const [gst, setGst] = useState("");
  const [address, setAddress] = useState(initialAddress);
  const [city, setCity] = useState(initialCity);
  const [productService, setProductService] = useState(initialProductService);
  const [notes, setNotes] = useState(initialNotes);
  const [bookedByOrg, setBookedByOrg] = useState<BookedByOrg>(
    isStaff && admin ? admin.bookedByOrg : initialBookedByOrg
  );
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("CASH");
  const [paymentReference, setPaymentReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const total = stalls.reduce((sum, s) => sum + Number(s.category.price), 0);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!(Number(amountPaid) > 0)) {
      setError("Enter an amount received — bookings can't be created unpaid.");
      return;
    }
    if (Number(amountPaid) > total) {
      setError(`Amount received can't exceed the total (${formatCurrency(total)}).`);
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/events/${eventId}/bookings`, {
        stallIds: stalls.map((s) => s.id),
        holdId,
        exhibitorName,
        company: company || undefined,
        phone,
        email: email || undefined,
        gst: gst || undefined,
        address: address || undefined,
        city: city || undefined,
        productService: productService || undefined,
        notes: notes || undefined,
        bookedByOrg,
        amountPaid: Number(amountPaid),
        paymentMode,
        paymentReference: paymentMode !== "CASH" ? paymentReference || undefined : undefined,
      });
      onBooked();
    } catch (err) {
      setError(axiosMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    // Non-modal, no overlay, and outside clicks don't auto-dismiss: the floor map must stay
    // clickable behind this panel so more stalls can be added to the selection without it closing.
    <Sheet open modal={false} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        showOverlay={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="flex flex-col shadow-2xl ring-1 ring-border"
      >
        <SheetHeader>
          <SheetTitle>New booking</SheetTitle>
          <SheetDescription>Book {stalls.length === 1 ? "this stall" : `these ${stalls.length} stalls`} for an exhibitor.</SheetDescription>
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
            <div className="mt-2 text-lg font-semibold text-foreground">{formatCurrency(total)}</div>
          </div>

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <form id="new-booking-form" onSubmit={onSubmit} className="space-y-4">
            {!isStaff && <OrgToggle value={bookedByOrg} onChange={setBookedByOrg} />}
            <div className="space-y-1.5">
              <Label htmlFor="nb-name">Exhibitor name</Label>
              <Input id="nb-name" value={exhibitorName} onChange={(e) => setExhibitorName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nb-company">Company</Label>
              <Input id="nb-company" value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nb-phone">Phone</Label>
              <Input id="nb-phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nb-email">Email</Label>
              <Input id="nb-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nb-gst">GST (optional)</Label>
              <Input id="nb-gst" value={gst} onChange={(e) => setGst(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nb-address">Address</Label>
              <Input id="nb-address" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nb-city">City</Label>
              <Input id="nb-city" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nb-product">Product / Service</Label>
              <Input
                id="nb-product"
                placeholder="e.g. Handloom sarees, solar water heaters"
                value={productService}
                onChange={(e) => setProductService(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nb-notes">Notes</Label>
              <Textarea id="nb-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nb-paid">Amount received now (₹)</Label>
              <div className="flex gap-2">
                <Input
                  id="nb-paid"
                  type="number"
                  min="1"
                  max={total}
                  step="1"
                  placeholder="Required — partial or full"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  required
                  className="flex-1"
                />
                <Select value={paymentMode} onValueChange={(v) => setPaymentMode(v as PaymentMode)}>
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
            </div>
            {paymentMode !== "CASH" && (
              <div className="space-y-1.5">
                <Label htmlFor="nb-ref">{PAYMENT_REFERENCE_LABEL[paymentMode]}</Label>
                <Input
                  id="nb-ref"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder={PAYMENT_REFERENCE_LABEL[paymentMode]}
                />
              </div>
            )}
          </form>
        </div>

        <SheetFooter>
          <Button type="submit" form="new-booking-form" disabled={submitting}>
            {submitting ? "Saving…" : "Confirm booking"}
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
