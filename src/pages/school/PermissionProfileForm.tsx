import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useToast } from "@/hooks/use-toast";

interface PermKey {
  key: string;
  module: string;
  label: string;
  supports_scope: boolean;
}

interface SchoolYear { id: string; name: string; }

const GRADE_LEVELS = [
  "I Nivel", "II Nivel", "III Nivel",
  "1er Grado", "2do Grado", "3er Grado", "4to Grado", "5to Grado", "6to Grado",
  "1er Año", "2do Año", "3er Año", "4to Año", "5to Año", "6to Año",
];

interface ItemState {
  enabled: boolean;
  grade_levels: string[];
  school_year_ids: string[];
}

export default function PermissionProfileForm() {
  const { profileId } = useParams<{ profileId?: string }>();
  const isEdit = !!profileId;
  const navigate = useNavigate();
  const { schoolId } = useSchoolId();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [keys, setKeys] = useState<PermKey[]>([]);
  const [years, setYears] = useState<SchoolYear[]>([]);
  const [items, setItems] = useState<Record<string, ItemState>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: pk } = await supabase.from("permission_keys").select("*").order("display_order");
      setKeys(pk ?? []);
      const initial: Record<string, ItemState> = {};
      (pk ?? []).forEach((k: any) => { initial[k.key] = { enabled: false, grade_levels: [], school_year_ids: [] }; });
      setItems(initial);

      if (schoolId) {
        const { data: sy } = await supabase.from("school_years").select("id, name").eq("school_id", schoolId).order("start_date", { ascending: false });
        setYears(sy ?? []);
      }

      if (isEdit && profileId) {
        const { data: p } = await supabase.from("permission_profiles").select("name, description").eq("id", profileId).single();
        if (p) { setName(p.name); setDescription(p.description ?? ""); }
        const { data: itemsData } = await supabase.from("permission_profile_items").select("permission_key, scope").eq("profile_id", profileId);
        setItems((prev) => {
          const next = { ...prev };
          for (const it of (itemsData ?? []) as any[]) {
            next[it.permission_key] = {
              enabled: true,
              grade_levels: it.scope?.grade_levels ?? [],
              school_year_ids: it.scope?.school_year_ids ?? [],
            };
          }
          return next;
        });
      }
    })();
  }, [schoolId, profileId, isEdit]);

  const grouped = keys.reduce<Record<string, PermKey[]>>((acc, k) => {
    (acc[k.module] ||= []).push(k); return acc;
  }, {});

  const toggleKey = (key: string) => {
    setItems((s) => ({ ...s, [key]: { ...s[key], enabled: !s[key]?.enabled } }));
  };

  const toggleGrade = (key: string, grade: string) => {
    setItems((s) => {
      const cur = s[key];
      const arr = cur.grade_levels.includes(grade) ? cur.grade_levels.filter((g) => g !== grade) : [...cur.grade_levels, grade];
      return { ...s, [key]: { ...cur, grade_levels: arr } };
    });
  };

  const toggleYear = (key: string, yearId: string) => {
    setItems((s) => {
      const cur = s[key];
      const arr = cur.school_year_ids.includes(yearId) ? cur.school_year_ids.filter((y) => y !== yearId) : [...cur.school_year_ids, yearId];
      return { ...s, [key]: { ...cur, school_year_ids: arr } };
    });
  };

  const handleSave = async () => {
    if (!name.trim() || !schoolId) {
      toast({ title: "El nombre es requerido", variant: "destructive" });
      return;
    }
    setSaving(true);

    let pid = profileId;
    if (isEdit) {
      const { error } = await supabase.from("permission_profiles").update({ name, description }).eq("id", profileId!);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); setSaving(false); return; }
      await supabase.from("permission_profile_items").delete().eq("profile_id", profileId!);
    } else {
      const { data, error } = await supabase.from("permission_profiles").insert({ school_id: schoolId, name, description }).select("id").single();
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); setSaving(false); return; }
      pid = data.id;
    }

    const inserts = Object.entries(items)
      .filter(([_, v]) => v.enabled)
      .map(([k, v]) => {
        const meta = keys.find((kk) => kk.key === k);
        const scope = meta?.supports_scope && (v.grade_levels.length || v.school_year_ids.length)
          ? { grade_levels: v.grade_levels, school_year_ids: v.school_year_ids }
          : null;
        return { profile_id: pid!, permission_key: k, scope };
      });

    if (inserts.length > 0) {
      const { error } = await supabase.from("permission_profile_items").insert(inserts);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); setSaving(false); return; }
    }

    setSaving(false);
    toast({ title: isEdit ? "Perfil actualizado" : "Perfil creado" });
    navigate("/school/configuraciones/usuarios");
  };

  return (
    <DashboardLayout>
      <PageHeader
        title={isEdit ? "Editar Perfil" : "Nuevo Perfil de Permiso"}
        breadcrumbs={[
          { label: "Ajustes del Colegio" },
          { label: "Usuarios y Permisos", href: "/school/configuraciones/usuarios" },
          { label: isEdit ? "Editar Perfil" : "Nuevo Perfil" },
        ]}
      />

      <div className="grid gap-6 max-w-4xl">
        <Card className="p-6 space-y-4">
          <div>
            <Label>Nombre del perfil *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Coordinador 1er Grado" />
          </div>
          <div>
            <Label>Descripción</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-1">Permisos</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Marca lo que el usuario podrá hacer. Los permisos con <Badge variant="outline">scope</Badge> permiten restringir por grado y/o año escolar.
          </p>

          <div className="space-y-6">
            {Object.entries(grouped).map(([mod, list]) => (
              <div key={mod}>
                <h4 className="text-sm font-bold uppercase text-muted-foreground mb-2">{mod}</h4>
                <div className="space-y-2">
                  {list.map((k) => {
                    const it = items[k.key] ?? { enabled: false, grade_levels: [], school_year_ids: [] };
                    return (
                      <div key={k.key} className="border rounded-md">
                        <label className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/40">
                          <Checkbox checked={it.enabled} onCheckedChange={() => toggleKey(k.key)} />
                          <span className="flex-1">{k.label}</span>
                          {k.supports_scope && <Badge variant="outline" className="text-xs">scope</Badge>}
                        </label>
                        {it.enabled && k.supports_scope && (
                          <div className="border-t bg-muted/20 p-3 space-y-3">
                            <div>
                              <p className="text-xs font-medium mb-1.5">Restringir a grados (vacío = todos):</p>
                              <div className="flex flex-wrap gap-1.5">
                                {GRADE_LEVELS.map((g) => (
                                  <button type="button" key={g} onClick={() => toggleGrade(k.key, g)}
                                    className={`text-xs px-2 py-1 rounded border ${it.grade_levels.includes(g) ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}>
                                    {g}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-medium mb-1.5">Restringir a años escolares (vacío = todos):</p>
                              <div className="flex flex-wrap gap-1.5">
                                {years.map((y) => (
                                  <button type="button" key={y.id} onClick={() => toggleYear(k.key, y.id)}
                                    className={`text-xs px-2 py-1 rounded border ${it.school_year_ids.includes(y.id) ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}>
                                    {y.name}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => window.history.back()}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Guardando..." : "Guardar Perfil"}</Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
