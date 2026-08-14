import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { api, type BookedByOrg, type Booking, type PaymentStatus } from "../lib/api";
import { formatCurrency } from "../lib/format";
import { ORG_LABEL, ORG_LABEL_SHORT, PAYMENT_STATUS_LABEL, PAYMENT_STATUS_STYLES } from "../lib/status";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface Props {
  eventId: string;
  onSelect: (booking: Booking) => void;
  refreshKey: number;
}

type OrgFilter = BookedByOrg | "ALL";
type StatusFilter = PaymentStatus | "ALL";

const ORG_FILTERS: { value: OrgFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "MEC", label: ORG_LABEL.MEC },
  { value: "CHAMBER_OF_COMMERCE", label: ORG_LABEL.CHAMBER_OF_COMMERCE },
];

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "UNPAID", label: PAYMENT_STATUS_LABEL.UNPAID },
  { value: "PARTIAL", label: PAYMENT_STATUS_LABEL.PARTIAL },
  { value: "PAID", label: PAYMENT_STATUS_LABEL.PAID },
];

export function BookingsPanel({ eventId, onSelect, refreshKey }: Props) {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [q, setQ] = useState("");
  const [orgFilter, setOrgFilter] = useState<OrgFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  useEffect(() => {
    setBookings(null);
    const params = {
      ...(q ? { q } : {}),
      ...(orgFilter !== "ALL" ? { bookedByOrg: orgFilter } : {}),
      ...(statusFilter !== "ALL" ? { paymentStatus: statusFilter } : {}),
    };
    api.get<Booking[]>(`/events/${eventId}/bookings`, { params }).then((r) => setBookings(r.data));
  }, [eventId, q, orgFilter, statusFilter, refreshKey]);

  return (
    <div>
      <div className="relative mb-3 max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by exhibitor, company or phone…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-8"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <FilterPillGroup label="Booked by" options={ORG_FILTERS} value={orgFilter} onChange={setOrgFilter} />
        <FilterPillGroup label="Status" options={STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} />
      </div>

      {bookings === null && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      )}

      {bookings && bookings.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No bookings match these filters.
          </CardContent>
        </Card>
      )}

      {bookings && bookings.length > 0 && (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Exhibitor</TableHead>
                  <TableHead>Stalls</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((b) => (
                  <TableRow key={b.id} onClick={() => onSelect(b)} className="cursor-pointer">
                    <TableCell>
                      <div className="font-medium text-foreground">{b.exhibitorName}</div>
                      <div className="text-xs text-muted-foreground">{b.phone}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {b.stalls.map((s) => s.stall.code).join(", ")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{ORG_LABEL_SHORT[b.bookedByOrg]}</TableCell>
                    <TableCell className="text-right">{formatCurrency(b.totalAmount)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(b.amountPaid)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={PAYMENT_STATUS_STYLES[b.paymentStatus]}>
                        {PAYMENT_STATUS_LABEL[b.paymentStatus]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {bookings.map((b) => (
              <Card key={b.id} onClick={() => onSelect(b)} className="cursor-pointer">
                <CardContent className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-foreground">{b.exhibitorName}</div>
                      <div className="text-xs text-muted-foreground">{b.phone}</div>
                    </div>
                    <Badge variant="outline" className={PAYMENT_STATUS_STYLES[b.paymentStatus]}>
                      {PAYMENT_STATUS_LABEL[b.paymentStatus]}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {b.stalls.map((s) => s.stall.code).join(", ")} · {ORG_LABEL_SHORT[b.bookedByOrg]}
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total {formatCurrency(b.totalAmount)}</span>
                    <span className="font-medium text-foreground">Paid {formatCurrency(b.amountPaid)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function FilterPillGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}:</span>
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => (
          <Button
            key={opt.value}
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onChange(opt.value)}
            className={cn(
              "h-6 rounded-full border px-2.5 text-xs",
              value === opt.value
                ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
