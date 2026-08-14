import { useEffect, useState } from "react";
import { Building, CircleCheck, Download, IndianRupee, Wallet } from "lucide-react";
import { api, type ReportSummary } from "../lib/api";
import { formatCurrency } from "../lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function ReportsPanel({ eventId }: { eventId: string }) {
  const [summary, setSummary] = useState<ReportSummary | null>(null);

  useEffect(() => {
    api.get<ReportSummary>(`/events/${eventId}/reports/summary`).then((r) => setSummary(r.data));
  }, [eventId]);

  async function downloadCsv() {
    const token = localStorage.getItem("token");
    const res = await fetch(`/api/events/${eventId}/reports/exhibitors.csv`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? "exhibitors.csv";
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!summary) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={Building}
          label="Stalls booked"
          value={`${summary.stalls.booked} / ${summary.stalls.total}`}
        />
        <StatCard icon={CircleCheck} label="Stalls available" value={String(summary.stalls.available)} />
        <StatCard icon={IndianRupee} label="Collected" value={formatCurrency(summary.revenue.collected)} tone="success" />
        <StatCard icon={Wallet} label="Pending" value={formatCurrency(summary.revenue.pending)} tone="warning" />
      </div>

      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">By category</h3>
        <Button onClick={downloadCsv} size="sm" variant="outline">
          <Download />
          Export exhibitor list (CSV)
        </Button>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Booked</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead className="text-right">Revenue booked</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.byCategory.map((c) => (
              <TableRow key={c.categoryId}>
                <TableCell className="font-medium text-foreground">{c.code}</TableCell>
                <TableCell className="text-right">{c.total}</TableCell>
                <TableCell className="text-right">{c.booked}</TableCell>
                <TableCell className="text-right">{c.available}</TableCell>
                <TableCell className="text-right">{formatCurrency(c.bookedRevenue)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Building;
  label: string;
  value: string;
  tone?: "success" | "warning";
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div
            className={cn(
              "text-lg font-semibold text-foreground",
              tone === "success" && "text-success",
              tone === "warning" && "text-warning"
            )}
          >
            {value}
          </div>
        </div>
        <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-4" />
        </div>
      </CardContent>
    </Card>
  );
}
