import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  UsersRound,
  CreditCard,
  Settings,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import logo from "@/assets/logo.svg";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  requiredRole?: "admin" | "school" | "representative";
}

interface NavSection {
  title?: string;
  items: NavItem[];
  requiredRole?: "admin" | "school" | "representative";
}

const navSections: NavSection[] = [
  {
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "REGISTROS ADMIN",
    requiredRole: "admin",
    items: [
      { label: "Usuarios", href: "/admin/usuarios", icon: Users, requiredRole: "admin" },
      { label: "Colegios", href: "/admin/colegios", icon: GraduationCap, requiredRole: "admin" },
    ],
  },
  {
    title: "ÁREA DE REGISTROS",
    items: [
      { label: "Familias", href: "/registros/familias", icon: UsersRound },
    ],
  },
  {
    title: "ÁREA ADMINISTRATIVA",
    items: [
      { label: "Pagos", href: "/admin/pagos", icon: CreditCard },
    ],
  },
  {
    title: "ÁREA DE GESTIÓN DEL COLEGIO",
    items: [
      { label: "Ajustes", href: "/gestion/ajustes", icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const location = useLocation();
  const { user, signOut, userRole } = useAuth();

  const getInitials = (email?: string) => {
    if (!email) return "U";
    return email.charAt(0).toUpperCase();
  };

  const getRoleLabel = (role: string | null) => {
    switch (role) {
      case "admin":
        return "Admin";
      case "school":
        return "Escolar";
      case "representative":
        return "Representante";
      default:
        return "Usuario";
    }
  };

  return (
    <aside className="fixed right-0 top-0 z-40 flex h-screen w-64 flex-col">
      {/* Logo Section - Dark Blue */}
      <div className="flex items-center justify-center py-6 bg-[#01051e]">
        <img src={logo} alt="SAT Escolar" className="h-28" />
      </div>

      {/* Navigation - White Background */}
      <nav className="flex-1 overflow-y-auto px-4 py-4 bg-white border-l border-border">
        {navSections.map((section, sectionIndex) => {
          // Hide entire section if it requires a role the user doesn't have
          if (section.requiredRole && userRole !== section.requiredRole) {
            return null;
          }
          
          // Filter items based on required role
          const visibleItems = section.items.filter(
            (item) => !item.requiredRole || item.requiredRole === userRole
          );
          
          if (visibleItems.length === 0) {
            return null;
          }
          
          return (
            <div key={sectionIndex} className="mb-4">
              {section.title && (
                <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {section.title}
                </h3>
              )}
              <ul className="space-y-1">
                {visibleItems.map((item) => {
                  const isActive = location.pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        to={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-foreground hover:bg-muted"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* User Card - Dark Blue */}
      <div className="bg-[#01051e] p-4 border-l border-border">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border-2 border-primary">
            <AvatarImage src="" />
            <AvatarFallback className="bg-primary/20 text-primary-foreground text-sm font-medium">
              {getInitials(user?.email)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              Colegio
            </p>
            <p className="text-xs text-white/70">
              {getRoleLabel(userRole)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            className="text-white/70 hover:text-white hover:bg-white/10"
            title="Cerrar sesión"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
