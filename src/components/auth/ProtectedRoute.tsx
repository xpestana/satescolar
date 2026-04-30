import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { PageLoadingSkeleton } from "@/components/ui/loading-skeletons";

type AppRole = "admin" | "school" | "representative" | "teacher";

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
    if (!loading && user && requiredRole && userRole && userRole !== requiredRole) {
      // Redirect to appropriate dashboard based on role
      if (userRole === "admin") {
        navigate("/dashboard");
      } else if (userRole === "school") {
        navigate("/school/dashboard");
      } else if (userRole === "representative") {
        navigate("/representative/dashboard");
      } else if (userRole === "teacher") {
        navigate("/teacher/dashboard");
      } else {
        navigate("/login");
      }
    }
  }, [user, loading, userRole, requiredRole, navigate]);

  if (loading) {
    return <PageLoadingSkeleton />;
  }

  if (!user) {
    return null;
  }

  if (requiredRole && !userRole) {
    return <PageLoadingSkeleton />;
  }

  if (requiredRole && userRole !== requiredRole) {
    return null;
  }

  return <>{children}</>;
}
