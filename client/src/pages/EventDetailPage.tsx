import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Image, LayoutGrid, Map, ShieldAlert } from "lucide-react";
import {
  api,
  type BookedByOrg,
  type Booking,
  type Category,
  type Event,
  type FloorPlanStall,
  type Hold,
  type Stall,
} from "../lib/api";
import { FloorMap } from "../components/FloorMap";
import { FloorPlan } from "../components/floorplan/FloorPlan";
import { NewBookingPanel } from "../components/NewBookingPanel";
import { BookingDetailPanel } from "../components/BookingDetailPanel";
import { BlockStallsPanel } from "../components/BlockStallsPanel";
import { BlockDetailsPanel } from "../components/BlockDetailsPanel";
import { LayoutPhotoDialog } from "../components/LayoutPhotoDialog";
import { BookingsPanel } from "../components/BookingsPanel";
import { ReportsPanel } from "../components/ReportsPanel";
import { SetupPanel } from "../components/SetupPanel";
import { Topbar } from "../components/Topbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Tab = "map" | "bookings" | "reports" | "setup";
type MapViewMode = "grid" | "layout";

const LEGEND: { swatch: string; label: string }[] = [
  { swatch: "bg-card border border-border", label: "Available" },
  { swatch: "bg-primary", label: "Selected" },
  { swatch: "bg-destructive/10 border border-destructive/30", label: "Booked" },
  { swatch: "bg-muted border border-border", label: "Blocked" },
];

export function EventDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stalls, setStalls] = useState<Stall[]>([]);
  const [tab, setTab] = useState<Tab>("map");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewBooking, setViewBooking] = useState<Booking | null>(null);
  const [viewBlocked, setViewBlocked] = useState<Hold | null>(null);
  const [bookingPrefill, setBookingPrefill] = useState<{
    exhibitorName?: string;
    phone?: string;
    bookedByOrg?: BookedByOrg;
    holdId?: string;
  }>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [blockMode, setBlockMode] = useState(false);
  const [viewMode, setViewMode] = useState<MapViewMode>("layout");

  const load = useCallback(async () => {
    if (!slug) return;
    const ev = await api.get<Event>(`/events/${slug}`);
    const eventId = ev.data.id;
    const [cats, sts] = await Promise.all([
      api.get<Category[]>(`/events/${eventId}/categories`),
      api.get<Stall[]>(`/events/${eventId}/stalls`),
    ]);
    setEvent(ev.data);
    setCategories(cats.data);
    setStalls(sts.data);
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleSelect(stall: Stall) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(stall.id)) next.delete(stall.id);
      else next.add(stall.id);
      return next;
    });
  }

  async function viewBookedStall(stall: Stall) {
    const bookingId = stall.bookingLinks?.[0]?.booking.id;
    if (!bookingId) return;
    const { data } = await api.get<Booking>(`/bookings/${bookingId}`);
    setViewBooking(data);
  }

  // Refresh in place — a recorded payment shouldn't close the drawer out from under
  // the admin, since the whole point is seeing the new activity entry land right there.
  async function refreshViewBooking(bookingId: string) {
    const { data } = await api.get<Booking>(`/bookings/${bookingId}`);
    setViewBooking(data);
    setRefreshKey((k) => k + 1);
    load();
  }

  async function viewBlockedStall(stall: Stall) {
    const holdId = stall.holdLinks?.[0]?.hold.id;
    if (!holdId) return;
    const { data } = await api.get<Hold>(`/holds/${holdId}`);
    setViewBlocked(data);
  }

  async function releaseBlock(stall: Stall) {
    const holdId = stall.holdLinks?.[0]?.hold.id;
    if (!holdId) return;
    await api.delete(`/holds/${holdId}`);
    load();
  }

  // The Layout view fetches its own richer stall data (geometry + computed payment-aware
  // status) from a separate endpoint, so its click handlers hand back FloorPlanStall — bridge
  // to the real Stall objects already loaded here (by code, which is unique per event) to
  // reuse the exact same booking/block panels and handlers as the Grid view.
  function findStallByCode(code: string): Stall | undefined {
    return stalls.find((s) => s.code === code);
  }

  function bookFloorStalls(floorStalls: FloorPlanStall[]) {
    const real = floorStalls.map((f) => findStallByCode(f.code)).filter((s): s is Stall => !!s);
    setSelected(new Set(real.map((s) => s.id)));
  }

  function blockFloorStalls(floorStalls: FloorPlanStall[]) {
    const real = floorStalls.map((f) => findStallByCode(f.code)).filter((s): s is Stall => !!s);
    setSelected(new Set(real.map((s) => s.id)));
  }

  function viewFloorBooked(floorStall: FloorPlanStall) {
    const real = findStallByCode(floorStall.code);
    if (real) viewBookedStall(real);
  }

  function viewFloorBlocked(floorStall: FloorPlanStall) {
    const real = findStallByCode(floorStall.code);
    if (real) viewBlockedStall(real);
  }

  function releaseFloorBlock(floorStall: FloorPlanStall) {
    const real = findStallByCode(floorStall.code);
    if (real) releaseBlock(real);
  }

  function closeNewBooking() {
    setSelected(new Set());
    setBookingPrefill({});
  }

  // The block is only released once the booking is actually submitted (atomically, server-side
  // via holdId) — not here. Backing out of the form below must leave the block untouched.
  function confirmHoldAsBooking(hold: Hold) {
    setSelected(new Set(hold.stalls.map((s) => s.stall.id)));
    setBookingPrefill({
      exhibitorName: hold.exhibitorName ?? "",
      phone: hold.phone ?? "",
      bookedByOrg: hold.bookedByOrg,
      holdId: hold.id,
    });
    setViewBlocked(null);
  }

  function afterChange() {
    setSelected(new Set());
    setBookingPrefill({});
    setViewBooking(null);
    setViewBlocked(null);
    setRefreshKey((k) => k + 1);
    load();
  }

  function afterBlock() {
    afterChange();
    setBlockMode(false);
  }

  if (!event || !slug) {
    return (
      <div className="min-h-screen bg-muted/30">
        <Topbar />
        <main className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </main>
      </div>
    );
  }

  const eventId = event.id;
  const selectedStalls = stalls.filter((s) => selected.has(s.id));

  return (
    <div className="min-h-screen bg-muted/30">
      <Topbar crumb={event.name} />
      <main className="mx-auto max-w-6xl p-4 sm:p-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="mb-4 h-auto gap-2 bg-transparent p-0">
            <TabsTrigger
              value="map"
              className="rounded-full border border-border bg-card px-4 py-1.5 text-muted-foreground shadow-none data-active:border-primary data-active:bg-primary data-active:text-primary-foreground data-active:shadow-none dark:data-active:bg-primary dark:data-active:text-primary-foreground"
            >
              Floor Map
            </TabsTrigger>
            <TabsTrigger
              value="bookings"
              className="rounded-full border border-border bg-card px-4 py-1.5 text-muted-foreground shadow-none data-active:border-primary data-active:bg-primary data-active:text-primary-foreground data-active:shadow-none dark:data-active:bg-primary dark:data-active:text-primary-foreground"
            >
              Bookings
            </TabsTrigger>
            <TabsTrigger
              value="reports"
              className="rounded-full border border-border bg-card px-4 py-1.5 text-muted-foreground shadow-none data-active:border-primary data-active:bg-primary data-active:text-primary-foreground data-active:shadow-none dark:data-active:bg-primary dark:data-active:text-primary-foreground"
            >
              Reports
            </TabsTrigger>
            <TabsTrigger
              value="setup"
              className="rounded-full border border-border bg-card px-4 py-1.5 text-muted-foreground shadow-none data-active:border-primary data-active:bg-primary data-active:text-primary-foreground data-active:shadow-none dark:data-active:bg-primary dark:data-active:text-primary-foreground"
            >
              Setup
            </TabsTrigger>
          </TabsList>

          <TabsContent value="map">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                {viewMode === "grid" &&
                  LEGEND.map((l) => (
                    <div key={l.label} className="flex items-center gap-1.5">
                      <span className={`size-3 rounded ${l.swatch}`} />
                      {l.label}
                    </div>
                  ))}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border border-border bg-card p-0.5">
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition",
                      viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <LayoutGrid className="size-3.5" />
                    Grid
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("layout")}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition",
                      viewMode === "layout" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Map className="size-3.5" />
                    Layout
                  </button>
                </div>
                <LayoutPhotoDialog
                  imageUrl={event.layoutImageUrl}
                  trigger={
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!event.layoutImageUrl}
                      title={event.layoutImageUrl ? "View the uploaded layout photo" : "No layout image uploaded yet — add one from Setup"}
                    >
                      <Image />
                      View layout photo
                    </Button>
                  }
                />
                <Button
                  size="sm"
                  variant={blockMode ? "default" : "outline"}
                  onClick={() => {
                    setSelected(new Set());
                    setBlockMode((v) => !v);
                  }}
                >
                  <ShieldAlert />
                  {blockMode ? "Done blocking" : "Block / unblock stalls"}
                </Button>
              </div>
            </div>

            {blockMode && (
              <p className="mb-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning-foreground dark:text-warning">
                Click available stalls to select them, then fill in who they're blocked for. Click a blocked stall to
                release it immediately.
              </p>
            )}

            {viewMode === "grid" ? (
              <FloorMap
                stalls={stalls}
                selected={selected}
                blockMode={blockMode}
                onToggleSelect={toggleSelect}
                onViewBooked={viewBookedStall}
                onViewBlocked={viewBlockedStall}
                onReleaseBlock={releaseBlock}
              />
            ) : (
              <FloorPlan
                key={blockMode ? "block" : "book"}
                eventId={eventId}
                refreshKey={refreshKey}
                blockMode={blockMode}
                onBookSelected={bookFloorStalls}
                onBlockSelected={blockFloorStalls}
                onViewBooked={viewFloorBooked}
                onViewBlocked={viewFloorBlocked}
                onReleaseBlock={releaseFloorBlock}
              />
            )}
          </TabsContent>

          <TabsContent value="bookings">
            <BookingsPanel
              eventId={eventId}
              onSelect={setViewBooking}
              onSelectHold={setViewBlocked}
              refreshKey={refreshKey}
            />
          </TabsContent>

          <TabsContent value="reports">
            <ReportsPanel eventId={eventId} />
          </TabsContent>

          <TabsContent value="setup">
            <SetupPanel eventId={eventId} event={event} categories={categories} onChanged={load} />
          </TabsContent>
        </Tabs>
      </main>

      {selectedStalls.length > 0 && !viewBooking && !viewBlocked && blockMode && (
        <BlockStallsPanel eventId={eventId} stalls={selectedStalls} onClose={closeNewBooking} onBlocked={afterBlock} />
      )}

      {selectedStalls.length > 0 && !viewBooking && !viewBlocked && !blockMode && (
        <NewBookingPanel
          eventId={eventId}
          stalls={selectedStalls}
          onClose={closeNewBooking}
          onBooked={afterChange}
          initialExhibitorName={bookingPrefill.exhibitorName}
          initialPhone={bookingPrefill.phone}
          initialBookedByOrg={bookingPrefill.bookedByOrg}
          holdId={bookingPrefill.holdId}
        />
      )}

      {viewBooking && (
        <BookingDetailPanel
          booking={viewBooking}
          onClose={() => setViewBooking(null)}
          onCancelled={afterChange}
          onPaymentAdded={() => refreshViewBooking(viewBooking.id)}
        />
      )}

      {viewBlocked && (
        <BlockDetailsPanel
          hold={viewBlocked}
          onClose={() => setViewBlocked(null)}
          onReleased={afterChange}
          onConfirmBooking={confirmHoldAsBooking}
        />
      )}
    </div>
  );
}
