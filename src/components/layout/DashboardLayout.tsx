import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { useAuth } from "@/hooks/useAuth";
import { useSidebarState } from "@/hooks/useSidebarState";
import { PageLoadingSkeleton } from "@/components/ui/loading-skeletons";
import { SIDEBAR_WIDTH } from "@/lib/layout-constants";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { collapsed } = useSidebarState();

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

  return (
    <div className="h-screen overflow-hidden bg-background">
      <TopBar />
      <AppSidebar />
      <div
        className="h-screen transition-[padding] duration-300 ease-in-out"
        style={{ paddingRight: collapsed ? 0 : SIDEBAR_WIDTH }}
      >
        <main className="h-screen overflow-y-auto pt-16 p-6">{children}</main>
      </div>
    </div>
  );
}
