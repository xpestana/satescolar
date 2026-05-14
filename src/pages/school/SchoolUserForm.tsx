import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Copy, Eye, EyeOff, RefreshCw } from "lucide-react";

function generateRandomPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const arr = new Uint8Array(12);
  crypto.getRandomValues(arr);
  let p = "";
  for (let i = 0; i < 12; i++) p += chars[arr[i] % chars.length];
  return p;
}
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useToast } from "@/hooks/use-toast";

export default function SchoolUserForm() {
  const { userId } = useParams<{ userId?: string }>();
  const isEdit = !!userId;
  const navigate = useNavigate();
  const { schoolId } = useSchoolId();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [profiles, setProfiles] = useState<{ id: string; name: string; description: string | null }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string } | null>(null);

  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      const { data } = await supabase.from("permission_profiles").select("id, name, description").eq("school_id", schoolId).order("name");
      setProfiles(data ?? []);
      if (isEdit && userId) {
        const { data: assigns } = await supabase.from("school_user_profiles").select("profile_id").eq("user_id", userId).eq("school_id", schoolId);
        setSelected(new Set((assigns ?? []).map((a: any) => a.profile_id)));
        const { data: emailData } = await supabase.functions.invoke("get-user-emails", { body: { user_ids: [userId] } });
        const u = emailData?.users?.[0];
        if (u) { setEmail(u.email ?? ""); setFullName(u.user_metadata?.full_name ?? ""); }
      }
    })();
  }, [schoolId, userId, isEdit]);

  const toggle = (id: string) => {
    setSelected((s) => {
      const ns = new Set(s);
      if (ns.has(id)) ns.delete(id); else ns.add(id);
      return ns;
    });
  };

  const handleSubmit = async () => {
    if (!isEdit && (!email || !fullName)) {
      toast({ title: "Completa los campos requeridos", variant: "destructive" });
      return;
    }
    if (!isEdit && password && password.length < 8) {
      toast({ title: "La contraseña debe tener al menos 8 caracteres", variant: "destructive" });
      return;
    }
    setSaving(true);
    const body = isEdit
      ? { action: "update", user_id: userId, full_name: fullName, profile_ids: Array.from(selected) }
      : { action: "create", email, full_name: fullName, profile_ids: Array.from(selected), password: password || undefined };
    const { data, error } = await supabase.functions.invoke("manage-school-subuser", { body });
    setSaving(false);
    if (error || data?.error) {
      toast({ title: "Error", description: data?.error || error?.message, variant: "destructive" });
      return;
    }
    if (!isEdit && data?.password) {
      setCreatedCreds({ email, password: data.password });
      return;
    }
    toast({ title: isEdit ? "Usuario actualizado" : "Usuario creado" });
    navigate("/school/configuraciones/usuarios");
  };

  const copyCreds = async () => {
    if (!createdCreds) return;
    const text = `Usuario: ${createdCreds.email}\nContraseña: ${createdCreds.password}`;
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Credenciales copiadas" });
    } catch {
      toast({ title: "No se pudo copiar", variant: "destructive" });
    }
  };

  const copyPassword = async () => {
    if (!createdCreds) return;
    try {
      await navigator.clipboard.writeText(createdCreds.password);
      toast({ title: "Contraseña copiada" });
    } catch {
      toast({ title: "No se pudo copiar", variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title={isEdit ? "Editar Usuario" : "Nuevo Usuario Escolar"}
        breadcrumbs={[
          { label: "Ajustes del Colegio" },
          { label: "Usuarios", href: "/school/configuraciones/usuarios" },
          { label: isEdit ? "Editar" : "Nuevo" },
        ]}
      />

      <div className="grid gap-6 max-w-3xl">
        <Card className="p-6 space-y-4">
          <div>
            <Label>Nombre completo *</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <Label>Correo electrónico {isEdit && "(no editable)"}</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isEdit} />
          </div>
          {!isEdit && (
            <div>
              <Label>Contraseña (opcional)</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Déjalo vacío para generar una automáticamente"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Mínimo 8 caracteres. Si la dejas vacía se generará una segura.</p>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-2">Perfiles de Permiso</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Asigna uno o más perfiles. El usuario tendrá la suma de los permisos de cada perfil.
          </p>
          {profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no hay perfiles. <a href="/school/configuraciones/usuarios/perfiles/nuevo" className="text-primary underline">Crear uno</a>.
            </p>
          ) : (
            <div className="space-y-2">
              {profiles.map((p) => (
                <label key={p.id} className="flex items-start gap-3 p-3 border rounded-md cursor-pointer hover:bg-muted/40">
                  <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} />
                  <div>
                    <p className="font-medium">{p.name}</p>
                    {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
                  </div>
                </label>
              ))}
            </div>
          )}
        </Card>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => window.history.back()}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear usuario"}
          </Button>
        </div>
      </div>

      <Dialog
        open={!!createdCreds}
        onOpenChange={(open) => {
          if (!open) {
            setCreatedCreds(null);
            navigate("/school/configuraciones/usuarios");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Usuario creado</DialogTitle>
            <DialogDescription>
              Copia las credenciales ahora. También se enviaron por correo, pero no podrás volver a verlas aquí.
            </DialogDescription>
          </DialogHeader>
          {createdCreds && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Usuario</Label>
                <Input readOnly value={createdCreds.email} />
              </div>
              <div>
                <Label className="text-xs">Contraseña</Label>
                <div className="flex gap-2">
                  <Input readOnly value={createdCreds.password} className="font-mono" />
                  <Button type="button" variant="outline" size="icon" onClick={copyPassword}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={copyCreds}>
              <Copy className="h-4 w-4 mr-2" /> Copiar usuario y contraseña
            </Button>
            <Button
              onClick={() => {
                setCreatedCreds(null);
                navigate("/school/configuraciones/usuarios");
              }}
            >
              Listo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
