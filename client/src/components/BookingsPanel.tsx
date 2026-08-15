import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { api, type BookedByOrg, type Booking, type Hold } from "../lib/api";
import { formatCurrency } from "../lib/format";
import { ORG_LABEL, ORG_LABEL_SHORT, PAYMENT_STATUS_LABEL, PAYMENT_STATUS_STYLES, STALL_STATUS_STYLES } from "../lib/status";
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
  onSelectHold: (hold: Hold) => void;
  refreshKey: number;
}

type OrgFilter = BookedByOrg | "ALL";
type StatusFilter = "PARTIAL" | "PAID" | "BLOCKED" | "REQUEST" | "ALL";
type Row = { kind: "booking"; booking: Booking } | { kind: "hold"; hold: Hold };

const ORG_FILTERS: { value: OrgFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "MEC", label: ORG_LABEL.MEC },
  { value: "CHAMBER_OF_COMMERCE", label: ORG_LABEL.CHAMBER_OF_COMMERCE },
];

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PARTIAL", label: PAYMENT_STATUS_LABEL.PARTIAL },
  { value: "PAID", label: PAYMENT_STATUS_LABEL.PAID },
  { value: "BLOCKED", label: "Blocked" },
  { value: "REQUEST", label: "Requests" },
];

function rowCreatedAt(row: Row) {
  return row.kind === "booking" ? row.booking.createdAt : row.hold.createdAt;
}

export function BookingsPanel({ eventId, onSelect, onSelectHold, refreshKey }: Props) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const [orgFilter, setOrgFilter] = useState<OrgFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  useEffect(() => {
    setRows(null);
    const commonParams = {
      ...(q ? { q } : {}),
      ...(orgFilter !== "ALL" ? { bookedByOrg: orgFilter } : {}),
    };

    const bookingsReq =
      statusFilter === "BLOCKED" || statusFilter === "REQUEST"
        ? Promise.resolve({ data: [] as Booking[] })
        : api.get<Booking[]>(`/events/${eventId}/bookings`, {
            params: { ...commonParams, ...(statusFilter !== "ALL" ? { paymentStatus: statusFilter } : {}) },
          });

    const holdsReq =
      statusFilter === "ALL" || statusFilter === "BLOCKED" || statusFilter === "REQUEST"
        ? api.get<Hold[]>(`/events/${eventId}/holds`, { params: commonParams })
        : Promise.resolve({ data: [] as Hold[] });

    Promise.all([bookingsReq, holdsReq]).then(([b, h]) => {
      // "Blocked"/"Requests" are the same underlying Hold, split here by who created it — kept
      // visually and structurally separate so a customer's pending request never reads as just
      // another admin block.
      const holds =
        statusFilter === "BLOCKED"
          ? h.data.filter((hold) => hold.source === "ADMIN")
          : statusFilter === "REQUEST"
            ? h.data.filter((hold) => hold.source === "PUBLIC_REQUEST")
            : h.data;
      const combined: Row[] = [
        ...b.data.map((booking): Row => ({ kind: "booking", booking })),
        ...holds.map((hold): Row => ({ kind: "hold", hold })),
      ];
      combined.sort((a, c) => new Date(rowCreatedAt(c)).getTime() - new Date(rowCreatedAt(a)).getTime());
      setRows(combined);
    });
  }, [eventId, q, orgFilter, statusFilter, refreshKey]);

  return (
    <div>
      <div className="relative mb-3 max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by exhibitor, company, phone or stall…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-8"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <FilterPillGroup label="Booked by" options={ORG_FILTERS} value={orgFilter} onChange={setOrgFilter} />
        <FilterPillGroup label="Status" options={STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} />
      </div>

      {rows === null && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      )}

      {rows && rows.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No bookings match these filters.
          </CardContent>
        </Card>
      )}

      {rows && rows.length > 0 && (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Exhibitor</TableHead>
                  <TableHead>Stalls</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const d = rowDisplay(row);
                  return (
                    <TableRow
                      key={`${row.kind}-${d.id}`}
                      onClick={() => (row.kind === "booking" ? onSelect(row.booking) : onSelectHold(row.hold))}
                      className="cursor-pointer"
                    >
                      <TableCell className="font-mono text-xs text-muted-foreground">{d.reference}</TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{d.name}</div>
                        <div className="text-xs text-muted-foreground">{d.phone}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{d.stallCodes}</TableCell>
                      <TableCell className="text-muted-foreground">{d.org}</TableCell>
                      <TableCell className="text-right">{d.total}</TableCell>
                      <TableCell className="text-right">{d.paid}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={d.statusClass}>
                          {d.statusLabel}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {rows.map((row) => {
              const d = rowDisplay(row);
              return (
                <Card
                  key={`${row.kind}-${d.id}`}
                  onClick={() => (row.kind === "booking" ? onSelect(row.booking) : onSelectHold(row.hold))}
                  className="cursor-pointer"
                >
                  <CardContent className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-mono text-[11px] text-muted-foreground">{d.reference}</div>
                        <div className="font-medium text-foreground">{d.name}</div>
                        <div className="text-xs text-muted-foreground">{d.phone}</div>
                      </div>
                      <Badge variant="outline" className={d.statusClass}>
                        {d.statusLabel}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {d.stallCodes} · {d.org}
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total {d.total}</span>
                      <span className="font-medium text-foreground">Paid {d.paid}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function rowDisplay(row: Row) {
  if (row.kind === "booking") {
    const b = row.booking;
    return {
      id: b.id,
      reference: b.reference ?? "—",
      name: b.exhibitorName,
      phone: b.phone,
      stallCodes: b.stalls.map((s) => s.stall.code).join(", "),
      org: ORG_LABEL_SHORT[b.bookedByOrg],
      total: formatCurrency(b.totalAmount),
      paid: formatCurrency(b.amountPaid),
      statusLabel: PAYMENT_STATUS_LABEL[b.paymentStatus],
      statusClass: PAYMENT_STATUS_STYLES[b.paymentStatus],
    };
  }
  const h = row.hold;
  const isRequest = h.source === "PUBLIC_REQUEST";
  return {
    id: h.id,
    reference: h.reference ?? "—",
    name: h.exhibitorName || (isRequest ? "Unnamed request" : "Unnamed hold"),
    phone: h.phone || "—",
    stallCodes: h.stalls.map((s) => s.stall.code).join(", "),
    org: ORG_LABEL_SHORT[h.bookedByOrg],
    total: "—",
    paid: "—",
    statusLabel: isRequest ? "Pending request" : "Blocked",
    statusClass: isRequest ? "border-primary/30 bg-primary/10 text-primary" : STALL_STATUS_STYLES.BLOCKED,
  };
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
