import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { SyncCandidate, SyncCandidateStatus } from "@/lib/grade-certificate-sync";

const STATUS_LABEL: Record<SyncCandidateStatus, string> = {
  new: "Nueva",
  update: "Actualiza",
  unchanged: "Sin cambios",
  no_grade: "Sin definitiva",
};

const STATUS_STYLE: Record<SyncCandidateStatus, string> = {
  new: "border-emerald-300 bg-emerald-50 text-emerald-700",
  update: "border-amber-300 bg-amber-50 text-amber-800",
  unchanged: "text-muted-foreground",
  no_grade: "text-muted-foreground border-dashed",
};

const KIND_HINT: Partial<Record<SyncCandidate["kind"], string>> = {
  orientation: "Literal de Orientación y Convivencia",
  group: "Grupo (GCRP)",
};

interface SyncCandidateRowProps {
  candidate: SyncCandidate;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

/** One subject of the sync dialog: what the system has and what bringing it would change. */
export function SyncCandidateRow({ candidate, checked, onCheckedChange }: SyncCandidateRowProps) {
  const id = `sync-${candidate.key}`;
  const renamed = candidate.status === "update" && !!candidate.currentName && candidate.currentName !== candidate.name;
  const regraded = candidate.status === "update" && candidate.currentValue !== candidate.value;

  return (
    <label
      htmlFor={id}
      className={cn(
        "flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/40 transition-colors",
        checked && "bg-primary/5",
      )}
    >
      <Checkbox id={id} checked={checked} onCheckedChange={(value) => onCheckedChange(value === true)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{candidate.name}</p>
        {(KIND_HINT[candidate.kind] || renamed) && (
          <p className="text-xs text-muted-foreground truncate">
            {renamed ? <>Hoy dice «{candidate.currentName}»</> : KIND_HINT[candidate.kind]}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1.5 text-sm tabular-nums shrink-0">
        {regraded && (
          <>
            <span className="text-muted-foreground line-through">{candidate.currentValue || "—"}</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
          </>
        )}
        <span className="font-semibold w-6 text-center">{candidate.value || "—"}</span>
      </div>
      <Badge variant="outline" className={cn("w-24 justify-center shrink-0 text-[11px]", STATUS_STYLE[candidate.status])}>
        {STATUS_LABEL[candidate.status]}
      </Badge>
    </label>
  );
}
