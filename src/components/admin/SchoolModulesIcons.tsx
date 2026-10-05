import { MODULE_ICONS } from "@/components/modules/moduleIcons";
import { cn } from "@/lib/utils";
import { MODULE_CATALOG, SELLABLE_MODULE_KEYS, type SellableModuleKey } from "@/lib/modules/moduleCatalog";
import { getModuleStatus, type ModuleStatus, type SchoolModuleState } from "@/lib/modules/moduleStatus";

interface SchoolModulesIconsProps {
  states: Map<SellableModuleKey, SchoolModuleState> | undefined;
}

const STATUS_STYLE: Record<ModuleStatus, string> = {
  active: "bg-primary/10 text-primary",
  expiring: "bg-amber-100 text-amber-700",
  expired: "bg-red-100 text-red-600",
  disabled: "bg-muted text-muted-foreground/40",
};

const STATUS_LABEL: Record<ModuleStatus, string> = {
  active: "activo",
  expiring: "por vencer",
  expired: "vencido",
  disabled: "inactivo",
};

/** Compact row of module icons for the schools list, coloured by status. */
export function SchoolModulesIcons({ states }: SchoolModulesIconsProps) {
  return (
    <div className="flex items-center gap-1">
      {SELLABLE_MODULE_KEYS.map((key) => {
        const Icon = MODULE_ICONS[key];
        const status = getModuleStatus(states?.get(key));
        return (
          <span
            key={key}
            title={`${MODULE_CATALOG[key].name}: ${STATUS_LABEL[status]}`}
            className={cn("flex h-6 w-6 items-center justify-center rounded", STATUS_STYLE[status])}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
        );
      })}
    </div>
  );
}
