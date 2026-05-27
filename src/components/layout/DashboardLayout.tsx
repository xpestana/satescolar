import { ReactNode, useEffect, useRef } from "react";
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

  // Sticky user: keep the last known user so a transient null during a
  // Supabase token-refresh cycle doesn't unmount children and destroy forms.
  const lastUserRef = useRef(user);
  if (user) lastUserRef.current = user;
  const effectiveUser = user ?? lastUserRef.current;

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  // Lock document scroll only while the dashboard shell is mounted.
  useEffect(() => {
    document.body.classList.add("dashboard-locked");
    return () => document.body.classList.remove("dashboard-locked");
  }, []);

  if (loading) {
    return <PageLoadingSkeleton />;
  }

  if (!effectiveUser) {
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
