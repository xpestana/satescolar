import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, BookOpen, Users, FileText, MessageSquare, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { formatGradeLevel } from "@/lib/utils";

export default function ClassroomSupervision() {
  const { schoolId } = useSchoolId();
  const [search, setSearch] = useState("");

  // Get all assignments with classroom data
  const { data: classrooms = [], isLoading } = useQuery({
    queryKey: ["supervision-classrooms", schoolId],
    queryFn: async () => {
      const { data: assignments } = await supabase
        .from("subject_teacher_assignments")
        .select(`
          id, school_id,
          subject:subject_id(id, name),
          section:section_id(id, name, grade_level),
          school_year:school_year_id(id, year_range, is_active),
          teacher:teacher_id(id, form_data)
        `)
        .eq("school_id", schoolId!)
        .eq("is_suspended", false);

      if (!assignments?.length) return [];

      const assignmentIds = assignments.map((a: any) => a.id);

      // Get configs
      const { data: configs } = await supabase
        .from("classroom_config")
        .select("assignment_id, is_archived, color")
        .in("assignment_id", assignmentIds);

      // Get activity counts
      const { data: actCounts } = await supabase
        .from("classroom_activities")
        .select("assignment_id")
        .in("assignment_id", assignmentIds)
        .eq("status", "published");

      // Get post counts
      const { data: postCounts } = await supabase
        .from("classroom_posts")
        .select("assignment_id")
        .in("assignment_id", assignmentIds)
        .eq("status", "published");

      // Get submission counts
      const { data: subCounts } = await supabase
        .from("classroom_submissions")
        .select("activity_id, status")
        .in("activity_id",
          (actCounts || []).map(() => "").length > 0
            ? assignmentIds // Simplified: get all
            : []
        );

      const configMap = new Map((configs || []).map((c: any) => [c.assignment_id, c]));

      // Count per assignment
      const actCountMap = new Map<string, number>();
      (actCounts || []).forEach((a: any) => {
        actCountMap.set(a.assignment_id, (actCountMap.get(a.assignment_id) || 0) + 1);
      });

      const postCountMap = new Map<string, number>();
      (postCounts || []).forEach((p: any) => {
        postCountMap.set(p.assignment_id, (postCountMap.get(p.assignment_id) || 0) + 1);
      });

      return assignments.map((a: any) => ({
        ...a,
        config: configMap.get(a.id) || null,
        activityCount: actCountMap.get(a.id) || 0,
        postCount: postCountMap.get(a.id) || 0,
        hasConfig: configMap.has(a.id),
      }));
    },
    enabled: !!schoolId,
  });

  // Stats
  const activeClassrooms = classrooms.filter((c: any) => c.school_year?.is_active);
  const configuredCount = activeClassrooms.filter((c: any) => c.hasConfig).length;
  const withActivities = activeClassrooms.filter((c: any) => c.activityCount > 0).length;

  const getTeacherName = (teacher: any) => {
    if (!teacher?.form_data) return "Sin docente";
    const fd = teacher.form_data as Record<string, any>;
    return `${fd.primer_nombre || ""} ${fd.primer_apellido || ""}`.trim() || "Sin nombre";
  };

  const filtered = activeClassrooms.filter((c: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      c.subject?.name?.toLowerCase().includes(s) ||
      getTeacherName(c.teacher).toLowerCase().includes(s) ||
      c.section?.name?.toLowerCase().includes(s)
    );
  });

  return (
    <DashboardLayout>
      <PageHeader
        title="Supervisión de Aulas Virtuales"
        breadcrumbs={[{ label: "Dashboard", href: "/school/dashboard" }, { label: "Supervisión Aulas" }]}
      />

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeClassrooms.length}</p>
              <p className="text-xs text-muted-foreground">Aulas Activas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{configuredCount}</p>
              <p className="text-xs text-muted-foreground">Configuradas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{withActivities}</p>
              <p className="text-xs text-muted-foreground">Con Actividades</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {new Set(activeClassrooms.map((c: any) => c.teacher?.id).filter(Boolean)).size}
              </p>
              <p className="text-xs text-muted-foreground">Docentes</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por materia, docente o sección..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Badge variant="secondary">{filtered.length} aula(s)</Badge>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando...</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No se encontraron aulas virtuales.
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Materia</TableHead>
                <TableHead>Sección</TableHead>
                <TableHead>Docente</TableHead>
                <TableHead className="text-center">Configurada</TableHead>
                <TableHead className="text-center">Publicaciones</TableHead>
                <TableHead className="text-center">Actividades</TableHead>
                <TableHead className="text-center">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.subject?.name || "—"}</TableCell>
                  <TableCell>
                    {c.section
                      ? `${formatGradeLevel(c.section.grade_level)} — ${c.section.name}`
                      : "General"}
                  </TableCell>
                  <TableCell>{getTeacherName(c.teacher)}</TableCell>
                  <TableCell className="text-center">
                    {c.hasConfig ? (
                      <Badge className="bg-green-100 text-green-700">Sí</Badge>
                    ) : (
                      <Badge variant="outline">No</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{c.postCount}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{c.activityCount}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {c.config?.is_archived ? (
                      <Badge variant="outline">Archivada</Badge>
                    ) : c.activityCount > 0 || c.postCount > 0 ? (
                      <Badge className="bg-green-100 text-green-700">Activa</Badge>
                    ) : (
                      <Badge variant="outline">Sin uso</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </DashboardLayout>
  );
}
