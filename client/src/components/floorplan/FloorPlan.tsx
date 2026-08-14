import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Minus, Plus, Search } from "lucide-react";
import type { FloorPlanStall } from "../../lib/api";
import { formatCurrency } from "../../lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFloorPlan } from "./useFloorPlan";
import { DecorLayer } from "./DecorLayer";
import { StallShape } from "./StallShape";
import { StallTooltip } from "./StallTooltip";
import { INK, STATUS_STYLES } from "./planTokens";

interface Props {
  eventId: string;
  refreshKey: number;
  blockMode: boolean;
  onBookSelected: (stalls: FloorPlanStall[]) => void;
  onBlockSelected: (stalls: FloorPlanStall[]) => void;
  onViewBooked: (stall: FloorPlanStall) => void;
  onViewBlocked: (stall: FloorPlanStall) => void;
  onReleaseBlock: (stall: FloorPlanStall) => void;
}

const STATUS_FILTER_OPTIONS: { value: FloorPlanStall["status"]; label: string }[] = [
  { value: "AVAILABLE", label: "Available" },
  { value: "BLOCKED", label: "Blocked" },
  { value: "BOOKED_PARTIAL", label: "Partial" },
  { value: "BOOKED_PAID", label: "Paid" },
];

// Maps the real layout photo's pixel space onto the canvas coordinate space, fit via least
// squares from 14 reference points spread across the whole image (F, E/D/S13, B, GA/DA/CA/G
// island, H column, A1, S1, S14). The canvas positions are a schematic reconstruction of the
// real drawing, not a pixel trace of it, so a couple of regions (notably the GA/DA/CA/G island)
// keep a visible ~15-25px drift on this 1500-wide canvas even at the best-fit affine — this
// overlay is a rough visual reference for the admin, not a pixel-perfect match.
const PHOTO_MATRIX = [1.00365, 0.00105, -0.00424, 1.01894, -9.567, -11.671] as const;

export function FloorPlan({
  eventId,
  refreshKey,
  blockMode,
  onBookSelected,
  onBlockSelected,
  onViewBooked,
  onViewBlocked,
  onReleaseBlock,
}: Props) {
  const fp = useFloorPlan(eventId, refreshKey);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [fitScale, setFitScale] = useState(1);
  const [hover, setHover] = useState<{ stall: FloorPlanStall; x: number; y: number } | null>(null);
  const dragRef = useRef<{ mode: "pan" | "lasso"; startX: number; startY: number; scrollX: number; scrollY: number } | null>(null);
  const [lassoRect, setLassoRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [focusedCode, setFocusedCode] = useState<string | null>(null);
  const [showPhoto, setShowPhoto] = useState(false);

  const reducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Fit-to-width: recompute whenever the viewport resizes.
  useEffect(() => {
    if (!fp.data) return;
    function recalc() {
      if (!viewportRef.current || !fp.data) return;
      setFitScale(viewportRef.current.clientWidth / fp.data.canvasWidth);
    }
    recalc();
    const ro = new ResizeObserver(recalc);
    if (viewportRef.current) ro.observe(viewportRef.current);
    return () => ro.disconnect();
  }, [fp.data]);

  const scale = fitScale * zoom;

  function clampZoom(z: number) {
    return Math.max(0.8, Math.min(4, z));
  }

  function handleStallClick(stall: FloorPlanStall) {
    if (stall.status === "AVAILABLE") {
      // Same behavior whether booking or blocking: every click on an available stall just
      // toggles it into the selection, no shift needed — "Book selected"/"Block selected" in
      // the floating bar is the one place that actually opens a form, for 1 or many stalls.
      fp.toggleSelect(stall.code);
    } else if (blockMode) {
      if (stall.status === "BLOCKED") onReleaseBlock(stall);
    } else if (stall.status === "BLOCKED") {
      onViewBlocked(stall);
    } else {
      onViewBooked(stall);
    }
  }

  function toCanvasPoint(clientX: number, clientY: number) {
    const vp = viewportRef.current;
    if (!vp) return { x: 0, y: 0 };
    const rect = vp.getBoundingClientRect();
    return {
      x: (clientX - rect.left + vp.scrollLeft) / scale,
      y: (clientY - rect.top + vp.scrollTop) / scale,
    };
  }

  function onViewportPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest("button")) return;
    const vp = viewportRef.current;
    if (!vp) return;
    const mode: "pan" | "lasso" = e.shiftKey ? "lasso" : "pan";
    dragRef.current = { mode, startX: e.clientX, startY: e.clientY, scrollX: vp.scrollLeft, scrollY: vp.scrollTop };
    if (mode === "lasso") {
      const p = toCanvasPoint(e.clientX, e.clientY);
      setLassoRect({ x: p.x, y: p.y, w: 0, h: 0 });
    } else {
      vp.classList.add("cursor-grabbing");
    }
    vp.setPointerCapture(e.pointerId);
  }

  function onViewportPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const vp = viewportRef.current;
    if (!vp) return;
    if (drag.mode === "pan") {
      vp.scrollLeft = drag.scrollX - (e.clientX - drag.startX);
      vp.scrollTop = drag.scrollY - (e.clientY - drag.startY);
    } else {
      const start = toCanvasPoint(drag.startX, drag.startY);
      const cur = toCanvasPoint(e.clientX, e.clientY);
      setLassoRect({
        x: Math.min(start.x, cur.x),
        y: Math.min(start.y, cur.y),
        w: Math.abs(cur.x - start.x),
        h: Math.abs(cur.y - start.y),
      });
    }
  }

  function onViewportPointerUp() {
    const drag = dragRef.current;
    if (drag?.mode === "lasso" && lassoRect && fp.data) {
      const hits = fp.data.stalls.filter((s) => {
        if (s.status !== "AVAILABLE" || s.posX == null || s.posY == null || s.width == null || s.height == null)
          return false;
        return (
          s.posX < lassoRect.x + lassoRect.w &&
          s.posX + s.width > lassoRect.x &&
          s.posY < lassoRect.y + lassoRect.h &&
          s.posY + s.height > lassoRect.y
        );
      });
      setSelectedBatch(hits.map((h) => h.code));
    }
    dragRef.current = null;
    setLassoRect(null);
    viewportRef.current?.classList.remove("cursor-grabbing");
  }

  function setSelectedBatch(codes: string[]) {
    for (const c of codes) fp.toggleSelect(c);
  }

  function zoomTo(z: number) {
    setZoom(clampZoom(z));
  }

  function fitToWidth() {
    setZoom(1);
    viewportRef.current?.scrollTo(0, 0);
  }

  function focusStall(code: string) {
    const s = fp.data?.stalls.find((st) => st.code === code);
    if (!s || s.posX == null || s.posY == null || !viewportRef.current) return;
    setFocusedCode(code);
    viewportRef.current.scrollTo({
      left: s.posX * scale - viewportRef.current.clientWidth / 2,
      top: s.posY * scale - viewportRef.current.clientHeight / 2,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }

  // Arrow-key navigation: move focus to the nearest positioned stall in that direction.
  function onKeyDown(e: React.KeyboardEvent) {
    if (!fp.data) return;
    if (e.key === "Escape") {
      fp.clearSelection();
      setFocusedCode(null);
      return;
    }
    const dirs: Record<string, [number, number]> = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
    };
    const dir = dirs[e.key];
    if (!dir) return;
    e.preventDefault();
    const positioned = fp.data.stalls.filter((s) => s.posX != null && s.posY != null);
    const current = positioned.find((s) => s.code === focusedCode) ?? positioned[0];
    if (!current) return;
    if (!focusedCode) {
      setFocusedCode(current.code);
      focusStall(current.code);
      return;
    }
    let best: FloorPlanStall | null = null;
    let bestScore = Infinity;
    for (const s of positioned) {
      if (s.code === current.code) continue;
      const dx = s.posX! - current.posX!;
      const dy = s.posY! - current.posY!;
      const along = dx * dir[0] + dy * dir[1];
      if (along <= 0) continue;
      const perpendicular = Math.abs(dx * dir[1] - dy * dir[0]);
      const score = along + perpendicular * 3;
      if (score < bestScore) {
        bestScore = score;
        best = s;
      }
    }
    if (best) {
      setFocusedCode(best.code);
      focusStall(best.code);
    }
  }

  function onEnter(e: React.KeyboardEvent) {
    if (e.key !== "Enter" || !focusedCode || !fp.data) return;
    const s = fp.data.stalls.find((st) => st.code === focusedCode);
    if (s) handleStallClick(s);
  }

  const searchHit = useMemo(() => (fp.hitCode ? fp.data?.stalls.find((s) => s.code === fp.hitCode) : null), [
    fp.hitCode,
    fp.data,
  ]);
  useEffect(() => {
    if (searchHit) focusStall(searchHit.code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchHit?.code]);

  if (!fp.data) {
    return <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Loading floor plan…</div>;
  }

  const { data } = fp;
  const canvasPxWidth = data.canvasWidth * scale;
  const canvasPxHeight = data.canvasHeight * scale;

  return (
    <div className="rounded-xl border border-border bg-card p-3" style={{ background: INK.paper }}>
      {/* Stats strip */}
      <div
        className="mb-3 grid grid-cols-4 divide-x overflow-hidden rounded-lg border"
        style={{ borderColor: INK.line2, background: "#fff" }}
      >
        <StatCell label="Total stalls" value={fp.stats.total} />
        <StatCell label="Available" value={fp.stats.available} color={INK.green} />
        <StatCell label="Booked" value={fp.stats.booked} suffix={`${fp.stats.pctSold}% sold`} color={INK.red} />
        <StatCell label="Blocked" value={fp.stats.blocked} color={INK.gold} />
      </div>

      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-48">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={fp.search}
            onChange={(e) => fp.searchStall(e.target.value)}
            placeholder="Find stall"
            className="h-8 pl-7 text-xs"
          />
        </div>

        <div className="flex flex-1 flex-wrap gap-1">
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => fp.setStatusFilter(fp.statusFilter === opt.value ? null : opt.value)}
              className="rounded border px-2 py-1 text-[10px] font-semibold tracking-wide uppercase transition"
              style={{
                background: fp.statusFilter === opt.value ? INK.ink : "#fff",
                color: fp.statusFilter === opt.value ? "#fff" : INK.ink2,
                borderColor: fp.statusFilter === opt.value ? INK.ink : INK.line,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <Button size="icon-sm" variant="outline" onClick={() => zoomTo(Math.round((zoom - 0.05) * 100) / 100)} title="Zoom out">
            <Minus />
          </Button>
          <span className="w-10 text-center text-[11px] font-semibold" style={{ color: INK.ink3 }}>
            {Math.round(zoom * 100)}%
          </span>
          <Button size="icon-sm" variant="outline" onClick={() => zoomTo(Math.round((zoom + 0.05) * 100) / 100)} title="Zoom in">
            <Plus />
          </Button>
          <Button size="sm" variant="outline" onClick={fitToWidth}>
            Fit
          </Button>
          <Button
            size="sm"
            variant={showPhoto ? "default" : "outline"}
            onClick={() => setShowPhoto((v) => !v)}
            title={showPhoto ? "Hide the original layout overlay" : "Show the original layout drawing as a faint overlay"}
          >
            <Image />
            Original layout
          </Button>
        </div>
      </div>

      {/* Viewport */}
      <div
        ref={viewportRef}
        role="application"
        tabIndex={0}
        onKeyDown={(e) => {
          onKeyDown(e);
          onEnter(e);
        }}
        onPointerDown={onViewportPointerDown}
        onPointerMove={onViewportPointerMove}
        onPointerUp={onViewportPointerUp}
        onPointerCancel={onViewportPointerUp}
        onWheel={(e) => {
          if (!e.ctrlKey) return;
          e.preventDefault();
          zoomTo(zoom * (e.deltaY < 0 ? 1.08 : 0.93));
        }}
        className="relative max-h-[70vh] cursor-grab overflow-auto rounded-lg border outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
        style={{ borderColor: INK.line2, background: INK.plan }}
      >
        <div style={{ position: "relative", width: canvasPxWidth, height: canvasPxHeight }}>
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: data.canvasWidth,
              height: data.canvasHeight,
              transform: `scale(${scale})`,
              transformOrigin: "0 0",
            }}
          >
            {/* Real layout photo, fit to the canvas coordinate space via a least-squares affine
                (see PHOTO_MATRIX) — off by default, toggled by the admin, purely a reference
                check against the real drawing, never blocks clicks underneath. */}
            {showPhoto && data.layoutImageUrl && (
              <img
                src={data.layoutImageUrl}
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute opacity-40"
                style={{
                  left: 0,
                  top: 0,
                  width: 1600,
                  height: 1131,
                  maxWidth: "none",
                  transformOrigin: "0 0",
                  transform: `matrix(${PHOTO_MATRIX.join(",")})`,
                }}
              />
            )}
            <DecorLayer decor={data.decor} canvasWidth={data.canvasWidth} canvasHeight={data.canvasHeight} />
            {fp.visibleStalls.map((s) => (
              <StallShape
                key={s.id}
                stall={s}
                selected={fp.selected.has(s.code)}
                dimmed={fp.dimmedCodes.has(s.code)}
                hit={fp.hitCode === s.code || fp.justChanged.has(s.code) || focusedCode === s.code}
                onClick={() => handleStallClick(s)}
                onHover={(stall, evt) => setHover(stall && evt ? { stall, x: evt.clientX, y: evt.clientY } : null)}
              />
            ))}
            {lassoRect && (
              <div
                className="pointer-events-none absolute"
                style={{
                  left: lassoRect.x,
                  top: lassoRect.y,
                  width: lassoRect.w,
                  height: lassoRect.h,
                  background: "rgba(200,29,37,.08)",
                  border: `1px solid ${INK.red}`,
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t pt-2.5" style={{ borderColor: INK.line2 }}>
        {(Object.keys(STATUS_STYLES) as (keyof typeof STATUS_STYLES)[])
          .filter((key) => key !== "BOOKED_UNPAID")
          .map((key) => {
          const s = STATUS_STYLES[key];
          return (
            <div key={key} className="flex items-center gap-1.5 text-[11px]" style={{ color: INK.ink2 }}>
              <span
                className="inline-block size-3 rounded-sm border"
                style={{
                  background: key === "AVAILABLE" ? "#ccc" : s.background,
                  borderColor: s.border,
                  backgroundImage: s.hatch,
                }}
              />
              {s.label}
            </div>
          );
        })}
      </div>

      <StallTooltip stall={hover?.stall ?? null} x={hover?.x ?? 0} y={hover?.y ?? 0} />

      {/* Floating multi-select bar */}
      {fp.selected.size > 0 && (
        <div
          className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg px-4 py-2.5 shadow-2xl"
          style={{ background: INK.ink, color: "#fff" }}
        >
          <span className="max-w-[420px] truncate text-xs font-semibold tracking-wide" title={fp.selectedStalls.map((s) => s.code).join(", ")}>
            {selectedStallsLabel(fp.selectedStalls)}
          </span>
          <span className="text-sm font-bold">{formatCurrency(fp.selectedTotal)}</span>
          <Button size="sm" variant="ghost" className="h-7 text-white hover:bg-white/10 hover:text-white" onClick={fp.clearSelection}>
            Clear
          </Button>
          {blockMode ? (
            <Button size="sm" className="h-7" onClick={() => onBlockSelected(fp.selectedStalls)}>
              Block selected
            </Button>
          ) : (
            <Button size="sm" className="h-7" onClick={() => onBookSelected(fp.selectedStalls)}>
              Book selected
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function selectedStallsLabel(stalls: FloorPlanStall[]): string {
  const codes = stalls.map((s) => s.code);
  const MAX = 6;
  if (codes.length <= MAX) return codes.join(", ");
  return `${codes.slice(0, MAX).join(", ")} +${codes.length - MAX} more`;
}

function StatCell({ label, value, suffix, color }: { label: string; value: number; suffix?: string; color?: string }) {
  return (
    <div className="px-4 py-2.5">
      <div className="text-[9.5px] font-semibold tracking-wider uppercase" style={{ color: INK.ink3 }}>
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-xl font-bold tracking-tight" style={{ color: color ?? INK.ink }}>
          {value}
        </span>
        {suffix && (
          <span className="text-[11px] font-semibold" style={{ color: INK.ink3 }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
