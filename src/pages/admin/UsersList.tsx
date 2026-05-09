import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Pencil, Trash2, Ban, CheckCircle, LogIn } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/ui/data-pagination";
import { supabase } from "@/integrations/supabase/client";
import { TableSkeleton } from "@/components/ui/loading-skeletons";
import { toast } from "sonner";

const ITEMS_PER_PAGE = 10;

type UserRole = "school" | "teacher" | "representative";

interface SchoolUser {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  school_id: string | null;
  school_name: string | null;
  role: UserRole;
  is_suspended: boolean;
}

interface School {
  id: string;
  name: string;
}

interface UserFormData {
  full_name: string;
  email: string;
  password: string;
  school_id: string;
}

export default function UsersList() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<SchoolUser[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    full_name: "",
    email: "",
    password: "",
    school_id: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isImpersonating, setIsImpersonating] = useState(false);

  const fetchUsers = async () => {
    try {
      // Fetch all non-admin user roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select(`
          id,
          user_id,
          role,
          school_id,
          schools(name)
        `)
        .in("role", ["school", "teacher", "representative"]);

      if (rolesError) throw rolesError;

      // Fetch profiles for user info
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name");

      if (profilesError) throw profilesError;

      const usersMap = new Map<string, SchoolUser>();

      rolesData?.forEach((role: any) => {
        const profile = profilesData?.find((p) => p.user_id === role.user_id);
        usersMap.set(role.user_id, {
          id: role.id,
          user_id: role.user_id,
          full_name: profile?.full_name || "Sin nombre",
          email: "",
          school_id: role.school_id,
          school_name: role.schools?.name || null,
          role: role.role as UserRole,
          is_suspended: false,
        });
      });

      const userIds = Array.from(usersMap.keys());

      // Resolve school names for teachers
      const teacherUserIds = Array.from(usersMap.values())
        .filter((u) => u.role === "teacher")
        .map((u) => u.user_id);
      if (teacherUserIds.length > 0) {
        const { data: teachersData } = await supabase
          .from("teachers")
          .select("user_id, school_id, schools(name)")
          .in("user_id", teacherUserIds);
        teachersData?.forEach((t: any) => {
          const u = usersMap.get(t.user_id);
          if (u && !u.school_name) {
            u.school_id = t.school_id;
            u.school_name = t.schools?.name || null;
          }
        });
      }

      // Resolve school names for representatives (families M2M)
      const repUserIds = Array.from(usersMap.values())
        .filter((u) => u.role === "representative")
        .map((u) => u.user_id);
      if (repUserIds.length > 0) {
        const { data: familiesData } = await supabase
          .from("families")
          .select("id, user_id")
          .in("user_id", repUserIds);
        const familyIds = familiesData?.map((f: any) => f.id) ?? [];
        if (familyIds.length > 0) {
          const { data: famSchools } = await supabase
            .from("family_schools")
            .select("family_id, school_id, schools(name)")
            .in("family_id", familyIds);
          familiesData?.forEach((f: any) => {
            const u = usersMap.get(f.user_id);
            if (!u) return;
            const links = famSchools?.filter((fs: any) => fs.family_id === f.id) ?? [];
            const names = links
              .map((fs: any) => fs.schools?.name)
              .filter(Boolean);
            if (names.length > 0 && !u.school_name) {
              u.school_name = names.join(", ");
              u.school_id = links[0]?.school_id ?? null;
            }
          });
        }
      }

      // Fetch emails from edge function
      if (userIds.length > 0) {
        const { data: emailsData } = await supabase.functions.invoke("get-user-emails", {
          body: { user_ids: userIds },
        });

        if (emailsData?.users) {
          emailsData.users.forEach((u: { id: string; email: string; banned_until: string | null }) => {
            const user = usersMap.get(u.id);
            if (user) {
              user.email = u.email;
              user.is_suspended = u.banned_until ? new Date(u.banned_until) > new Date() : false;
            }
          });
        }
      }

      setUsers(Array.from(usersMap.values()));
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Error al cargar los usuarios");
    } finally {
      setLoading(false);
    }
  };

  const fetchSchools = async () => {
    try {
      const { data, error } = await supabase
        .from("schools")
        .select("id, name")
        .order("name");

      if (error) throw error;
      setSchools(data || []);
    } catch (error) {
      console.error("Error fetching schools:", error);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchSchools();
  }, []);

  const handleOpenDialog = (user?: SchoolUser) => {
    if (user) {
      setIsEditing(true);
      setEditingUserId(user.user_id);
      setFormData({
        full_name: user.full_name,
        email: user.email,
        password: "",
        school_id: user.school_id || "",
      });
    } else {
      setIsEditing(false);
      setEditingUserId(null);
      setFormData({
        full_name: "",
        email: "",
        password: "",
        school_id: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setIsEditing(false);
    setEditingUserId(null);
    setFormData({
      full_name: "",
      email: "",
      password: "",
      school_id: "",
    });
  };

  const handleSubmit = async () => {
    if (!formData.full_name || !formData.email) {
      toast.error("Por favor complete todos los campos requeridos");
      return;
    }

    if (!isEditing && !formData.password) {
      toast.error("La contraseña es requerida para nuevos usuarios");
      return;
    }

    setIsSaving(true);
    try {
      if (isEditing && editingUserId) {
        // Update user profile
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ full_name: formData.full_name })
          .eq("user_id", editingUserId);

        if (profileError) throw profileError;

        // Update school assignment
        const { error: roleError } = await supabase
          .from("user_roles")
          .update({ school_id: formData.school_id || null })
          .eq("user_id", editingUserId)
          .eq("role", "school");

        if (roleError) throw roleError;

        toast.success("Usuario actualizado correctamente");
      } else {
        // Create new user via edge function
        const { data, error } = await supabase.functions.invoke("create-admin-user", {
          body: {
            email: formData.email,
            password: formData.password,
            full_name: formData.full_name,
            role: "school",
            school_id: formData.school_id || null,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        // Update the school assignment if provided
        if (formData.school_id && data?.user?.id) {
          await supabase
            .from("user_roles")
            .update({ school_id: formData.school_id })
            .eq("user_id", data.user.id);
        }

        toast.success("Usuario creado correctamente");
      }

      handleCloseDialog();
      fetchUsers();
    } catch (error: any) {
      console.error("Error saving user:", error);
      toast.error("Error al guardar el usuario");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (userId: string) => {
    try {
      // Delete via edge function (requires admin privileges)
      const { error } = await supabase.functions.invoke("delete-user", {
        body: { user_id: userId },
      });

      if (error) throw error;

      setUsers(users.filter((user) => user.user_id !== userId));
      toast.success("Usuario eliminado correctamente");
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Error al eliminar el usuario");
    }
  };

  const handleSuspendToggle = async (userId: string, currentlySuspended: boolean) => {
    try {
      const { data, error } = await supabase.functions.invoke("suspend-user", {
        body: { user_id: userId, suspend: !currentlySuspended },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setUsers(users.map((user) =>
        user.user_id === userId
          ? { ...user, is_suspended: !currentlySuspended }
          : user
      ));
      
      toast.success(
        currentlySuspended
          ? "Usuario reactivado correctamente"
          : "Usuario suspendido correctamente"
      );
    } catch (error: any) {
      console.error("Error toggling suspension:", error);
      toast.error(error.message || "Error al cambiar el estado del usuario");
    }
  };

  const handleImpersonate = async (userId: string, userName: string, role: UserRole) => {
    if (isImpersonating) return;

    setIsImpersonating(true);
    toast.info(`Iniciando sesión como ${userName}...`);

    try {
      const { data, error } = await supabase.functions.invoke("impersonate-user", {
        body: { user_id: userId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.session) {
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });

        if (sessionError) throw sessionError;
        if (!sessionData.session) throw new Error("No se pudo establecer la sesión");

        const targetRole = (data.role as UserRole) || role;
        const dashboardByRole: Record<UserRole, string> = {
          school: "/school/dashboard",
          teacher: "/teacher/dashboard",
          representative: "/representative/dashboard",
        };
        const redirectTo = dashboardByRole[targetRole] ?? "/login";

        toast.success(`Sesión iniciada como ${userName}`);
        setTimeout(() => {
          window.location.href = redirectTo;
        }, 100);
      } else {
        throw new Error("No se recibió la sesión del servidor");
      }
    } catch (error: any) {
      console.error("Error impersonating user:", error);
      toast.error(error.message || "Error al iniciar sesión como usuario");
      setIsImpersonating(false);
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.school_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
  );

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <DashboardLayout>
      <PageHeader
        title="Usuarios"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Usuarios" },
        ]}
      />


      <div className="bg-card rounded-xl shadow-sm border">
        {/* Toolbar */}
        <div className="flex items-center justify-between p-5 border-b">
          <Button onClick={() => handleOpenDialog()} className="shadow-sm">
            <Plus className="h-4 w-4 mr-2" />
            Agregar Usuario
          </Button>

          <div className="flex items-center gap-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar usuarios..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-72 bg-muted/50 border-0 focus-visible:bg-background focus-visible:ring-1"
              />
            </div>
            <span className="text-sm text-muted-foreground hidden lg:block">
              Lista de Usuarios Registrados
            </span>
          </div>
        </div>

        {/* Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Institución</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton rows={6} columns={5} />
            ) : paginatedUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  {searchTerm
                    ? "No se encontraron usuarios con ese criterio de búsqueda"
                    : "No hay usuarios registrados. ¡Crea el primero!"}
                </TableCell>
              </TableRow>
            ) : (
              paginatedUsers.map((user) => {
                const roleLabel =
                  user.role === "school"
                    ? "Colegio"
                    : user.role === "teacher"
                    ? "Docente"
                    : "Representante";
                const roleBadgeClass =
                  user.role === "school"
                    ? "bg-primary/10 text-primary hover:bg-primary/20"
                    : user.role === "teacher"
                    ? "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20"
                    : "bg-amber-500/10 text-amber-700 hover:bg-amber-500/20";
                return (
                <TableRow key={user.id} className={user.is_suspended ? "opacity-60 bg-muted/30" : ""}>
                  <TableCell className="font-medium max-w-xs truncate">
                    <div className="flex items-center gap-2">
                      {user.full_name}
                      {user.is_suspended && (
                        <Badge variant="destructive" className="text-xs">
                          Suspendido
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge className={roleBadgeClass}>{roleLabel}</Badge>
                  </TableCell>
                  <TableCell>{user.school_name || "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Iniciar sesión como este usuario"
                        onClick={() => handleImpersonate(user.user_id, user.full_name, user.role)}
                        disabled={user.is_suspended || isImpersonating}
                      >
                        <LogIn className="h-4 w-4 text-primary" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title={user.is_suspended ? "Reactivar usuario" : "Suspender usuario"}
                        onClick={() => handleSuspendToggle(user.user_id, user.is_suspended)}
                      >
                        {user.is_suspended ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <Ban className="h-4 w-4 text-orange-500" />
                        )}
                      </Button>
                      {user.role === "school" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Editar"
                        onClick={() => handleOpenDialog(user)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" title="Eliminar">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción no se puede deshacer. Se eliminará permanentemente
                              el usuario "{user.full_name}" y todos sus datos asociados.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(user.user_id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={filteredUsers.length}
          itemsPerPage={ITEMS_PER_PAGE}
        />
      </div>

      {/* User Form Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="bg-primary text-primary-foreground -m-6 mb-0 p-4 rounded-t-lg">
              {isEditing ? "Editar Usuario" : "Nuevo Usuario"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Nombre del usuario</Label>
                <Input
                  id="full_name"
                  placeholder="Nombre del usuario"
                  value={formData.full_name}
                  onChange={(e) =>
                    setFormData({ ...formData, full_name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico del usuario</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Correo electrónico del usuario"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  disabled={isEditing}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="school_id">Institución</Label>
                <Select
                  value={formData.school_id || "__none__"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, school_id: value === "__none__" ? "" : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar institución" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin asignar</SelectItem>
                    {schools.map((school) => (
                      <SelectItem key={school.id} value={school.id}>
                        {school.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">
                  Contraseña {isEditing && "(dejar vacío para mantener)"}
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Contraseña"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
