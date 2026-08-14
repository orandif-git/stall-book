import { CircleDot } from "lucide-react";
import type { ActivityLogEntry } from "../lib/api";

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ActivityTimeline({ entries }: { entries: ActivityLogEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">Activity</div>
      <div className="space-y-2.5">
        {entries.map((e) => (
          <div key={e.id} className="flex gap-2 text-xs">
            <CircleDot className="mt-0.5 size-3 shrink-0 text-muted-foreground/50" />
            <div className="min-w-0">
              <div className="text-foreground">{e.description}</div>
              <div className="text-muted-foreground">
                {e.performedByName} · {formatWhen(e.createdAt)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
