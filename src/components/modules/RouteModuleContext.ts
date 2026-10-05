import { createContext, useContext } from "react";
import type { ModuleKey } from "@/lib/modules/moduleCatalog";

/**
 * Module the current route belongs to. Set by <ModuleRoute> in App.tsx and read by
 * DashboardLayout, which gates only the page content (never the sidebar/top bar).
 */
export const RouteModuleContext = createContext<ModuleKey | null>(null);

export function useRouteModule(): ModuleKey | null {
  return useContext(RouteModuleContext);
}
