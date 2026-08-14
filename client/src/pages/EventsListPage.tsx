import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, MapPin, Plus } from "lucide-react";
import { api, type Event } from "../lib/api";
import { Topbar } from "../components/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

export function EventsListPage() {
  const [events, setEvents] = useState<Event[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [venue, setVenue] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  async function load() {
    const { data } = await api.get<Event[]>("/events");
    setEvents(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    await api.post("/events", { name, venue, startDate, endDate });
    setName("");
    setVenue("");
    setStartDate("");
    setEndDate("");
    setShowForm(false);
    load();
  }

  function formatRange(a: string, b: string) {
    const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
    return `${new Date(a).toLocaleDateString(undefined, opts)} – ${new Date(b).toLocaleDateString(undefined, opts)}`;
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <Topbar />
      <main className="mx-auto max-w-5xl p-4 sm:p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Events</h1>
            <p className="text-sm text-muted-foreground">Manage stall bookings across your trade fairs.</p>
          </div>
          <Button onClick={() => setShowForm(true)}>
            <Plus />
            New event
          </Button>
        </div>

        {events === null && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        )}

        {events && events.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <CalendarDays className="size-8 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">No events yet</p>
              <p className="text-sm text-muted-foreground">Create your first event to start managing stalls.</p>
            </CardContent>
          </Card>
        )}

        {events && events.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((ev) => (
              <Link key={ev.id} to={`/events/${ev.id}`}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardHeader>
                    <CardTitle>{ev.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="size-3.5 shrink-0" />
                      <span className="truncate">{ev.venue}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CalendarDays className="size-3.5 shrink-0" />
                      <span>{formatRange(ev.startDate, ev.endDate)}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>

      <Sheet open={showForm} onOpenChange={setShowForm}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>New event</SheetTitle>
            <SheetDescription>Set up a new trade fair to start defining categories and stalls.</SheetDescription>
          </SheetHeader>
          <form id="new-event-form" onSubmit={onCreate} className="space-y-4 px-4">
            <div className="space-y-1.5">
              <Label htmlFor="ev-name">Event name</Label>
              <Input id="ev-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-venue">Venue</Label>
              <Input id="ev-venue" value={venue} onChange={(e) => setVenue(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ev-start">Start date</Label>
                <Input
                  id="ev-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ev-end">End date</Label>
                <Input id="ev-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
              </div>
            </div>
          </form>
          <SheetFooter>
            <Button type="submit" form="new-event-form">
              Create event
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
