import { AlertTriangle, CalendarDays } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
 * School year picker for the payment screens. When the selected year is not the one in course
 * it shows an amber banner — the choice is remembered across reloads and payment screens, so it
 * must be obvious — with a shortcut back to the active year.
 */
export function SchoolYearSelect({ years, value, onChange, isLoading, inactiveWarning }: Props) {
  const selected = years.find((y) => y.id === value) || null;
  const active = years.find((y) => y.is_active) || null;
  const warning =
    inactiveWarning?.replace("{year}", selected?.year_range || "") ||
    `Está trabajando en el año ${selected?.year_range || ""}, que no es el año en curso`;

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
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
      </div>
      {selected && !selected.is_active && (
        <Alert className="border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-300 [&>svg]:text-amber-600">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{warning}</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>
              Esta selección se mantiene al recargar y en las demás pantallas de pagos
              {active ? `. El año en curso es ${active.year_range}.` : "."}
            </span>
            {active && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 border-amber-500/50 bg-transparent"
                onClick={() => onChange(active.id)}
              >
                Volver a {active.year_range}
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
