import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

/**
 * Standard wrapper for dashboard pages.
 *
 * Layout rule: only `<main>` inside DashboardLayout owns the page scroll.
 * Pages must NOT add `min-h-screen`, `h-screen` or `overflow-y-auto` at the
 * root — doing so produces a second scrollbar competing with the main one.
 *
 * Use this component (or just a `<div className="space-y-6">`) as the page root.
 */
export function PageContainer({ children, className }: PageContainerProps) {
  return <div className={cn("space-y-6", className)}>{children}</div>;
}
