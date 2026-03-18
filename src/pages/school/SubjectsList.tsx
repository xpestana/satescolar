import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Ban, CheckCircle, Loader2, BookOpen } from "lucide-react";

interface Subject {
  id: string;
  school_id: string;
  name: string;
  subject_type: string;
  show_in_report_card: boolean;
  show_in_planilla: boolean;
  evaluation_type: string;
  is_suspended: boolean;
  display_order: number;
}

interface SubjectForm {
  name: string;
  abbreviation: string;
  subject_type: "regular" | "gcrp";
  show_in_report_card: boolean;
  show_in_planilla: boolean;
  evaluation_type: "numeric" | "literal";
}

const defaultForm: SubjectForm = {
  name: "",
  abbreviation: "",
  subject_type: "regular",
  show_in_report_card: true,
  show_in_planilla: true,
  evaluation_type: "numeric",
};

export default function SubjectsList() {
  const { schoolId, isLoading: schoolLoading } = useSchoolId();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SubjectForm>(defaultForm);
  const [filterSuspended, setFilterSuspended] = useState(false);

  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ["school-subjects", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_subjects" as any)
        .select("*")
        .eq("school_id", schoolId!)
        .order("display_order")
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as Subject[];
    },
    enabled: !!schoolId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("El nombre es obligatorio");

      if (editingId) {
        const { error } = await supabase
          .from("school_subjects" as any)
          .update({
            name: form.name.trim(),
            abbreviation: form.abbreviation.trim(),
            subject_type: form.subject_type,
            show_in_report_card: form.show_in_report_card,
            show_in_planilla: form.show_in_planilla,
            evaluation_type: form.evaluation_type,
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const maxOrder = subjects.length > 0 ? Math.max(...subjects.map((s) => s.display_order)) + 1 : 0;
        const { error } = await supabase
          .from("school_subjects" as any)
          .insert({
            school_id: schoolId,
            name: form.name.trim(),
            abbreviation: form.abbreviation.trim(),
            subject_type: form.subject_type,
            show_in_report_card: form.show_in_report_card,
            show_in_planilla: form.show_in_planilla,
            evaluation_type: form.evaluation_type,
            display_order: maxOrder,
          } as any);
        if (error) {
          if (error.code === "23505") throw new Error("Ya existe un área con ese nombre");
          throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school-subjects", schoolId] });
      toast({ title: editingId ? "Actualizado" : "Creado", description: `Área ${editingId ? "actualizada" : "creada"} exitosamente` });
      closeDialog();
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Error", description: err.message || "No se pudo guardar" });
    },
  });

  const toggleSuspendMutation = useMutation({
    mutationFn: async ({ id, suspend }: { id: string; suspend: boolean }) => {
      const { error } = await supabase
        .from("school_subjects" as any)
        .update({ is_suspended: suspend, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { suspend }) => {
      queryClient.invalidateQueries({ queryKey: ["school-subjects", schoolId] });
      toast({ title: suspend ? "Suspendida" : "Activada", description: `Área ${suspend ? "suspendida" : "activada"} exitosamente` });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "No se pudo cambiar el estado" });
    },
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEdit = (subject: Subject) => {
    setEditingId(subject.id);
    setForm({
      name: subject.name,
      abbreviation: (subject as any).abbreviation || "",
      subject_type: subject.subject_type as "regular" | "gcrp",
      show_in_report_card: subject.show_in_report_card,
      show_in_planilla: subject.show_in_planilla,
      evaluation_type: subject.evaluation_type as "numeric" | "literal",
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingId(null);
    setForm(defaultForm);
  };

  const displayed = filterSuspended ? subjects : subjects.filter((s) => !s.is_suspended);

  if (schoolLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Áreas / Materias"
        breadcrumbs={[{ label: "Registros" }, { label: "Áreas" }]}
      />

      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" /> Agregar Área
            </Button>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Switch checked={filterSuspended} onCheckedChange={setFilterSuspended} />
            Mostrar suspendidas
          </label>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : displayed.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {subjects.length === 0 ? "No hay áreas registradas" : "No hay áreas activas para mostrar"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-center">Boletas</TableHead>
                      <TableHead className="text-center">Planillas</TableHead>
                      <TableHead>Evaluación</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayed.map((subject) => (
                      <TableRow key={subject.id} className={subject.is_suspended ? "opacity-60" : ""}>
                        <TableCell className="font-medium">{subject.name}</TableCell>
                        <TableCell>
                          <Badge variant={subject.subject_type === "gcrp" ? "default" : "secondary"}>
                            {subject.subject_type === "gcrp" ? "GCRP" : "Regular"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {subject.show_in_report_card ? (
                            <CheckCircle className="h-4 w-4 text-primary mx-auto" />
                          ) : (
                            <Ban className="h-4 w-4 text-muted-foreground mx-auto" />
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {subject.show_in_planilla ? (
                            <CheckCircle className="h-4 w-4 text-primary mx-auto" />
                          ) : (
                            <Ban className="h-4 w-4 text-muted-foreground mx-auto" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {subject.evaluation_type === "literal" ? "Literal" : "Numérica"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {subject.is_suspended ? (
                            <Badge variant="destructive">Suspendida</Badge>
                          ) : (
                            <Badge variant="default">Activa</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="outline" onClick={() => openEdit(subject)}>
                              <Edit className="h-3 w-3 mr-1" /> Editar
                            </Button>
                            <Button
                              size="sm"
                              variant={subject.is_suspended ? "outline" : "destructive"}
                              onClick={() => toggleSuspendMutation.mutate({ id: subject.id, suspend: !subject.is_suspended })}
                              disabled={toggleSuspendMutation.isPending}
                            >
                              {subject.is_suspended ? (
                                <><CheckCircle className="h-3 w-3 mr-1" /> Activar</>
                              ) : (
                                <><Ban className="h-3 w-3 mr-1" /> Suspender</>
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Área" : "Nueva Área"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="subject-name">Nombre del Área *</Label>
              <Input
                id="subject-name"
                placeholder="Ej: Matemáticas, Castellano..."
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject-abbreviation">Sigla *</Label>
              <Input
                id="subject-abbreviation"
                placeholder="Ej: MAT, CAST, EDU.FIS..."
                value={form.abbreviation}
                onChange={(e) => setForm({ ...form, abbreviation: e.target.value.toUpperCase() })}
                maxLength={20}
              />
              <p className="text-xs text-muted-foreground">Abreviatura que aparecerá en las planillas (sábanas de notas)</p>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Área</Label>
              <Select value={form.subject_type} onValueChange={(v) => setForm({ ...form, subject_type: v as "regular" | "gcrp" })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">Regular</SelectItem>
                  <SelectItem value="gcrp">GCRP</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Evaluación</Label>
              <Select value={form.evaluation_type} onValueChange={(v) => setForm({ ...form, evaluation_type: v as "numeric" | "literal" })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="numeric">Numérica</SelectItem>
                  <SelectItem value="literal">Literal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="show-report">Mostrar en Boletas</Label>
              <Switch
                id="show-report"
                checked={form.show_in_report_card}
                onCheckedChange={(v) => setForm({ ...form, show_in_report_card: v })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="show-planilla">Mostrar en Planillas</Label>
              <Switch
                id="show-planilla"
                checked={form.show_in_planilla}
                onCheckedChange={(v) => setForm({ ...form, show_in_planilla: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.name.trim()}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingId ? "Guardar Cambios" : "Crear Área"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
