import { useState } from "react";
import { Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  type CertificateInstitution,
  type GradeRowBulkPatch,
  DEFAULT_EVALUATION_TYPE,
  DEFAULT_GRADE_MONTH,
  padTwoDigits,
} from "@/lib/grade-certificate";
import { CertificateTextInput } from "./CertificateTextInput";
import { InstitutionSelect } from "./InstitutionSelect";

interface BulkApplyPopoverProps {
  rowCount: number;
  institutions: CertificateInstitution[];
  onApply: (patch: GradeRowBulkPatch) => void;
}

const digitsOnly = (value: string) => value.replace(/\D/g, "");

/**
 * "Aplicar a todo el año": T-E, month, year and institution for every row at once, the quick way
 * to load a year the student studied in another school. Fields left empty are not touched.
 */
export function BulkApplyPopover({ rowCount, institutions, onApply }: BulkApplyPopoverProps) {
  const [open, setOpen] = useState(false);
  const [evaluationType, setEvaluationType] = useState(DEFAULT_EVALUATION_TYPE);
  const [month, setMonth] = useState(DEFAULT_GRADE_MONTH);
  const [year, setYear] = useState("");
  const [institutionId, setInstitutionId] = useState<string | null>(null);

  const patch: GradeRowBulkPatch = {
    ...(evaluationType.trim() && { evaluationType: evaluationType.trim() }),
    ...(month.trim() && { month: padTwoDigits(month) }),
    ...(year.trim() && { year: year.trim() }),
    ...(institutionId && { institutionId }),
  };
  const hasFields = Object.keys(patch).length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Wand2 className="h-3.5 w-3.5 mr-1.5" />
          Aplicar a todo el año
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3">
        <div>
          <p className="text-sm font-medium">Aplicar a las {rowCount} áreas del año</p>
          <p className="text-xs text-muted-foreground">Lo que dejes vacío no se cambia.</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label htmlFor="bulk-te" className="text-xs">T-E</Label>
            <CertificateTextInput id="bulk-te" value={evaluationType} onValueChange={setEvaluationType} maxLength={2} className="h-8 text-sm text-center" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bulk-month" className="text-xs">Mes</Label>
            <CertificateTextInput id="bulk-month" value={month} onValueChange={(v) => setMonth(digitsOnly(v))} normalize={padTwoDigits} maxLength={2} inputMode="numeric" placeholder="07" className="h-8 text-sm text-center" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bulk-year" className="text-xs">Año</Label>
            <CertificateTextInput id="bulk-year" value={year} onValueChange={(v) => setYear(digitsOnly(v))} maxLength={4} inputMode="numeric" placeholder="2024" className="h-8 text-sm text-center" />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Institución</Label>
          <InstitutionSelect institutions={institutions} value={institutionId} onChange={setInstitutionId} aria-label="Institución para todo el año" />
        </div>
        <Button
          size="sm"
          className="w-full"
          disabled={!hasFields}
          onClick={() => {
            onApply(patch);
            setOpen(false);
          }}
        >
          Aplicar
        </Button>
      </PopoverContent>
    </Popover>
  );
}
