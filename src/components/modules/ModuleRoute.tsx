import type { ReactNode } from "react";
import type { ModuleRequirement } from "@/lib/modules/moduleRequirement";
import { RouteModuleContext } from "./RouteModuleContext";

interface ModuleRouteProps {
  /** A module, or a list meaning "any of these". */
  module: ModuleRequirement;
  children: ReactNode;
}

/** Declares which module a route belongs to; DashboardLayout applies the gate. */
export function ModuleRoute({ module, children }: ModuleRouteProps) {
  return <RouteModuleContext.Provider value={module}>{children}</RouteModuleContext.Provider>;
}
