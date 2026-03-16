import { useState, useRef, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  UsersRound,
  CreditCard,
  Settings,
  Wrench,
  LogOut,
  SlidersHorizontal,
  FileText,
  Search,
  BookOpen,
  Home as HomeIcon,
  ClipboardCheck,
  Mail,
  LinkIcon,
  Menu,
  PanelRightClose,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useSchoolData } from "@/hooks/useSchoolData";
import { useRepresentativeFamily } from "@/hooks/useRepresentativeFamily";
import { useSidebarState } from "@/hooks/useSidebarState";
import logo from "@/assets/logo.svg";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  requiredRole?: "admin" | "school" | "representative" | "teacher";
}

interface NavSection {
  title?: string;
  items: NavItem[];
  requiredRole?: "admin" | "school" | "representative" | "teacher";
}

const navSections: NavSection[] = [
  {
    requiredRole: "admin",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, requiredRole: "admin" },
    ],
  },
  {
    title: "Registros Admin",
    requiredRole: "admin",
    items: [
      { label: "Usuarios", href: "/admin/usuarios", icon: Users, requiredRole: "admin" },
      { label: "Colegios", href: "/admin/colegios", icon: GraduationCap, requiredRole: "admin" },
      { label: "Enviar Email", href: "/admin/enviar-email", icon: Mail, requiredRole: "admin" },
    ],
  },
  {
    requiredRole: "school",
    items: [
      { label: "Inicio", href: "/school/dashboard", icon: LayoutDashboard, requiredRole: "school" },
    ],
  },
  {
    title: "Registros",
    requiredRole: "school",
    items: [
      { label: "Familias", href: "/registros/familias", icon: UsersRound, requiredRole: "school" },
      { label: "Docentes", href: "/registros/docentes", icon: BookOpen, requiredRole: "school" },
      { label: "Áreas", href: "/registros/areas", icon: GraduationCap, requiredRole: "school" },
      { label: "Asignación de Áreas", href: "/registros/asignacion-areas", icon: LinkIcon, requiredRole: "school" },
      { label: "Búsqueda Avanzada", href: "/registros/busqueda-avanzada", icon: Search, requiredRole: "school" },
    ],
  },
  {
    title: "Utilidades",
    requiredRole: "school",
    items: [
      { label: "Gestión de Correos", href: "/utilidades/correo", icon: Mail, requiredRole: "school" },
    ],
  },
  {
    title: "Inscripciones",
    requiredRole: "school",
    items: [
      { label: "Inscripciones", href: "/inscripciones", icon: ClipboardCheck, requiredRole: "school" },
    ],
  },
  {
    title: "Notas y Boletas",
    requiredRole: "school",
    items: [
      { label: "Consulta de Notas y Boletas", href: "/notas/consulta", icon: Search, requiredRole: "school" },
    ],
  },
  {
    title: "Administrativo",
    requiredRole: "school",
    items: [
      { label: "Pagos", href: "/admin/pagos", icon: CreditCard, requiredRole: "school" },
    ],
  },
  {
    title: "Ajustes del Colegio",
    requiredRole: "school",
    items: [
      { label: "Años y Secciones", href: "/school/configuraciones/anos-secciones", icon: SlidersHorizontal, requiredRole: "school" },
      { label: "Formularios", href: "/school/configuraciones/formularios", icon: FileText, requiredRole: "school" },
      { label: "Planillas", href: "/school/configuraciones/inscripcion-campos", icon: ClipboardCheck, requiredRole: "school" },
      { label: "Notas", href: "/school/configuraciones/ajustes-notas", icon: GraduationCap, requiredRole: "school" },
      { label: "Carnet", href: "/school/configuraciones/utilidades", icon: Wrench, requiredRole: "school" },
    ],
  },
  // Representative
  {
    requiredRole: "representative",
    items: [
      { label: "Inicio", href: "/representative/dashboard", icon: LayoutDashboard, requiredRole: "representative" },
    ],
  },
  {
    title: "Mi Familia",
    requiredRole: "representative",
    items: [
      { label: "Representantes", href: "/representative/representantes", icon: Users, requiredRole: "representative" },
      { label: "Estudiantes", href: "/representative/estudiantes", icon: GraduationCap, requiredRole: "representative" },
      { label: "Datos", href: "/representative/datos-familia", icon: HomeIcon, requiredRole: "representative" },
    ],
  },
  // Teacher
  {
    requiredRole: "teacher",
    items: [
      { label: "Inicio", href: "/teacher/dashboard", icon: LayoutDashboard, requiredRole: "teacher" },
    ],
  },
  {
    title: "Académica",
    requiredRole: "teacher",
    items: [
      { label: "Materias", href: "/teacher/materias", icon: BookOpen, requiredRole: "teacher" },
      { label: "Carnet", href: "/teacher/carnet", icon: CreditCard, requiredRole: "teacher" },
    ],
  },
];

export function AppSidebar() {
  const location = useLocation();
  const { user, signOut, userRole } = useAuth();
  const { school } = useSchoolData();
  const { familyName } = useRepresentativeFamily();

  const { collapsed, hovering, toggleCollapsed, setHovering } = useSidebarState();
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(() => {
    if (!collapsed) return;
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHovering(true);
  }, [collapsed, setHovering]);

  const handleMouseLeave = useCallback(() => {
    if (!collapsed) return;
    hoverTimeoutRef.current = setTimeout(() => setHovering(false), 300);
  }, [collapsed, setHovering]);

  const handleEdgeEnter = useCallback(() => {
    if (!collapsed) return;
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHovering(true);
  }, [collapsed, setHovering]);

  const getInitials = (email?: string) => {
    if (!email) return "U";
    return email.charAt(0).toUpperCase();
  };

  const getRoleLabel = (role: string | null) => {
    switch (role) {
      case "admin": return "Admin";
      case "school": return "Escolar";
      case "representative": return "Representante";
      case "teacher": return "Docente";
      default: return "Usuario";
    }
  };

  return (
    <>
      {collapsed && !hovering && (
        <div
          className="fixed right-0 top-0 z-40 h-screen w-4 cursor-pointer"
          onMouseEnter={handleEdgeEnter}
        />
      )}

      <aside
        className={cn(
          "fixed right-0 top-0 z-40 flex h-screen w-80 flex-col transition-transform duration-300 ease-in-out",
          collapsed && !hovering && "translate-x-full"
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={collapsed && hovering ? { boxShadow: "-4px 0 24px rgba(0,0,0,0.15)" } : undefined}
      >
        {/* Logo Section */}
        <div className="flex items-center justify-between py-6 px-4 bg-[#01051e]">
          <img src={logo} alt="SAT Escolar" className="h-28 mx-auto" />
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapsed}
            className="absolute top-3 left-3 text-white/70 hover:text-white hover:bg-white/10"
            title={collapsed ? "Fijar menú" : "Ocultar menú"}
          >
            {collapsed ? <Menu className="h-5 w-5" /> : <PanelRightClose className="h-5 w-5" />}
          </Button>
        </div>

        {/* Navigation - Grid Layout */}
        <nav className="flex-1 overflow-y-auto px-4 py-4 bg-white border-l border-border">
          {navSections.map((section, sectionIndex) => {
            if (section.requiredRole && userRole !== section.requiredRole) return null;

            const visibleItems = section.items.filter(
              (item) => !item.requiredRole || item.requiredRole === userRole
            );
            if (visibleItems.length === 0 && !section.title) return null;

            // Check if this is the first visible section for this role
            const previousSections = navSections.slice(0, sectionIndex);
            const hasPreviousVisible = previousSections.some(
              (s) => (!s.requiredRole || s.requiredRole === userRole) && s.items.some((i) => !i.requiredRole || i.requiredRole === userRole)
            );

            return (
              <div key={sectionIndex}>
                {hasPreviousVisible && (
                  <div className="border-t border-border my-3" />
                )}
                {section.title && (
                  <h3 className="mb-2 text-xs font-bold text-foreground">
                    {section.title}
                  </h3>
                )}
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                  {visibleItems.map((item) => {
                    const isActive = location.pathname === item.href;
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        className={cn(
                          "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                          isActive
                            ? "text-primary font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        <span className="leading-tight line-clamp-2" style={{ fontSize: "14.5px" }}>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* User Card */}
        <div className="bg-[#01051e] p-4 border-l border-border">
          <div className="flex items-center gap-3">
            {userRole === "school" && school?.logo_url ? (
              <div className="h-10 w-10 rounded-full overflow-hidden border-2 border-primary bg-white flex-shrink-0">
                <img src={school.logo_url} alt={school.name || "Colegio"} className="h-full w-full object-cover" />
              </div>
            ) : (
              <Avatar className="h-10 w-10 border-2 border-primary">
                <AvatarImage src="" />
                <AvatarFallback className="bg-primary/20 text-primary-foreground text-sm font-medium">
                  {getInitials(user?.email)}
                </AvatarFallback>
              </Avatar>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {userRole === "school" && school?.name ? school.name : userRole === "representative" ? `Familia ${familyName}` : "Colegio"}
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
    </>
  );
}
