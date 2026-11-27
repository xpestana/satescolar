import type { AppRole } from "@/lib/userContext";

const ROLE_HOME: Record<AppRole, string> = {
  admin: "/dashboard",
  school: "/school/dashboard",
  representative: "/representative/dashboard",
  teacher: "/teacher/dashboard",
};

/** Home screen of each role; without a known role, the login screen. */
export function roleHomePath(role: AppRole | null | undefined): string {
  return role ? ROLE_HOME[role] ?? "/login" : "/login";
}
