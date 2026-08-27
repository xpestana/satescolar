import { AlertTriangle, CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SchoolYearOption } from "@/hooks/useSchoolYearSelection";

interface Props {
  years: SchoolYearOption[];
  value: string;
  onChange: (yearId: string) => void;
  isLoading?: boolean;
  /** Warning shown when the selected year is not the active one. `{year}` is replaced. */
  inactiveWarning?: string;
}

/**
 * School year picker for the payment screens, with an amber warning when the selected year is
 * not the one in course — so nobody charges (or reads) the wrong year by accident.
 */
export function SchoolYearSelect({ years, value, onChange, isLoading, inactiveWarning }: Props) {
  const selected = years.find((y) => y.id === value) || null;
  const warning = inactiveWarning?.replace("{year}", selected?.year_range || "");

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm text-muted-foreground">Año escolar</Label>
      </div>
      <Select value={value} onValueChange={onChange} disabled={isLoading || years.length === 0}>
        <SelectTrigger className="w-[220px]">
          <SelectValue placeholder={isLoading ? "Cargando..." : "Seleccione un año"} />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y.id} value={y.id}>
              {y.year_range}{y.is_active ? " (activo)" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selected && !selected.is_active && warning && (
        <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-3 w-3 mr-1" />
          {warning}
        </Badge>
      )}
    </div>
  );
}
