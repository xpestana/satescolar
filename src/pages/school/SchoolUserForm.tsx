import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [profiles, setProfiles] = useState<{ id: string; name: string; description: string | null }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

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
    setSaving(true);
    const body = isEdit
      ? { action: "update", user_id: userId, full_name: fullName, profile_ids: Array.from(selected) }
      : { action: "create", email, full_name: fullName, profile_ids: Array.from(selected) };
    const { data, error } = await supabase.functions.invoke("manage-school-subuser", { body });
    setSaving(false);
    if (error || data?.error) {
      toast({ title: "Error", description: data?.error || error?.message, variant: "destructive" });
      return;
    }
    toast({
      title: isEdit ? "Usuario actualizado" : "Usuario creado",
      description: isEdit ? undefined : "Se enviaron las credenciales por correo.",
    });
    navigate("/school/configuraciones/usuarios");
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
    </DashboardLayout>
  );
}
