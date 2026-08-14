import { useCallback, useEffect, useState } from "react";
import { api, type FloorPlanData, type FloorPlanStall } from "../../lib/api";

export function useFloorPlan(eventId: string, refreshKey: number) {
  const [data, setData] = useState<FloorPlanData | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<FloorPlanStall["status"] | null>(null);
  const [search, setSearch] = useState("");
  const [hitCode, setHitCode] = useState<string | null>(null);
  const [justChanged, setJustChanged] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const { data: fresh } = await api.get<FloorPlanData>(`/events/${eventId}/floorplan`);
    setData((prev) => {
      if (prev) {
        // Diff against the previous snapshot so FloorPlan can "stamp" whatever just changed.
        const changed = new Set<string>();
        const prevByCode = new Map(prev.stalls.map((s) => [s.code, s]));
        for (const s of fresh.stalls) {
          const before = prevByCode.get(s.code);
          if (before && before.status !== s.status) changed.add(s.code);
        }
        if (changed.size > 0) {
          setJustChanged(changed);
          setTimeout(() => setJustChanged(new Set()), 650);
        }
      }
      return fresh;
    });
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  // refreshKey bumps whenever a booking/block/release actually goes through (see
  // EventDetailPage's afterChange/refreshViewBooking) — clear whatever was selected so the
  // floating multi-select bar doesn't keep showing stalls that were just booked or blocked.
  useEffect(() => {
    setSelected(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  function toggleSelect(code: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  // Filters dim non-matching stalls rather than removing them — they stay in place on the
  // plan (visibleStalls is every positioned stall, unfiltered) so the layout never shifts.
  const visibleStalls = data?.stalls ?? [];
  const dimmedCodes = new Set(
    (data?.stalls ?? []).filter((s) => statusFilter && s.status !== statusFilter).map((s) => s.code)
  );

  const stats = (() => {
    const stalls = data?.stalls ?? [];
    const total = stalls.length;
    const available = stalls.filter((s) => s.status === "AVAILABLE").length;
    const blocked = stalls.filter((s) => s.status === "BLOCKED").length;
    const booked = stalls.filter((s) => s.status.startsWith("BOOKED")).length;
    const pctSold = total > 0 ? Math.round((booked / total) * 100) : 0;
    return { total, available, blocked, booked, pctSold };
  })();

  function searchStall(query: string) {
    setSearch(query);
    const code = query.trim().toUpperCase();
    if (!code) {
      setHitCode(null);
      return null;
    }
    const found = data?.stalls.find((s) => s.code === code) ?? null;
    setHitCode(found ? code : null);
    return found;
  }

  const selectedStalls = (data?.stalls ?? []).filter((s) => selected.has(s.code));
  const selectedTotal = selectedStalls.reduce((sum, s) => sum + s.price, 0);

  return {
    data,
    reload: load,
    selected,
    selectedStalls,
    selectedTotal,
    toggleSelect,
    clearSelection,
    stats,
    statusFilter,
    setStatusFilter,
    search,
    searchStall,
    hitCode,
    visibleStalls,
    dimmedCodes,
    justChanged,
  };
}
