import { useAuth } from "@/hooks/useAuth";
import { useSchoolData } from "@/hooks/useSchoolData";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User } from "lucide-react";
import logo from "@/assets/logo.svg";

export function TopBar() {
  const { user, signOut, userRole } = useAuth();
  const { school } = useSchoolData();

  const displayLogo = userRole === "school" && school?.logo_url ? school.logo_url : logo;
  const isSchoolLogo = userRole === "school" && !!school?.logo_url;

  const getInitials = (email?: string) => {
    if (!email) return "U";
    return email.charAt(0).toUpperCase();
  };

  const getRoleLabel = (role: string | null) => {
    switch (role) {
      case "admin":
        return "Administrador";
      case "school":
        return "Usuario Escolar";
      case "representative":
        return "Representante";
      default:
        return "Usuario";
    }
  };

  return (
    <header className="fixed top-0 left-0 right-64 z-30 h-16 bg-transparent flex items-center px-6">
      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-[#01051e]">
              <div className="h-10 w-10 rounded-full bg-white p-1 flex items-center justify-center overflow-hidden">
                <img src={displayLogo} alt={isSchoolLogo ? school?.name || "Colegio" : "SAT Escolar"} className={`${isSchoolLogo ? "h-full w-full object-cover rounded-full" : "h-8 w-8 object-contain"}`} />
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64 bg-white">
            <DropdownMenuLabel className="font-normal">
              <div className="flex items-center gap-3 py-2">
                <Avatar className="h-12 w-12">
                  <AvatarImage src="" />
                  <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                    {getInitials(user?.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="font-semibold text-foreground">
                    {user?.email?.split("@")[0] || "Usuario"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {user?.email}
                  </span>
                  <span className="text-xs text-primary font-medium">
                    {getRoleLabel(userRole)}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar Sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
