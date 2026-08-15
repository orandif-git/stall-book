// A small draw-in success checkmark for the "request submitted" screen — circle strokes in,
// then the check strokes in right after. Respects prefers-reduced-motion (just shows the
// finished mark with no animation) since this is pure decoration, not information.
export function AnimatedCheck() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="text-primary" aria-hidden="true">
      <circle
        cx="32"
        cy="32"
        r="28"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        pathLength={100}
        className="motion-safe:animate-[ac-circle_0.5s_ease-out_forwards] [stroke-dasharray:100] [stroke-dashoffset:100] motion-reduce:[stroke-dashoffset:0]"
      />
      <path
        d="M20 33.5L28 41.5L44 24.5"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={100}
        className="motion-safe:animate-[ac-check_0.35s_ease-out_0.45s_forwards] [stroke-dasharray:100] [stroke-dashoffset:100] motion-reduce:[stroke-dashoffset:0]"
      />
      <style>{`
        @keyframes ac-circle { to { stroke-dashoffset: 0; } }
        @keyframes ac-check { to { stroke-dashoffset: 0; } }
      `}</style>
    </svg>
  );
}
