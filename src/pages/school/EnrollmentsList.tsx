import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { Search, ClipboardCheck, CheckCircle, MoreHorizontal, UserPen, Users, GraduationCap } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EnrollStudentModal } from "@/components/enrollments/EnrollStudentModal";
import { Pagination } from "@/components/ui/data-pagination";

interface StudentWithEnrollment {
  id: string;
  document_id: string | null;
  photo_url: string | null;
  form_data: Record<string, string> | null;
  family_id: string;
  familyName: string;
  isEnrolled: boolean;
  enrollmentSection?: string;
}

export default function EnrollmentsList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { schoolId } = useSchoolId();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentWithEnrollment | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Fetch active school year
  const { data: activeYear } = useQuery({
    queryKey: ["active-school-year", schoolId],
    queryFn: async () => {
      if (!schoolId) return null;
      const { data, error } = await supabase
        .from("school_years")
        .select("*")
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!schoolId,
  });

  // Fetch sections
  const { data: sections = [] } = useQuery({
    queryKey: ["sections", schoolId],
    queryFn: async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from("sections")
        .select("*")
        .eq("school_id", schoolId)
        .order("grade_level")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!schoolId,
  });

  // Fetch active students with enrollment status
  const { data: students = [], isLoading } = useQuery({
    queryKey: ["enrollment-students", schoolId, activeYear?.id],
    queryFn: async () => {
      if (!schoolId) return [];

      // Get students linked to this school
      const { data: studentSchools, error: ssError } = await supabase
        .from("student_schools")
        .select("student_id")
        .eq("school_id", schoolId);
      if (ssError) throw ssError;

      const studentIds = studentSchools.map(ss => ss.student_id);
      if (studentIds.length === 0) return [];

      const { data: studentsData, error: stError } = await supabase
        .from("students")
        .select("id, document_id, photo_url, form_data, family_id, status")
        .in("id", studentIds)
        .eq("status", "active");
      if (stError) throw stError;

      // Get family names
      const familyIds = [...new Set(studentsData.map(s => s.family_id))];
      const { data: families } = await supabase
        .from("families")
        .select("id, father_last_name, mother_last_name")
        .in("id", familyIds);

      const familyMap = new Map(families?.map(f => [f.id, `${f.father_last_name || ""} ${f.mother_last_name || ""}`.trim() || "Sin apellido"]) || []);

      // Get enrollments for active year
      let enrollmentMap = new Map<string, string>();
      if (activeYear?.id) {
        const { data: enrollments } = await supabase
          .from("enrollments")
          .select("student_id, section_id")
          .eq("school_year_id", activeYear.id)
          .eq("school_id", schoolId);

        enrollments?.forEach(e => {
          const section = sections.find(s => s.id === e.section_id);
          enrollmentMap.set(e.student_id, section?.name || "");
        });
      }

      return studentsData.map(s => ({
        id: s.id,
        document_id: s.document_id,
        photo_url: s.photo_url,
        form_data: s.form_data as Record<string, string> | null,
        family_id: s.family_id,
        familyName: familyMap.get(s.family_id) || "",
        isEnrolled: enrollmentMap.has(s.id),
        enrollmentSection: enrollmentMap.get(s.id),
      })) as StudentWithEnrollment[];
    },
    enabled: !!schoolId && sections.length >= 0,
  });

  const getStudentName = (formData: Record<string, string> | null) => {
    if (!formData) return "Sin nombre";
    const parts = [formData.primer_nombre, formData.segundo_nombre, formData.primer_apellido, formData.segundo_apellido].filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : "Sin nombre";
  };

  const filtered = students.filter(s => {
    const name = getStudentName(s.form_data).toLowerCase();
    const doc = (s.document_id || "").toLowerCase();
    const family = s.familyName.toLowerCase();
    const term = searchTerm.toLowerCase();
    return name.includes(term) || doc.includes(term) || family.includes(term);
  });

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const enrolledCount = students.filter(s => s.isEnrolled).length;
  const pendingCount = students.filter(s => !s.isEnrolled).length;

  const handleEnroll = (student: StudentWithEnrollment) => {
    if (!activeYear) {
      toast({ variant: "destructive", title: "Error", description: "No hay un año escolar activo configurado." });
      return;
    }
    setSelectedStudent(student);
    setIsModalOpen(true);
  };

  const breadcrumbs = [
    { label: "Dashboard", href: "/school/dashboard" },
    { label: "Inscripciones" },
  ];

  return (
    <DashboardLayout>
      <PageHeader title="Inscripciones" breadcrumbs={breadcrumbs} />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <ClipboardCheck className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{students.length}</p>
                <p className="text-sm text-muted-foreground">Total Estudiantes Activos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{enrolledCount}</p>
                <p className="text-sm text-muted-foreground">Inscritos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <ClipboardCheck className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-sm text-muted-foreground">Pendientes por Inscribir</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active year info */}
      {activeYear && (
        <div className="mb-4 p-3 bg-primary/10 rounded-lg flex items-center gap-2">
          <Badge variant="default">Año Escolar Activo</Badge>
          <span className="font-semibold">{activeYear.year_range}</span>
        </div>
      )}
      {!activeYear && !isLoading && (
        <div className="mb-4 p-3 bg-destructive/10 rounded-lg text-destructive text-sm">
          ⚠️ No hay un año escolar activo. Configúralo en Ajustes → Año escolar y secciones.
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          {/* Search */}
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, cédula o familia..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="pl-9"
              />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Acciones</TableHead>
                <TableHead>Foto</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Cédula</TableHead>
                <TableHead>Familia</TableHead>
                <TableHead>Grado</TableHead>
                <TableHead className="text-center">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Cargando...</TableCell>
                </TableRow>
              ) : paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No hay estudiantes activos.</TableCell>
                </TableRow>
              ) : paginated.map(student => (
                <TableRow key={student.id}>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant={student.isEnrolled ? "outline" : "default"}
                        onClick={() => handleEnroll(student)}
                        className="gap-1"
                      >
                        <ClipboardCheck className="h-4 w-4" />
                        {student.isEnrolled ? "Cambiar" : "Inscribir"}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem onClick={() => navigate(`/estudiantes/editar/${student.id}`)}>
                            <GraduationCap className="h-4 w-4 mr-2" />
                            Editar Estudiante
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/familias/editar/${student.family_id}`)}>
                            <Users className="h-4 w-4 mr-2" />
                            Editar Familia
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/representantes/editar/${student.family_id}`)}>
                            <UserPen className="h-4 w-4 mr-2" />
                            Editar Representante Principal
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                  <TableCell>
                    {student.photo_url ? (
                      <img src={student.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                        {getStudentName(student.form_data).charAt(0)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{getStudentName(student.form_data)}</TableCell>
                  <TableCell>{student.document_id || "—"}</TableCell>
                  <TableCell>{student.familyName}</TableCell>
                  <TableCell>{student.form_data?.grado || "—"}</TableCell>
                  <TableCell className="text-center">
                    {student.isEnrolled ? (
                      <Badge className="bg-green-100 text-green-800">Inscrito - Sección {student.enrollmentSection}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-orange-600 border-orange-300">Pendiente</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {totalPages > 1 && (
            <div className="mt-4">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={filtered.length}
                itemsPerPage={pageSize}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {selectedStudent && activeYear && (
        <EnrollStudentModal
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          student={selectedStudent}
          activeYear={activeYear}
          sections={sections}
          schoolId={schoolId!}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["enrollment-students"] });
            setIsModalOpen(false);
            setSelectedStudent(null);
          }}
        />
      )}
    </DashboardLayout>
  );
}
