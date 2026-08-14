import type { BookedByOrg } from "../lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const OPTIONS: { value: BookedByOrg; label: string }[] = [
  { value: "MEC", label: "MEC" },
  { value: "CHAMBER_OF_COMMERCE", label: "Chamber of Commerce" },
];

export function OrgToggle({ value, onChange }: { value: BookedByOrg; onChange: (v: BookedByOrg) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>Booked by</Label>
      <div className="flex gap-2">
        {OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            type="button"
            variant={value === opt.value ? "default" : "outline"}
            className="flex-1"
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
