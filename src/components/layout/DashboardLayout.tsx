import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { useAuth } from "@/hooks/useAuth";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useIsMobile } from "@/hooks/use-mobile";
import { PageLoadingSkeleton } from "@/components/ui/loading-skeletons";
import { SIDEBAR_WIDTH } from "@/lib/layout-constants";

interface DashboardLayoutProps {
  children: ReactNode;
}

/**
 * Layout shell rules (do NOT replicate in pages):
 * - The root locks the viewport (`h-screen overflow-hidden`) so the document
 *   itself never scrolls — that's what produced the "scrollbar at the wrong
 *   edge" bug.
 * - Only `<main>` is scrollable. Its scrollbar appears at the right edge of
 *   the content area, sitting flush against the left edge of the sidebar.
 * - The sidebar is `position: fixed` and we reserve its width with
 *   `paddingRight` (desktop only). On mobile the sidebar overlays the content
 *   and we don't reserve space.
 */
export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { collapsed } = useSidebarState();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return <PageLoadingSkeleton />;
  }

  if (!user) {
    return null;
  }

  const reserveSidebar = !isMobile && !collapsed;

  return (
    <div className="h-screen overflow-hidden bg-background">
      <TopBar />
      <AppSidebar />
      <div
        className="transition-[padding] duration-300 ease-in-out"
        style={{ paddingRight: reserveSidebar ? SIDEBAR_WIDTH : 0 }}
      >
        <main className="h-screen overflow-y-auto pt-16 px-4 pb-6 md:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
