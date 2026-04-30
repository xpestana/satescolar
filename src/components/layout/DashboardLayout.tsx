import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { useAuth } from "@/hooks/useAuth";
import { useSidebarState } from "@/hooks/useSidebarState";
import { PageLoadingSkeleton } from "@/components/ui/loading-skeletons";

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
    <div className="min-h-screen bg-background">
      <TopBar />
      <AppSidebar />
      <main
        className="min-h-screen pt-16 p-6 transition-[margin] duration-300 ease-in-out"
        style={{ marginRight: collapsed ? 0 : "20rem" }}
      >
        {children}
      </main>
    </div>
  );
}
