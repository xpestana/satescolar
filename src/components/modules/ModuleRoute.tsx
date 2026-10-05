import type { ReactNode } from "react";
import type { ModuleKey } from "@/lib/modules/moduleCatalog";
import { RouteModuleContext } from "./RouteModuleContext";

interface ModuleRouteProps {
  module: ModuleKey;
  children: ReactNode;
}

/** Declares which module a route belongs to; DashboardLayout applies the gate. */
export function ModuleRoute({ module, children }: ModuleRouteProps) {
  return <RouteModuleContext.Provider value={module}>{children}</RouteModuleContext.Provider>;
}
