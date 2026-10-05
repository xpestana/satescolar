import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { MODULE_ICONS } from "@/components/modules/moduleIcons";
import { cn } from "@/lib/utils";
import type { ModuleInfo } from "@/lib/modules/moduleCatalog";
import { expiryFromLastActiveDay, lastActiveDayFromExpiry } from "@/lib/modules/moduleExpiry";
import { daysUntilExpiry, getModuleStatus, type SchoolModuleState } from "@/lib/modules/moduleStatus";

interface SchoolModuleRowProps {
  info: ModuleInfo;
  state: SchoolModuleState | null;
  disabled?: boolean;
  onChange: (next: SchoolModuleState) => void;
}

const STATUS_BADGE = {
  active: { label: "Activo", className: "bg-green-100 text-green-800 border-green-200" },
  expiring: { label: "Por vencer", className: "bg-amber-100 text-amber-800 border-amber-200" },
  expired: { label: "Vencido", className: "bg-red-100 text-red-800 border-red-200" },
  disabled: { label: "Inactivo", className: "bg-muted text-muted-foreground" },
} as const;

export function SchoolModuleRow({ info, state, disabled, onChange }: SchoolModuleRowProps) {
  const Icon = MODULE_ICONS[info.key];
  const status = getModuleStatus(state);
  const days = daysUntilExpiry(state);
  const enabled = state?.enabled ?? false;
  const expiresAt = state?.expires_at ?? null;
  const lastActiveDay = expiresAt ? lastActiveDayFromExpiry(expiresAt) : undefined;

  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{info.name}</p>
            <Badge variant="outline" className={STATUS_BADGE[status].className}>
              {STATUS_BADGE[status].label}
              {status === "expiring" && days !== null && ` · ${days} ${days === 1 ? "día" : "días"}`}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{info.tagline}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:justify-end">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={disabled || !enabled}
              className={cn("w-[190px] justify-start font-normal", !lastActiveDay && "text-muted-foreground")}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {lastActiveDay ? `Hasta ${format(lastActiveDay, "dd/MM/yyyy")}` : "Sin vencimiento"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              locale={es}
              selected={lastActiveDay}
              onSelect={(day) => day && onChange({ enabled, expires_at: expiryFromLastActiveDay(day) })}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Quitar vencimiento"
          disabled={disabled || !expiresAt}
          onClick={() => onChange({ enabled, expires_at: null })}
        >
          <X className="h-4 w-4" />
        </Button>
        <Switch
          checked={enabled}
          disabled={disabled}
          aria-label={`${enabled ? "Desactivar" : "Activar"} ${info.name}`}
          onCheckedChange={(checked) =>
            // Re-enabling an expired module would keep it blocked, so drop the past date.
            onChange({ enabled: checked, expires_at: checked && status === "expired" ? null : expiresAt })
          }
        />
      </div>
    </div>
  );
}
