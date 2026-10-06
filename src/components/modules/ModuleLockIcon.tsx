import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSchoolModules } from "@/hooks/useSchoolModules";
import { isRequirementMet, type ModuleRequirement } from "@/lib/modules/moduleRequirement";

interface ModuleLockIconProps {
  module: ModuleRequirement;
  className?: string;
}

/** Small lock shown next to a tab or button whose module is not active for the school. */
export function ModuleLockIcon({ module, className }: ModuleLockIconProps) {
  const { isLoading, isActive } = useSchoolModules();
  if (isLoading || isRequirementMet(module, isActive)) return null;
  return (
    <Lock
      className={cn("h-3 w-3 flex-shrink-0 text-muted-foreground", className)}
      aria-label="Módulo no activo"
    />
  );
}
