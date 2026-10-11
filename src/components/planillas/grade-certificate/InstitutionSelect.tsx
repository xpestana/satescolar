import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { type CertificateInstitution, institutionNumber } from "@/lib/grade-certificate";

const NONE = "none";

interface InstitutionSelectProps {
  institutions: CertificateInstitution[];
  value: string | null;
  onChange: (institutionId: string | null) => void;
  className?: string;
  "aria-label"?: string;
}

/** Picks the institution of a grade. The cell shows only its N°; the list shows the names. */
export function InstitutionSelect({ institutions, value, onChange, className, ...props }: InstitutionSelectProps) {
  const number = institutionNumber(institutions, value);

  return (
    <Select
      value={number ? value! : NONE}
      onValueChange={(next) => onChange(next === NONE ? null : next)}
      disabled={institutions.length === 0}
    >
      <SelectTrigger
        className={cn("h-8 px-2 text-sm", className)}
        title={institutions.length === 0 ? "Agrega primero una institución" : undefined}
        aria-label={props["aria-label"]}
      >
        {number ? <span className="tabular-nums">N° {number}</span> : <span className="text-muted-foreground">**</span>}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Sin institución</SelectItem>
        {institutions.map((institution, index) => (
          <SelectItem key={institution.id} value={institution.id}>
            N° {index + 1} · {institution.name || "Institución sin nombre"}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
