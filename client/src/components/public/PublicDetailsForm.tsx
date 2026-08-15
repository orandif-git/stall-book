import { useState, type FormEvent } from "react";
import type { PublicFloorPlanStall } from "../../lib/api";
import { publicApi } from "../../lib/api";
import { formatCurrency } from "../../lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

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
  holdId: string;
  phone: string;
  token: string;
  selectedStalls: PublicFloorPlanStall[];
  onSubmitted: (result: { requestId: string; reference: string; stallCodes: string[]; total: number }) => void;
  onExpired: () => void;
}

// Step 3 of the public journey — collects the same information the admin's own booking form
// does, minus GST (not asked of customers) and payment (customers never pay here — an admin
// collects payment when approving). PATCHes the reservation Hold created in step 2, which is
// what actually turns it from a 15-minute soft reservation into a durable request in the
// admin's queue (see PublicVerifyStep + server/src/routes/public.ts).
export function PublicDetailsForm({ holdId, phone, token, selectedStalls, onSubmitted, onExpired }: Props) {
  const [exhibitorName, setExhibitorName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [productService, setProductService] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const total = selectedStalls.reduce((sum, s) => sum + s.price, 0);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { data } = await publicApi.patch<{ ok: true; requestId: string; reference: string; stallCodes: string[]; total: number }>(
        `/holds/${holdId}`,
        { phone, token, exhibitorName, company: company || undefined, email: email || undefined, address, city, productService, notes: notes || undefined },
      );
      onSubmitted(data);
    } catch (err) {
      if (err && typeof err === "object" && "response" in err) {
        const status = (err as { response?: { status?: number } }).response?.status;
        if (status === 410) {
          onExpired();
          return;
        }
      }
      setError(axiosMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <div className="mb-1.5 text-xs font-medium text-muted-foreground">Your stalls</div>
        <div className="flex flex-wrap gap-1.5">
          {selectedStalls.map((s) => (
            <Badge key={s.id} variant="secondary">
              {s.code}
            </Badge>
          ))}
        </div>
        <div className="mt-2 text-lg font-semibold text-foreground">{formatCurrency(total)}</div>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="pd-name">Exhibitor name</Label>
        <Input id="pd-name" value={exhibitorName} onChange={(e) => setExhibitorName(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pd-company">Company</Label>
        <Input id="pd-company" value={company} onChange={(e) => setCompany(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pd-phone">Phone</Label>
        <Input id="pd-phone" value={`+91 ${phone}`} disabled />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pd-email">Email</Label>
        <Input id="pd-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pd-address">Address</Label>
        <Input id="pd-address" value={address} onChange={(e) => setAddress(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pd-city">City</Label>
        <Input id="pd-city" value={city} onChange={(e) => setCity(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pd-product">Product / Service you're exhibiting</Label>
        <Input
          id="pd-product"
          placeholder="e.g. Handloom sarees, solar water heaters"
          value={productService}
          onChange={(e) => setProductService(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pd-notes">Notes (optional)</Label>
        <Textarea id="pd-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>

      <Button type="submit" disabled={submitting} className="w-full">
        Submit request
      </Button>
    </form>
  );
}
