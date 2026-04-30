import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Users, Search, Loader2, Eye, BarChart3 } from "lucide-react";
import { StudentProgressView } from "@/components/classroom/StudentProgressView";

interface StudentInfo {
  id: string;
  document_id: string | null;
  form_data: Record<string, string> | null;
}

interface Props {
  assignmentId: string;
  schoolId: string;
}

function getStudentName(s: StudentInfo): string {
  const fd = s.form_data || {};
  const parts = [fd.primer_nombre, fd.segundo_nombre, fd.primer_apellido, fd.segundo_apellido].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : s.document_id || "Sin nombre";
}

export function PeopleList({ assignmentId, schoolId }: Props) {
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentInfo | null>(null);

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["classroom-people", assignmentId],
    queryFn: async () => {
      const { data: assignment } = await supabase
        .from("subject_teacher_assignments")
        .select("section_id, school_year_id")
        .eq("id", assignmentId)
        .single();
      if (!assignment) return [];

      const { data, error } = await supabase
        .from("enrollments")
        .select("student:student_id(id, document_id, form_data)")
        .eq("section_id", assignment.section_id)
        .eq("school_year_id", assignment.school_year_id);
      if (error) throw error;
      return ((data || []) as any[])
        .map((e: any) => e.student as StudentInfo)
        .filter(Boolean)
        .sort((a, b) => getStudentName(a).localeCompare(getStudentName(b)));
    },
  });

  if (selectedStudent) {
    return (
      <StudentProgressView
        student={selectedStudent}
        assignmentId={assignmentId}
        onBack={() => setSelectedStudent(null)}
      />
    );
  }

  const filtered = students.filter(s => {
    if (!search.trim()) return true;
    const name = getStudentName(s).toLowerCase();
    return name.includes(search.toLowerCase()) || (s.document_id || "").includes(search);
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto">
        <ListItemSkeleton count={5} />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold">Estudiantes matriculados</h3>
          <Badge variant="secondary">{students.length}</Badge>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar estudiante..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">
            {students.length === 0 ? "No hay estudiantes matriculados" : "Sin resultados"}
          </p>
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Estudiante</TableHead>
                <TableHead>Cédula</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((student, i) => (
                <TableRow key={student.id}>
                  <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
                  <TableCell className="font-medium text-sm">{getStudentName(student)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{student.document_id || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs"
                      onClick={() => setSelectedStudent(student)}
                    >
                      <BarChart3 className="h-3.5 w-3.5 mr-1" /> Progreso
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
