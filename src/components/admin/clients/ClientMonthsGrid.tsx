import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MonthCellState } from "@/lib/clients/clientBillingStatus";

const SHORT_MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const CELL_STYLES: Record<MonthCellState, string> = {
  paid: "border-emerald-300 bg-emerald-50 text-emerald-800",
  waived: "border-sky-300 bg-sky-50 text-sky-800",
  pending: "border-red-300 bg-red-50 text-red-800 hover:bg-red-100",
  upcoming: "border-border bg-background hover:bg-muted",
};

const CELL_HINTS: Record<MonthCellState, string> = {
  paid: "Pagado",
  waived: "Exonerado",
  pending: "Pendiente",
  upcoming: "Por venir",
};

interface ClientMonthsGridProps {
  months: string[];
  stateOf: (month: string) => MonthCellState;
  selected: Set<string>;
  onToggle: (month: string) => void;
}

/** Months grouped by year; pending/upcoming months can be selected to register a payment. */
export function ClientMonthsGrid({ months, stateOf, selected, onToggle }: ClientMonthsGridProps) {
  const years = [...new Set(months.map((m) => m.slice(0, 4)))];

  return (
    <div className="space-y-4">
      {years.map((year) => (
        <div key={year}>
          <p className="mb-2 text-sm font-semibold text-muted-foreground">{year}</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-12">
            {months
              .filter((m) => m.startsWith(year))
              .map((month) => {
                const state = stateOf(month);
                const settled = state === "paid" || state === "waived";
                const isSelected = selected.has(month);
                return (
                  <button
                    key={month}
                    type="button"
                    disabled={settled}
                    onClick={() => onToggle(month)}
                    aria-pressed={isSelected}
                    title={CELL_HINTS[state]}
                    className={cn(
                      "relative flex flex-col items-center rounded-lg border px-2 py-2 text-sm transition-colors",
                      CELL_STYLES[state],
                      settled && "cursor-default",
                      isSelected && "border-primary bg-primary text-primary-foreground ring-2 ring-primary/30 hover:bg-primary",
                    )}
                  >
                    <span className="font-medium">{SHORT_MONTHS[Number(month.slice(5, 7)) - 1]}</span>
                    <span className="text-[10px] uppercase opacity-80">{isSelected ? "Seleccionado" : CELL_HINTS[state]}</span>
                    {settled && <Check className="absolute right-1 top-1 h-3 w-3" />}
                  </button>
                );
              })}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded border border-red-300 bg-red-50" /> Pendiente</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded border border-emerald-300 bg-emerald-50" /> Pagado</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded border border-sky-300 bg-sky-50" /> Exonerado</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded border bg-background" /> Por venir (pago adelantado)</span>
      </div>
    </div>
  );
}
