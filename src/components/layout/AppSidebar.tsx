import { useState } from "react";
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
  SlidersHorizontal,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import logo from "@/assets/logo.svg";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  requiredRole?: "admin" | "school" | "representative";
}

interface NavItemWithSub {
  label: string;
  icon: React.ElementType;
  requiredRole?: "admin" | "school" | "representative";
  subItems: NavItem[];
}

interface NavSection {
  title?: string;
  items: (NavItem | NavItemWithSub)[];
  requiredRole?: "admin" | "school" | "representative";
}

function isNavItemWithSub(item: NavItem | NavItemWithSub): item is NavItemWithSub {
  return "subItems" in item;
}

const navSections: NavSection[] = [
  {
    // Dashboard solo para admin
    requiredRole: "admin",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, requiredRole: "admin" },
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
    // Dashboard para school
    requiredRole: "school",
    items: [
      { label: "Inicio", href: "/school/dashboard", icon: LayoutDashboard, requiredRole: "school" },
    ],
  },
  {
    title: "ÁREA DE REGISTROS",
    requiredRole: "school",
    items: [
      { label: "Familias", href: "/registros/familias", icon: UsersRound, requiredRole: "school" },
    ],
  },
  {
    title: "ÁREA ADMINISTRATIVA",
    requiredRole: "school",
    items: [
      { label: "Pagos", href: "/admin/pagos", icon: CreditCard, requiredRole: "school" },
    ],
  },
  {
    title: "ÁREA DE GESTIÓN DEL COLEGIO",
    requiredRole: "school",
    items: [
      {
        label: "Ajustes",
        icon: Settings,
        requiredRole: "school",
        subItems: [
          { label: "Año escolar y secciones", href: "/school/configuraciones/anos-secciones", icon: SlidersHorizontal, requiredRole: "school" },
          { label: "Formularios", href: "/school/configuraciones/formularios", icon: FileText, requiredRole: "school" },
        ],
      },
    ],
  },
];

export function AppSidebar() {
  const location = useLocation();
  const { user, signOut, userRole } = useAuth();
  const [openDropdowns, setOpenDropdowns] = useState<string[]>([]);

  const toggleDropdown = (label: string) => {
    setOpenDropdowns((prev) =>
      prev.includes(label)
        ? prev.filter((l) => l !== label)
        : [...prev, label]
    );
  };

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

  const isSubItemActive = (subItems: NavItem[]) => {
    return subItems.some((sub) => location.pathname === sub.href);
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
          const visibleItems = section.items.filter((item) => {
            if (isNavItemWithSub(item)) {
              return !item.requiredRole || item.requiredRole === userRole;
            }
            return !item.requiredRole || item.requiredRole === userRole;
          });
          
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
                  if (isNavItemWithSub(item)) {
                    const isOpen = openDropdowns.includes(item.label) || isSubItemActive(item.subItems);
                    const Icon = item.icon;
                    
                    return (
                      <li key={item.label}>
                        <Collapsible open={isOpen} onOpenChange={() => toggleDropdown(item.label)}>
                          <CollapsibleTrigger asChild>
                            <button
                              className={cn(
                                "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                                isSubItemActive(item.subItems)
                                  ? "bg-primary text-primary-foreground"
                                  : "text-foreground hover:bg-muted"
                              )}
                            >
                              <span className="flex items-center gap-3">
                                <Icon className="h-5 w-5" />
                                {item.label}
                              </span>
                              <ChevronDown
                                className={cn(
                                  "h-4 w-4 transition-transform",
                                  isOpen && "rotate-180"
                                )}
                              />
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-1 ml-4 space-y-1">
                            {item.subItems.map((subItem) => {
                              const isActive = location.pathname === subItem.href;
                              const SubIcon = subItem.icon;
                              return (
                                <Link
                                  key={subItem.href}
                                  to={subItem.href}
                                  className={cn(
                                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                                    isActive
                                      ? "bg-primary/10 text-primary font-medium"
                                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                  )}
                                >
                                  <SubIcon className="h-4 w-4" />
                                  {subItem.label}
                                </Link>
                              );
                            })}
                          </CollapsibleContent>
                        </Collapsible>
                      </li>
                    );
                  }
                  
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
