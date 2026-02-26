import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { useAuth } from "@/hooks/useAuth";
import { SidebarProvider, useSidebarState } from "@/hooks/useSidebarState";

interface DashboardLayoutProps {
  children: ReactNode;
}

function DashboardContent({ children }: DashboardLayoutProps) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { collapsed, isVisible } = useSidebarState();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
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
        style={{ marginRight: collapsed ? 0 : "18rem" }}
      >
        {children}
      </main>
    </div>
  );
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <DashboardContent>{children}</DashboardContent>
    </SidebarProvider>
  );
}
