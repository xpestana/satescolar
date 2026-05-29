import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Plus, KeyRound, Pencil, Trash2, ShieldCheck, Users, RefreshCw, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function generateRandomPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const arr = new Uint8Array(12);
  crypto.getRandomValues(arr);
  let p = "";
  for (let i = 0; i < 12; i++) p += chars[arr[i] % chars.length];
  return p;
}

interface SubUser {
  user_id: string;
  email: string;
  full_name: string;
  is_owner: boolean;
  profiles: { id: string; name: string }[];
}

interface ProfileRow {
  id: string;
  name: string;
  description: string | null;
  user_count: number;
  permission_count: number;
}

export default function SchoolUsersList() {
  const navigate = useNavigate();
  const { isOwner, has, loading: permLoading } = usePermissions();
  const { schoolId, isLoading: schoolIdLoading } = useSchoolId();
  const { toast } = useToast();

  const [users, setUsers] = useState<SubUser[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<SubUser | null>(null);
  const [confirmDeleteProfile, setConfirmDeleteProfile] = useState<ProfileRow | null>(null);
  const [resetTarget, setResetTarget] = useState<SubUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!permLoading && !isOwner && !has("settings.users")) navigate("/school/dashboard");
  }, [permLoading, isOwner, has, navigate]);

  const loadData = async () => {
    if (!schoolId) return;
    setLoading(true);

    // Todos los usuarios escolares del colegio: dueños (acceso total) y sub-usuarios con perfiles.
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, is_owner")
      .eq("school_id", schoolId)
      .eq("role", "school");

    const userIds = (roles ?? []).map((r: any) => r.user_id);
    const ownerById = new Map<string, boolean>((roles ?? []).map((r: any) => [r.user_id, !!r.is_owner]));

    // Get emails via edge function
    let emails: Record<string, { email: string; full_name: string }> = {};
    if (userIds.length > 0) {
      const { data: emailData } = await supabase.functions.invoke("get-user-emails", {
        body: { user_ids: userIds },
      });
      if (emailData?.users) {
        for (const u of emailData.users) {
          emails[u.id] = { email: u.email ?? "", full_name: u.user_metadata?.full_name ?? "" };
        }
      }
    }

    // Profile assignments
    const { data: assigns } = await supabase
      .from("school_user_profiles")
      .select("user_id, profile_id, permission_profiles(id, name)")
      .eq("school_id", schoolId);

    const userProfiles = new Map<string, { id: string; name: string }[]>();
    for (const a of (assigns ?? []) as any[]) {
      const arr = userProfiles.get(a.user_id) ?? [];
      if (a.permission_profiles) arr.push({ id: a.permission_profiles.id, name: a.permission_profiles.name });
      userProfiles.set(a.user_id, arr);
    }

    setUsers(
      userIds.map((uid) => ({
        user_id: uid,
        email: emails[uid]?.email ?? "—",
        full_name: emails[uid]?.full_name ?? "—",
        is_owner: ownerById.get(uid) ?? false,
        profiles: userProfiles.get(uid) ?? [],
      }))
    );

    // Profiles
    const { data: profs } = await supabase
      .from("permission_profiles")
      .select("id, name, description")
      .eq("school_id", schoolId)
      .order("name");

    const profIds = (profs ?? []).map((p: any) => p.id);
    const userCounts: Record<string, number> = {};
    const permCounts: Record<string, number> = {};
    for (const a of (assigns ?? []) as any[]) {
      userCounts[a.profile_id] = (userCounts[a.profile_id] ?? 0) + 1;
    }
    if (profIds.length > 0) {
      const { data: items } = await supabase
        .from("permission_profile_items")
        .select("profile_id")
        .in("profile_id", profIds);
      for (const i of (items ?? []) as any[]) {
        permCounts[i.profile_id] = (permCounts[i.profile_id] ?? 0) + 1;
      }
    }

    setProfiles(
      (profs ?? []).map((p: any) => ({
        id: p.id, name: p.name, description: p.description,
        user_count: userCounts[p.id] ?? 0,
        permission_count: permCounts[p.id] ?? 0,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    if (schoolIdLoading) return;
    if (!schoolId) {
      setUsers([]);
      setProfiles([]);
      setLoading(false);
      return;
    }
    loadData();
  }, [schoolId, schoolIdLoading]);

  const openResetDialog = (u: SubUser) => {
    setResetTarget(u);
    setResetPassword(generateRandomPassword());
    setShowResetPassword(true);
  };

  const handleConfirmReset = async () => {
    if (!resetTarget || !resetPassword) return;
    if (resetPassword.length < 8) {
      toast({ title: "La contraseña debe tener al menos 8 caracteres", variant: "destructive" });
      return;
    }
    setResetting(true);
    const { data, error } = await supabase.functions.invoke("manage-school-subuser", {
      body: { action: "reset_password", user_id: resetTarget.user_id, password: resetPassword },
    });
    setResetting(false);
    if (error || data?.error) {
      toast({ title: "Error", description: data?.error || error?.message, variant: "destructive" });
      return;
    }
    toast({ title: "Contraseña actualizada", description: "Se envió la nueva contraseña al correo del usuario." });
    setResetTarget(null);
    setResetPassword("");
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const { data, error } = await supabase.functions.invoke("manage-school-subuser", {
      body: { action: "delete", user_id: confirmDelete.user_id },
    });
    if (error || data?.error) {
      toast({ title: "Error", description: data?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: "Usuario eliminado" });
      loadData();
    }
    setConfirmDelete(null);
  };

  const handleDeleteProfile = async () => {
    if (!confirmDeleteProfile) return;
    const { error } = await supabase.from("permission_profiles").delete().eq("id", confirmDeleteProfile.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Perfil eliminado" }); loadData(); }
    setConfirmDeleteProfile(null);
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Usuarios y Permisos"
        breadcrumbs={[
          { label: "Ajustes del Colegio" },
          { label: "Usuarios y Permisos" },
        ]}
      />

      <Tabs defaultValue="users" className="w-full">
        <TabsList>
          <TabsTrigger value="users"><Users className="h-4 w-4 mr-2" />Usuarios</TabsTrigger>
          <TabsTrigger value="profiles"><ShieldCheck className="h-4 w-4 mr-2" />Perfiles de Permiso</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <Card className="p-4">
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-muted-foreground">
                Lista de usuarios con rol escolar en tu colegio: administradores (acceso completo) y usuarios con perfiles de permiso.
              </p>
              <Button onClick={() => navigate("/school/configuraciones/usuarios/nuevo")}>
                <Plus className="h-4 w-4 mr-2" />Nuevo Usuario
              </Button>
            </div>

            {loading ? (
              <p className="py-8 text-center text-muted-foreground">Cargando...</p>
            ) : users.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">Aún no hay usuarios escolares creados.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Correo</TableHead>
                    <TableHead>Permisos</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.user_id}>
                      <TableCell className="font-medium">{u.full_name}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 items-center">
                          {u.is_owner ? (
                            <Badge variant="default">Administrador (acceso completo)</Badge>
                          ) : (
                            <>
                              {u.profiles.length === 0 && (
                                <span className="text-xs text-muted-foreground">Sin perfiles asignados</span>
                              )}
                              {u.profiles.map((p) => (
                                <Badge key={p.id} variant="secondary">{p.name}</Badge>
                              ))}
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          title={u.is_owner ? "Los administradores del colegio no se editan desde aquí" : "Editar"}
                          disabled={u.is_owner}
                          onClick={() => navigate(`/school/configuraciones/usuarios/${u.user_id}/editar`)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title={u.is_owner ? "No disponible para administradores del colegio" : "Cambiar contraseña"}
                          disabled={u.is_owner}
                          onClick={() => openResetDialog(u)}
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        {isOwner && (
                          <Button
                            size="icon"
                            variant="ghost"
                            title={u.is_owner ? "No se puede eliminar un administrador del colegio desde aquí" : "Eliminar"}
                            disabled={u.is_owner}
                            onClick={() => setConfirmDelete(u)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="profiles" className="mt-4">
          <Card className="p-4">
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-muted-foreground">
                Perfiles de permiso reutilizables. Define qué áreas y funciones puede usar cada perfil.
              </p>
              <Button onClick={() => navigate("/school/configuraciones/usuarios/perfiles/nuevo")}>
                <Plus className="h-4 w-4 mr-2" />Nuevo Perfil
              </Button>
            </div>

            {profiles.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">Aún no hay perfiles creados.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-center">Permisos</TableHead>
                    <TableHead className="text-center">Usuarios</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.description || "—"}</TableCell>
                      <TableCell className="text-center">{p.permission_count}</TableCell>
                      <TableCell className="text-center">{p.user_count}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="icon" variant="ghost"
                          onClick={() => navigate(`/school/configuraciones/usuarios/perfiles/${p.id}/editar`)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setConfirmDeleteProfile(p)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el acceso de <strong>{confirmDelete?.email}</strong>. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!resetTarget}
        onOpenChange={(o) => { if (!o) { setResetTarget(null); setResetPassword(""); } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar contraseña</DialogTitle>
            <DialogDescription>
              Establece una nueva contraseña para <strong>{resetTarget?.email || resetTarget?.full_name}</strong>. Se enviará por correo al guardar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Nueva contraseña</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showResetPassword ? "text" : "password"}
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="pr-20"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    type="button"
                    title="Generar contraseña aleatoria"
                    onClick={() => { setResetPassword(generateRandomPassword()); setShowResetPassword(true); }}
                    className="text-muted-foreground hover:text-foreground p-1"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title={showResetPassword ? "Ocultar" : "Mostrar"}
                    onClick={() => setShowResetPassword((v) => !v)}
                    className="text-muted-foreground hover:text-foreground p-1"
                  >
                    {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Mínimo 8 caracteres. Usa el icono <RefreshCw className="inline h-3 w-3" /> para generar una contraseña segura.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetTarget(null); setResetPassword(""); }}>Cancelar</Button>
            <Button onClick={handleConfirmReset} disabled={resetting || resetPassword.length < 8}>
              {resetting ? "Guardando..." : "Guardar y enviar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDeleteProfile} onOpenChange={(o) => !o && setConfirmDeleteProfile(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar perfil?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>{confirmDeleteProfile?.name}</strong> y se desasignará de los usuarios que lo tenían.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProfile}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
