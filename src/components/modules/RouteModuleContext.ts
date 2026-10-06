import { createContext, useContext } from "react";
import type { ModuleRequirement } from "@/lib/modules/moduleRequirement";

/**
 * Module the current route belongs to. Set by <ModuleRoute> in App.tsx and read by
 * DashboardLayout, which gates only the page content (never the sidebar/top bar).
 */
export const RouteModuleContext = createContext<ModuleRequirement | null>(null);

export function useRouteModule(): ModuleRequirement | null {
  return useContext(RouteModuleContext);
}
