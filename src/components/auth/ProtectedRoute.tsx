import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

type AppRole = "admin" | "school" | "representative";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: AppRole;
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, loading, userRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
    if (!loading && user && requiredRole && userRole !== requiredRole) {
      // Redirect to appropriate dashboard based on role
      if (userRole === "admin") {
        navigate("/dashboard");
      } else if (userRole === "school") {
        navigate("/school/dashboard");
      } else if (userRole === "representative") {
        navigate("/representative/dashboard");
      } else {
        navigate("/login");
      }
    }
  }, [user, loading, userRole, requiredRole, navigate]);

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

  if (requiredRole && userRole !== requiredRole) {
    return null;
  }

  return <>{children}</>;
}
