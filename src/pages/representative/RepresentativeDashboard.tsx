import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, GraduationCap, UserPlus, Edit, Trash2, Download, AlertCircle, School } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRepresentativeFamily } from "@/hooks/useRepresentativeFamily";
import { useToast } from "@/hooks/use-toast";
import { downloadCarnet } from "@/lib/export-utils";
import { useState } from "react";

export default function RepresentativeDashboard() {
  const navigate = useNavigate();
  const { familyId, familyName, school } = useRepresentativeFamily();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<{ type: "rep" | "student"; id: string; name: string } | null>(null);

  const { data: representatives = [] } = useQuery({
    queryKey: ["representatives", familyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("representatives")
        .select("*")
        .eq("family_id", familyId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!familyId,
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students", familyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("family_id", familyId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!familyId,
  });

  // Fetch school year for carnet
  const { data: schoolYear } = useQuery({
    queryKey: ["active-school-year", school?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("school_years")
        .select("year_range")
        .eq("school_id", school!.id)
        .eq("is_active", true)
        .single();
      return data?.year_range || "2024-2025";
    },
    enabled: !!school?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ type, id }: { type: "rep" | "student"; id: string }) => {
      const table = type === "rep" ? "representatives" : "students";
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { type }) => {
      queryClient.invalidateQueries({ queryKey: [type === "rep" ? "representatives" : "students", familyId] });
      toast({ title: "Eliminado", description: `${type === "rep" ? "Representante" : "Estudiante"} eliminado exitosamente` });
      setDeleteTarget(null);
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar" });
    },
  });

  const getRepName = (rep: any) => {
    const fd = rep.form_data as Record<string, any> || {};
    return `${fd.primer_nombre || ""} ${fd.segundo_nombre || ""} ${fd.primer_apellido || ""} ${fd.segundo_apellido || ""}`.replace(/\s+/g, " ").trim() || "Sin nombre";
  };

  const getStudentName = (s: any) => {
    const fd = s.form_data as Record<string, any> || {};
    return `${fd.primer_nombre || ""} ${fd.segundo_nombre || ""} ${fd.primer_apellido || ""} ${fd.segundo_apellido || ""}`.replace(/\s+/g, " ").trim() || "Sin nombre";
  };

  const handleDownloadCarnet = async (person: any, role: "REPRESENTANTE" | "ESTUDIANTE") => {
    const name = role === "REPRESENTANTE" ? getRepName(person) : getStudentName(person);
    await downloadCarnet({
      personName: name,
      documentId: person.document_id || "Sin documento",
      role,
      photoUrl: person.photo_url || undefined,
      schoolName: school?.name || "Institución",
      schoolLocation: school?.address || "",
      schoolLogoUrl: school?.logo_url || undefined,
      schoolYear: schoolYear || "2024-2025",
    });
  };

  const getRepType = (rep: any) => {
    const fd = rep.form_data as Record<string, any> || {};
    return fd.parentesco || "Representante";
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active": return "Activo";
      case "suspended": return "Suspendido";
      case "graduated": return "Graduado";
      case "completed": return "Completado";
      default: return status;
    }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title={`Familia ${familyName}`}
        breadcrumbs={[{ label: "Dashboard" }]}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{representatives.length}</p>
              <p className="text-sm text-muted-foreground">Representantes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <GraduationCap className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{students.length}</p>
              <p className="text-sm text-muted-foreground">Estudiantes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <School className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">0</p>
              <p className="text-sm text-muted-foreground">Inscritos en plantel</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alert */}
      <Alert className="border-orange-200 bg-orange-50 mb-6">
        <AlertCircle className="h-4 w-4 text-orange-500" />
        <AlertDescription className="text-orange-700">
          Es importante mantener los datos de su familia actualizados para una mejor comunicación con la institución.
        </AlertDescription>
      </Alert>

      {/* Representatives Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Representantes</h2>
          <Button size="sm" onClick={() => navigate(`/representative/representante/nuevo`)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Agregar
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {representatives.map((rep) => (
            <Card key={rep.id}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4 mb-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={rep.photo_url || ""} />
                    <AvatarFallback className="bg-primary/10 text-primary text-lg">
                      {getRepName(rep).charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{getRepName(rep)}</p>
                    <p className="text-sm text-muted-foreground">{getRepType(rep)}</p>
                    <Badge variant="secondary" className="mt-1">{rep.document_id || "Sin doc."}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => navigate(`/representative/representante/${rep.id}/editar`)}>
                    <Edit className="h-3 w-3 mr-1" /> Editar
                  </Button>
                  {representatives.length > 1 && (
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => setDeleteTarget({ type: "rep", id: rep.id, name: getRepName(rep) })}>
                      <Trash2 className="h-3 w-3 mr-1" /> Eliminar
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => handleDownloadCarnet(rep, "REPRESENTANTE")}>
                    <Download className="h-3 w-3 mr-1" /> Carnet
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Students Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Estudiantes</h2>
          <Button size="sm" onClick={() => navigate(`/representative/estudiante/nuevo`)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Agregar
          </Button>
        </div>
        {students.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              No hay estudiantes registrados
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {students.map((student) => (
              <Card key={student.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4 mb-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={student.photo_url || ""} />
                      <AvatarFallback className="bg-primary/10 text-primary text-lg">
                        {getStudentName(student).charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{getStudentName(student)}</p>
                      <p className="text-sm text-muted-foreground">{student.document_id || "Sin doc."}</p>
                      <Badge variant={student.status === "active" ? "default" : "secondary"} className="mt-1">
                        {getStatusLabel(student.status)}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => navigate(`/representative/estudiante/${student.id}/editar`)}>
                      <Edit className="h-3 w-3 mr-1" /> Editar
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => setDeleteTarget({ type: "student", id: student.id, name: getStudentName(student) })}>
                      <Trash2 className="h-3 w-3 mr-1" /> Eliminar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDownloadCarnet(student, "ESTUDIANTE")}>
                      <Download className="h-3 w-3 mr-1" /> Carnet
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Delete dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {deleteTarget?.type === "rep" ? "representante" : "estudiante"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de eliminar a <strong>{deleteTarget?.name}</strong>. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate({ type: deleteTarget.type, id: deleteTarget.id })}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
