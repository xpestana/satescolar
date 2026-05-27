import { ReactNode, useEffect, useRef } from "react";
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

  // Sticky role: remember the last confirmed role so that transient null
  // values during Supabase token refreshes don't unmount child components
  // (which would destroy form state).
  const lastRoleRef = useRef<AppRole | null>(null);
  if (userRole) lastRoleRef.current = userRole;
  const effectiveRole = userRole ?? lastRoleRef.current;

  // Sticky user: same idea — keep showing content while user briefly
  // transitions through null during a refresh cycle.
  const lastUserRef = useRef(user);
  if (user) lastUserRef.current = user;
  const effectiveUser = user ?? lastUserRef.current;

  useEffect(() => {
    // Only act on definitive states (loading finished).
    if (loading) return;

    if (!user) {
      navigate("/login");
      return;
    }

    if (requiredRole && userRole && userRole !== requiredRole) {
      if (userRole === "admin") navigate("/dashboard");
      else if (userRole === "school") navigate("/school/dashboard");
      else if (userRole === "representative") navigate("/representative/dashboard");
      else if (userRole === "teacher") navigate("/teacher/dashboard");
      else navigate("/login");
    }
  }, [user, loading, userRole, requiredRole, navigate]);

  // Show skeleton only during the initial load.
  if (loading) {
    return <PageLoadingSkeleton />;
  }

  if (!effectiveUser) {
    return null;
  }

  // While the role is being re-fetched (effectiveRole still has the last
  // known value), keep rendering children to preserve form state.
  if (requiredRole && !effectiveRole) {
    return <PageLoadingSkeleton />;
  }

  if (requiredRole && effectiveRole !== requiredRole) {
    return null;
  }

  return <>{children}</>;
}
