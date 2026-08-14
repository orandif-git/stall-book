import type { FloorPlanDecorItem } from "../../lib/api";
import { INK } from "./planTokens";

interface Props {
  decor: FloorPlanDecorItem[];
  canvasWidth: number;
  canvasHeight: number;
}

// Purely decorative — walls, aisle dashes, stair blocks, entry/exit arrows, text labels.
// Rendered as SVG beneath the stall layer, pointer-events disabled throughout so it never
// intercepts clicks meant for stalls.
export function DecorLayer({ decor, canvasWidth, canvasHeight }: Props) {
  return (
    <svg
      width={canvasWidth}
      height={canvasHeight}
      viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
      className="pointer-events-none absolute top-0 left-0"
      aria-hidden="true"
    >
      <defs>
        <pattern id="stair-hatch" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="8" stroke={INK.ink2} strokeWidth="2" />
        </pattern>
        <marker id="arrow-head" markerWidth="10" markerHeight="10" refX="7" refY="5" orient="auto">
          <path d="M0,0 L10,5 L0,10 Z" fill={INK.red} />
        </marker>
      </defs>

      {decor.map((d) => {
        switch (d.kind) {
          case "WALL":
            if (d.posX == null || d.posY == null || d.width == null || d.height == null) return null;
            return (
              <rect
                key={d.id}
                x={d.posX}
                y={d.posY}
                width={d.width}
                height={d.height}
                fill="none"
                stroke={INK.ink3}
                strokeWidth={1.5}
                strokeDasharray="7 5"
              />
            );
          case "AISLE": {
            const p = d.points;
            if (!p || p.length < 4) return null;
            return (
              <line
                key={d.id}
                x1={p[0]}
                y1={p[1]}
                x2={p[2]}
                y2={p[3]}
                stroke={INK.line}
                strokeWidth={1}
                strokeDasharray="6 6"
              />
            );
          }
          case "STAIRS":
            if (d.posX == null || d.posY == null || d.width == null || d.height == null) return null;
            return (
              <rect
                key={d.id}
                x={d.posX}
                y={d.posY}
                width={d.width}
                height={d.height}
                fill="url(#stair-hatch)"
                stroke={INK.ink2}
                strokeWidth={1.5}
              />
            );
          case "ARROW": {
            const p = d.points;
            if (!p || p.length < 4) return null;
            const midX = (p[0] + p[2]) / 2;
            const topY = Math.min(p[1], p[3]) - 6;
            return (
              <g key={d.id}>
                <line
                  x1={p[0]}
                  y1={p[1]}
                  x2={p[2]}
                  y2={p[3]}
                  stroke={INK.red}
                  strokeWidth={2}
                  markerEnd="url(#arrow-head)"
                />
                {d.text && (
                  <text
                    x={midX}
                    y={topY}
                    textAnchor="middle"
                    fill={INK.red}
                    fontWeight={700}
                    fontSize={10}
                    letterSpacing="0.12em"
                  >
                    {d.text}
                  </text>
                )}
              </g>
            );
          }
          case "LABEL":
            if (d.posX == null || d.posY == null || !d.text) return null;
            return (
              <text
                key={d.id}
                x={d.posX}
                y={d.posY + 9}
                fill={INK.ink3}
                fontWeight={600}
                fontSize={10}
                letterSpacing="0.1em"
              >
                {d.text}
              </text>
            );
          default:
            return null;
        }
      })}
    </svg>
  );
}
