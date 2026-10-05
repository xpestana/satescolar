import { useEffect, useRef, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSchoolData } from "@/hooks/useSchoolData";
import { useSchoolModules } from "@/hooks/useSchoolModules";
import type { ModuleKey } from "@/lib/modules/moduleCatalog";
import { LockedModuleOverlay } from "./LockedModuleOverlay";

interface ModuleGateProps {
  module: ModuleKey;
  children: ReactNode;
}

const ROLE_HOME = {
  teacher: "/teacher/dashboard",
  representative: "/representative/dashboard",
} as const;

/**
 * Renders `children` only when the school has `module` active.
 * - School staff see the content blurred and inert under a sales overlay.
 * - Teachers and representatives are sent back to their dashboard.
 */
export function ModuleGate({ module, children }: ModuleGateProps) {
  const { userRole } = useAuth();
  const { isLoading, isActive, getState, getStatus } = useSchoolModules();

  if (module === "registration" || isActive(module)) return <>{children}</>;

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (userRole === "teacher" || userRole === "representative") {
    return <Navigate to={ROLE_HOME[userRole]} replace />;
  }

  const expiredAt = getStatus(module) === "expired" ? getState(module)?.expires_at ?? null : null;
  return (
    <LockedModuleView module={module} expiredAt={expiredAt}>
      {children}
    </LockedModuleView>
  );
}

interface LockedModuleViewProps {
  module: Exclude<ModuleKey, "registration">;
  expiredAt: string | null;
  children: ReactNode;
}

function LockedModuleView({ module, expiredAt, children }: LockedModuleViewProps) {
  const { school } = useSchoolData();
  const previewRef = useRef<HTMLDivElement>(null);

  // `inert` keeps the blurred preview out of keyboard focus and screen readers.
  // React 18 doesn't know the attribute, so it is set on the DOM node.
  useEffect(() => {
    previewRef.current?.setAttribute("inert", "");
  }, []);

  return (
    <div className="relative max-h-[calc(100vh-6rem)] min-h-[60vh] overflow-hidden rounded-lg">
      <div
        ref={previewRef}
        aria-hidden="true"
        className="pointer-events-none select-none opacity-70 blur-[3px]"
      >
        {children}
      </div>
      <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/40 p-4">
        <LockedModuleOverlay module={module} schoolName={school?.name} expiredAt={expiredAt} />
      </div>
    </div>
  );
}
