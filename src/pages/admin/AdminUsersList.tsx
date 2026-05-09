import { useEffect, useState } from "react";
import { Plus, Search, Trash2, Ban, CheckCircle, ShieldAlert, Pencil, Eye, EyeOff } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/ui/data-pagination";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const ITEMS_PER_PAGE = 10;

interface AdminUser {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_suspended: boolean;
}

interface FormData {
  full_name: string;
  email: string;
  password: string;
}

interface EditFormData {
  full_name: string;
  email: string;
  password: string;
  phone: string;
}

export default function AdminUsersList() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<FormData>({ full_name: "", email: "", password: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [userToDelete, setUserToDelete] = useState<AdminUser | null>(null);
  const [userToEdit, setUserToEdit] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState<EditFormData>({
    full_name: "",
    email: "",
    password: "",
    phone: "",
  });
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("id, user_id, role")
        .eq("role", "admin");

      if (rolesError) throw rolesError;

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone");

      const usersMap = new Map<string, AdminUser>();
      rolesData?.forEach((role: any) => {
        const profile = profilesData?.find((p) => p.user_id === role.user_id);
        usersMap.set(role.user_id, {
          id: role.id,
          user_id: role.user_id,
          full_name: profile?.full_name || "Sin nombre",
          email: "",
          phone: profile?.phone ?? null,
          is_suspended: false,
        });
      });

      const userIds = Array.from(usersMap.keys());
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
      console.error("Error fetching admins:", error);
      toast.error("Error al cargar los administradores");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleSubmit = async () => {
    if (!formData.full_name || !formData.email || !formData.password) {
      toast.error("Completa todos los campos");
      return;
    }
    if (formData.password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    setIsSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-system-admin", {
        body: {
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Administrador creado correctamente");
      setIsDialogOpen(false);
      setFormData({ full_name: "", email: "", password: "" });
      fetchUsers();
    } catch (error: any) {
      console.error("Error creating admin:", error);
      toast.error(error.message || "Error al crear el administrador");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!userToDelete) return;
    try {
      const { error } = await supabase.functions.invoke("delete-user", {
        body: { user_id: userToDelete.user_id },
      });
      if (error) throw error;
      setUsers(users.filter((u) => u.user_id !== userToDelete.user_id));
      toast.success("Administrador eliminado");
    } catch (error) {
      console.error("Error deleting admin:", error);
      toast.error("Error al eliminar el administrador");
    } finally {
      setUserToDelete(null);
    }
  };

  const openEditDialog = (user: AdminUser) => {
    setUserToEdit(user);
    setEditForm({
      full_name: user.full_name === "Sin nombre" ? "" : user.full_name,
      email: user.email ?? "",
      password: "",
      phone: user.phone ?? "",
    });
  };

  useEffect(() => {
    if (!userToEdit) return;
    let cancelled = false;
    const uid = userToEdit.user_id;

    (async () => {
      const patch: Partial<EditFormData> = {};

      // Siempre refrescar email desde Auth
      try {
        const { data } = await supabase.functions.invoke("get-user-emails", {
          body: { user_ids: [uid] },
        });
        const row = data?.users?.find((u: { id: string }) => u.id === uid);
        if (row?.email) patch.email = row.email;
      } catch (e) {
        console.warn("No se pudo refrescar email:", e);
      }

      // Siempre traer datos frescos del perfil
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("user_id", uid)
        .maybeSingle();

      if (!cancelled && prof) {
        if (prof.full_name) patch.full_name = prof.full_name;
        patch.phone = prof.phone ?? "";
      }

      if (!cancelled && Object.keys(patch).length > 0) {
        setEditForm((f) => ({ ...f, ...patch }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userToEdit]);

  const handleEditSubmit = async () => {
    if (!userToEdit) return;
    if (!editForm.full_name?.trim() || !editForm.email?.trim()) {
      toast.error("Nombre y correo son obligatorios");
      return;
    }
    if (editForm.password.length > 0 && editForm.password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    setIsEditSaving(true);
    try {
      const body: Record<string, unknown> = {
        user_id: userToEdit.user_id,
        full_name: editForm.full_name.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim() || null,
      };
      if (editForm.password.length > 0) {
        body.password = editForm.password;
      }

      const { data, error } = await supabase.functions.invoke("update-system-admin", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Administrador actualizado");
      setUserToEdit(null);
      fetchUsers();
    } catch (error: unknown) {
      console.error("Error updating admin:", error);
      const message = error instanceof Error ? error.message : "Error al actualizar el administrador";
      toast.error(message);
    } finally {
      setIsEditSaving(false);
    }
  };

  const handleSuspendToggle = async (userId: string, suspended: boolean) => {
    try {
      const { data, error } = await supabase.functions.invoke("suspend-user", {
        body: { user_id: userId, suspend: !suspended },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setUsers(users.map((u) => u.user_id === userId ? { ...u, is_suspended: !suspended } : u));
      toast.success(suspended ? "Administrador reactivado" : "Administrador suspendido");
    } catch (error: any) {
      toast.error(error.message || "Error al cambiar el estado");
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.phone && u.phone.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <DashboardLayout>
      <PageHeader
        title="Administradores del Sistema"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Administradores" },
        ]}
      />


      <div className="bg-card rounded-xl shadow-sm border">
        <div className="flex items-center justify-between p-5 border-b">
          <Button onClick={() => setIsDialogOpen(true)} className="shadow-sm">
            <Plus className="h-4 w-4 mr-2" />
            Agregar Administrador
          </Button>

          <div className="flex items-center gap-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-72 bg-muted/50 border-0"
              />
            </div>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8">Cargando...</TableCell></TableRow>
            ) : paginatedUsers.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No hay administradores</TableCell></TableRow>
            ) : (
              paginatedUsers.map((user) => {
                const isSelf = user.user_id === currentUser?.id;
                return (
                  <TableRow key={user.id} className={user.is_suspended ? "opacity-60 bg-muted/30" : ""}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {user.full_name}
                        {isSelf && <Badge variant="outline" className="text-xs">Tú</Badge>}
                        {user.is_suspended && <Badge variant="destructive" className="text-xs">Suspendido</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge className="bg-primary/10 text-primary hover:bg-primary/20 gap-1">
                        <ShieldAlert className="h-3 w-3" /> Administrador
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Editar datos"
                          onClick={() => openEditDialog(user)}
                        >
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          title={user.is_suspended ? "Reactivar" : "Suspender"}
                          onClick={() => handleSuspendToggle(user.user_id, user.is_suspended)}
                          disabled={isSelf}
                        >
                          {user.is_suspended ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <Ban className="h-4 w-4 text-orange-500" />
                          )}
                        </Button>
                        <Button
                          variant="ghost" size="icon" title="Eliminar"
                          onClick={() => setUserToDelete(user)}
                          disabled={isSelf}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {totalPages > 1 && (
          <div className="p-4 border-t">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredUsers.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Administrador del Sistema</DialogTitle>
            <DialogDescription>
              Esta cuenta tendrá acceso completo al sistema, igual que admin@email.com.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre completo</Label>
              <Input
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Ej: Juan Pérez"
              />
            </div>
            <div>
              <Label>Correo electrónico</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="admin@example.com"
              />
            </div>
            <div>
              <Label>Contraseña</Label>
              <div className="relative">
                <Input
                  type={showCreatePassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Mínimo 8 caracteres"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCreatePassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                  aria-label={showCreatePassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showCreatePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? "Creando..." : "Crear Administrador"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar administrador?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente la cuenta de <strong>{userToDelete?.full_name}</strong>. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!userToEdit}
        onOpenChange={(open) => {
          if (!open) setUserToEdit(null);
        }}
      >
        <DialogContent key={userToEdit ? `edit-admin-${userToEdit.user_id}` : "edit-admin-closed"}>
          <DialogHeader>
            <DialogTitle>Editar administrador</DialogTitle>
            <DialogDescription>
              Actualiza nombre, correo, teléfono o contraseña. Deja la contraseña en blanco si no deseas cambiarla.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre completo</Label>
              <Input
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                placeholder="Nombre y apellido"
              />
            </div>
            <div>
              <Label>Correo electrónico</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="admin@example.com"
              />
            </div>
            <div>
              <Label>Teléfono (opcional)</Label>
              <Input
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                placeholder="Opcional"
              />
            </div>
            <div>
              <Label>Nueva contraseña (opcional)</Label>
              <div className="relative">
                <Input
                  type={showEditPassword ? "text" : "password"}
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  placeholder="Mínimo 8 caracteres si cambias"
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowEditPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                  aria-label={showEditPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showEditPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserToEdit(null)}>
              Cancelar
            </Button>
            <Button onClick={handleEditSubmit} disabled={isEditSaving}>
              {isEditSaving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
