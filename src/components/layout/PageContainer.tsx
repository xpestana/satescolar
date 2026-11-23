import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Size = "narrow" | "default" | "wide" | "full";

const SIZE_MAP: Record<Size, string> = {
  narrow: "max-w-3xl",
  default: "max-w-7xl",
  wide: "max-w-[90rem]",
  full: "max-w-none",
};

interface PageContainerProps {
  children: ReactNode;
  size?: Size;
  className?: string;
}

/**
 * Standard wrapper for page content inside DashboardLayout.
 * Centralizes max-width, horizontal centering and vertical spacing
 * so we don't repeat the same wrapper classes in every page (DRY).
 */
export function PageContainer({
  children,
  size = "default",
  className,
}: PageContainerProps) {
  return (
    <div className={cn("mx-auto w-full space-y-6 pb-8", SIZE_MAP[size], className)}>
      {children}
    </div>
  );
}
