import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { LayoutGrid, List, Minus, Plus, Search } from "lucide-react";
import type { PublicFloorPlanData, PublicFloorPlanStall } from "../../lib/api";
import { formatCurrency } from "../../lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DecorLayer } from "../floorplan/DecorLayer";
import { PublicStallShape } from "./PublicStallShape";
import { PublicStallTooltip } from "./PublicStallTooltip";
import { INK, PHOTO_HEIGHT, PHOTO_MATRIX, PHOTO_WIDTH } from "../floorplan/planTokens";

interface Props {
  data: PublicFloorPlanData;
  selected: Set<string>;
  onToggle: (stall: PublicFloorPlanStall) => void;
}

// Mobile-first stall picker for the public booking portal. Two views: a simple grouped list
// (the reliable default on a phone — no pan/zoom gestures required, just tap a category then
// tap a stall) and the real floor map (drag-to-pan, +/- to zoom, tap-to-select) for anyone who
// wants to see the actual layout. Deliberately not the admin FloorPlan.tsx: no block mode, no
// payment-status filters/legend, no admin detail-panel callbacks — just pick-or-don't.
export function PublicStallPicker({ data, selected, onToggle }: Props) {
  const [view, setView] = useState<"list" | "map">("map");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 p-1">
        <button
          type="button"
          onClick={() => setView("map")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition ${
            view === "map" ? "bg-background shadow-sm" : "text-muted-foreground"
          }`}
        >
          <LayoutGrid className="size-4" /> Floor map
        </button>
        <button
          type="button"
          onClick={() => setView("list")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition ${
            view === "list" ? "bg-background shadow-sm" : "text-muted-foreground"
          }`}
        >
          <List className="size-4" /> Available List
        </button>
      </div>

      {view === "list" ? (
        <StallList data={data} selected={selected} onToggle={onToggle} />
      ) : (
        <StallMap data={data} selected={selected} onToggle={onToggle} />
      )}
    </div>
  );
}

function StallList({ data, selected, onToggle }: Props) {
  const [search, setSearch] = useState("");
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  // Available List only ever shows AVAILABLE stalls — booked/blocked ones are dropped
  // entirely (not just greyed out), and a category with nothing left available is hidden
  // rather than shown as an empty, un-tappable header.
  const groups = useMemo(() => {
    const byCategory = new Map<string, { label: string; price: number; colorHex: string | null; stalls: PublicFloorPlanStall[] }>();
    for (const s of data.stalls) {
      if (s.status !== "AVAILABLE") continue;
      const g = byCategory.get(s.categoryLabel) ?? { label: s.categoryLabel, price: s.price, colorHex: s.colorHex, stalls: [] };
      g.stalls.push(s);
      byCategory.set(s.categoryLabel, g);
    }
    return Array.from(byCategory.values())
      .filter((g) => g.stalls.length > 0)
      .sort((a, b) => b.price - a.price);
  }, [data.stalls]);

  const query = search.trim().toUpperCase();
  const filteredGroups = query
    ? groups
        .map((g) => ({ ...g, stalls: g.stalls.filter((s) => s.code.includes(query)) }))
        .filter((g) => g.stalls.length > 0)
    : groups;

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Find a stall, e.g. B12" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
      </div>

      <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
        {filteredGroups.map((g) => {
          const isOpen = openCategory === g.label || query.length > 0;
          return (
            <div key={g.label}>
              <button
                type="button"
                onClick={() => setOpenCategory((prev) => (prev === g.label ? null : g.label))}
                className="flex w-full items-center gap-3 px-3 py-3 text-left"
              >
                <span className="size-4 shrink-0 rounded-sm border border-black/10" style={{ background: g.colorHex ?? "#ccc" }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{g.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatCurrency(g.price)} · {g.stalls.length} available
                  </span>
                </span>
              </button>
              {isOpen && (
                <div className="flex flex-wrap gap-2 px-3 pb-3">
                  {g.stalls.map((s) => {
                    const isSelected = selected.has(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => onToggle(s)}
                        className={`min-w-11 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition ${
                          isSelected
                            ? "border-transparent bg-primary text-primary-foreground"
                            : "border-border bg-background text-foreground active:bg-muted"
                        }`}
                      >
                        {s.code}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {filteredGroups.length === 0 && (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            {search ? `No available stalls match "${search}"` : "No stalls available right now."}
          </div>
        )}
      </div>
    </div>
  );
}

function StallMap({ data, selected, onToggle }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [fitScale, setFitScale] = useState(1);
  const [hover, setHover] = useState<{ stall: PublicFloorPlanStall; x: number; y: number } | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // True for the rest of a gesture once it involves 2 pointers (a pinch) — if one of those
  // fingers happens to land on a stall button and doesn't move much, the browser still fires a
  // real click on it once lifted, which would otherwise select/deselect that stall as an
  // accidental side effect of zooming. Cleared at the start of the *next* gesture (see
  // onPointerDown), not immediately on pointer-up, since the click fires right after the
  // fingers lift and needs to still see this as true to get swallowed.
  const wasPinchRef = useRef(false);

  // Mouse hover keeps re-triggering this on every mousemove (naturally keeping the tooltip
  // alive) and mouseleave clears it immediately, so the timer is a no-op there. Touch has
  // neither — pointerdown fires this once with no corresponding "leave" — so the timer is what
  // actually dismisses it there, standing in for the hover-end signal touch can't produce.
  function showHover(stall: PublicFloorPlanStall | null, pos?: { x: number; y: number }) {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    if (!stall || !pos) {
      setHover(null);
      return;
    }
    setHover({ stall, x: pos.x, y: pos.y });
    hoverTimerRef.current = setTimeout(() => setHover(null), 2500);
  }

  useEffect(() => () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
  }, []);
  const dragRef = useRef<{ startX: number; startY: number; scrollX: number; scrollY: number } | null>(null);
  // Multi-touch pinch state — see onPointerDown/Move below. Keyed by pointerId so we can tell
  // a single-finger drag from a two-finger pinch regardless of the order fingers land in.
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{
    startDist: number;
    startZoom: number;
    startScrollX: number;
    startScrollY: number;
    startMidX: number;
    startMidY: number;
  } | null>(null);
  const pendingScrollRef = useRef<{ x: number; y: number } | null>(null);
  const ZOOM_MIN = 0.5;
  // Stalls are small relative to the whole floor plan, so mobile users pinching in to
  // precisely tap one need real headroom beyond a modest 3x — 8x gets individual small
  // stalls comfortably tap-sized even when starting from a fit-to-width view.
  const ZOOM_MAX = 8;

  const fitToWidth = () => {
    const el = viewportRef.current;
    if (!el) return;
    const scale = Math.max(0.3, Math.min(2, (el.clientWidth - 8) / data.canvasWidth));
    setFitScale(scale);
    setZoom(1);
    el.scrollTo(0, 0);
  };

  useEffect(() => {
    fitToWidth();
    const onResize = () => fitToWidth();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.canvasWidth]);

  const scale = fitScale * zoom;
  const canvasPxWidth = data.canvasWidth * scale;
  const canvasPxHeight = data.canvasHeight * scale;

  // Applies the scroll position computed mid-pinch, but only once the DOM has actually resized
  // for the new zoom (canvasPxWidth/Height, hence scrollWidth/Height, depend on it) — setting
  // scrollLeft/Top synchronously inside the pointer handler would get clamped against the
  // *old* (pre-render) content size instead.
  useLayoutEffect(() => {
    const pending = pendingScrollRef.current;
    const el = viewportRef.current;
    if (!pending || !el) return;
    el.scrollLeft = pending.x;
    el.scrollTop = pending.y;
    pendingScrollRef.current = null;
  }, [zoom]);

  function pinchMidpoint(el: HTMLElement) {
    const [p1, p2] = [...activePointers.current.values()];
    const rect = el.getBoundingClientRect();
    return {
      dist: Math.hypot(p2.x - p1.x, p2.y - p1.y),
      midX: (p1.x + p2.x) / 2 - rect.left,
      midY: (p1.y + p2.y) / 2 - rect.top,
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    const el = viewportRef.current;
    if (!el) return;
    // Register every pointer regardless of what it landed on — a second finger coming down
    // on top of a stall button still means "start pinching," not "tap that stall." Only a
    // *single* pointer starting on a button is left alone, so tap-to-select keeps working.
    const isButton = !!(e.target as HTMLElement).closest("button");
    if (activePointers.current.size === 0) wasPinchRef.current = false;
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.current.size === 2) {
      wasPinchRef.current = true;
      // Capture is best-effort (keeps tracking smooth if a finger slides past the viewport's
      // edge) — a rejected capture must not abort the gesture entirely.
      for (const id of activePointers.current.keys()) {
        try {
          el.setPointerCapture(id);
        } catch {
          // ignore
        }
      }
      dragRef.current = null;
      const { dist, midX, midY } = pinchMidpoint(el);
      pinchRef.current = { startDist: dist, startZoom: zoom, startScrollX: el.scrollLeft, startScrollY: el.scrollTop, startMidX: midX, startMidY: midY };
      return;
    }

    if (isButton) return;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    dragRef.current = { startX: e.clientX, startY: e.clientY, scrollX: el.scrollLeft, scrollY: el.scrollTop };
  }

  function onPointerMove(e: React.PointerEvent) {
    const el = viewportRef.current;
    if (!el || !activePointers.current.has(e.pointerId)) return;
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const pinch = pinchRef.current;
    if (pinch && activePointers.current.size === 2) {
      const { dist, midX, midY } = pinchMidpoint(el);
      const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, pinch.startZoom * (dist / pinch.startDist)));
      const zoomRatio = newZoom / pinch.startZoom;
      // Keep the point under the fingers visually fixed: that point's position in *unscaled*
      // scroll-space is contentX = startScrollX + startMidX; after re-scaling by zoomRatio it
      // moves to contentX * zoomRatio, so the new scroll offset must pull it back under the
      // (possibly also panned) current midpoint.
      const contentX = pinch.startScrollX + pinch.startMidX;
      const contentY = pinch.startScrollY + pinch.startMidY;
      pendingScrollRef.current = { x: contentX * zoomRatio - midX, y: contentY * zoomRatio - midY };
      setZoom(newZoom);
      return;
    }

    const drag = dragRef.current;
    if (drag && activePointers.current.size === 1) {
      el.scrollLeft = drag.scrollX - (e.clientX - drag.startX);
      el.scrollTop = drag.scrollY - (e.clientY - drag.startY);
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    activePointers.current.delete(e.pointerId);
    if (activePointers.current.size < 2) pinchRef.current = null;
    if (activePointers.current.size === 0) dragRef.current = null;
  }

  return (
    <div className="flex flex-col gap-2">
      {/* The floor plan is naturally wide (landscape) — on a phone held upright this squeezes
          it down a lot. Turning the phone sideways is the real fix (the map gets more height
          via the landscape: variant below); this is just a nudge toward that, not a substitute
          for it. Matches viewport aspect ratio, so it won't show on typical desktop windows. */}
      <p className="hidden portrait:max-md:block text-center text-[11px] text-muted-foreground">
        Tip: turn your phone sideways for a bigger view of the floor plan
      </p>
      <div className="flex items-center justify-end gap-1">
        <Button size="icon-sm" variant="outline" onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - 0.2))} title="Zoom out">
          <Minus />
        </Button>
        <span className="w-10 text-center text-[11px] font-semibold" style={{ color: INK.ink3 }}>
          {Math.round(zoom * 100)}%
        </span>
        <Button size="icon-sm" variant="outline" onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + 0.2))} title="Zoom in">
          <Plus />
        </Button>
        <Button size="sm" variant="outline" onClick={fitToWidth}>
          Fit
        </Button>
      </div>
      <div
        ref={viewportRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={(e) => {
          // Swallow the click before it ever reaches a stall button's own onClick — see
          // wasPinchRef's comment above for why this needs to happen here, in the capture
          // phase, rather than relying on the button to know it was mid-pinch itself.
          if (wasPinchRef.current) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        className="relative h-[55vh] overflow-auto rounded-lg border landscape:h-[80vh] md:h-[75vh]"
        style={{ borderColor: INK.line2, background: INK.plan, touchAction: "none" }}
      >
        <div style={{ position: "relative", width: canvasPxWidth, height: canvasPxHeight }}>
          <div style={{ position: "absolute", top: 0, left: 0, width: data.canvasWidth, height: data.canvasHeight, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
            {/* Real layout photo, always on here (unlike the admin view's toggle) — gives
                customers the actual drawing as visual context for orientation/scale, using the
                same calibration the admin overlay uses. */}
            {data.layoutImageUrl && (
              <img
                src={data.layoutImageUrl}
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute opacity-40"
                style={{
                  left: 0,
                  top: 0,
                  width: PHOTO_WIDTH,
                  height: PHOTO_HEIGHT,
                  maxWidth: "none",
                  transformOrigin: "0 0",
                  transform: `matrix(${PHOTO_MATRIX.join(",")})`,
                }}
              />
            )}
            <DecorLayer decor={data.decor} canvasWidth={data.canvasWidth} canvasHeight={data.canvasHeight} />
            {data.stalls.map((s) => (
              <PublicStallShape
                key={s.id}
                stall={s}
                selected={selected.has(s.id)}
                onToggle={onToggle}
                onHover={showHover}
              />
            ))}
          </div>
        </div>
      </div>
      <PublicStallTooltip stall={hover?.stall ?? null} x={hover?.x ?? 0} y={hover?.y ?? 0} />
      <p className="text-center text-[11px] text-muted-foreground">Drag to pan · pinch or use +/- to zoom</p>
    </div>
  );
}
