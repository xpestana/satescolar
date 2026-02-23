import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { Search, ClipboardCheck, CheckCircle, MoreHorizontal, UserPen, Users, GraduationCap, Columns, FileDown, FileSpreadsheet, GripVertical, Download } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EnrollStudentModal } from "@/components/enrollments/EnrollStudentModal";
import { Pagination } from "@/components/ui/data-pagination";
import { checkStudentCompleteness, ENROLLMENT_CUSTOM_FIELDS } from "@/lib/enrollment-completeness";
import { downloadPlanillaInscripcion, downloadPDF, downloadExcel, PdfSchoolInfo } from "@/lib/export-utils";
import { toast } from "sonner";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, horizontalListSortingStrategy, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

// Sortable column header component
function SortableColumnHeader({ id, label }: { id: string; label: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: "grab",
  };
  return (
    <TableHead ref={setNodeRef} style={style} className="select-none">
      <div className="flex items-center gap-1" {...attributes} {...listeners}>
        <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" />
        <span>{label}</span>
      </div>
    </TableHead>
  );
}

export default function EnrollmentsList() {
  const { toast: uiToast } = useToast();
  const queryClient = useQueryClient();
  const { schoolId } = useSchoolId();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentWithEnrollment | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Filters
  const [statusFilter, setStatusFilter] = useState<"all" | "enrolled" | "pending">("all");
  const [selectedYearId, setSelectedYearId] = useState<string>("active");

  // Fetch school data for planilla download
  const { data: school } = useQuery({
    queryKey: ["school-data", schoolId],
    queryFn: async () => {
      if (!schoolId) return null;
      const { data, error } = await supabase.from("schools").select("*").eq("id", schoolId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!schoolId,
  });

  // Fetch all school years
  const { data: schoolYears = [] } = useQuery({
    queryKey: ["school-years-all", schoolId],
    queryFn: async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from("school_years")
        .select("*")
        .eq("school_id", schoolId)
        .order("year_range", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!schoolId,
  });

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

  // Resolved year: either selected or active
  const resolvedYear = useMemo(() => {
    if (selectedYearId === "active") return activeYear;
    return schoolYears.find(y => y.id === selectedYearId) || activeYear;
  }, [selectedYearId, activeYear, schoolYears]);

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

  // Fetch planilla sections for dynamic columns + completeness
  const { data: planillaSections = [] } = useQuery({
    queryKey: ["enrollment-planilla-sections", schoolId],
    queryFn: async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from("enrollment_planilla_sections")
        .select("*")
        .eq("school_id", schoolId)
        .order("display_order");
      if (error) throw error;
      return data;
    },
    enabled: !!schoolId,
  });

  // Fetch student form fields for labels
  const { data: studentFormFields = [] } = useQuery({
    queryKey: ["student-form-fields-all", schoolId],
    queryFn: async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from("form_fields")
        .select("field_name, field_label")
        .eq("school_id", schoolId)
        .eq("form_type", "student")
        .order("field_order");
      if (error) throw error;
      return data;
    },
    enabled: !!schoolId,
  });

  // Fetch representative form fields for labels
  const { data: repFormFields = [] } = useQuery({
    queryKey: ["representative-form-fields-all", schoolId],
    queryFn: async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from("form_fields")
        .select("field_name, field_label")
        .eq("school_id", schoolId)
        .eq("form_type", "representative")
        .order("field_order");
      if (error) throw error;
      return data;
    },
    enabled: !!schoolId,
  });

  // Build dynamic column definitions from planilla sections
  const baseDynamicColumns = useMemo(() => {
    const cols: { key: string; label: string }[] = [];
    const seen = new Set<string>();
    planillaSections.forEach(s => {
      if (s.section_type !== "fields") return;
      const fieldNames = Array.isArray(s.field_names) ? (s.field_names as string[]) : [];
      fieldNames.forEach(f => {
        if (ENROLLMENT_CUSTOM_FIELDS.includes(f) || f.endsWith(":_edad") || seen.has(f)) return;
        seen.add(f);
        const [type, ...rest] = f.split(":");
        const name = rest.join(":");
        let label = name;
        if (type === "student") {
          label = studentFormFields.find(ff => ff.field_name === name)?.field_label || name;
        } else if (type === "representative") {
          label = repFormFields.find(ff => ff.field_name === name)?.field_label || name;
        } else if (type === "family") {
          label = name.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        } else if (type === "custom") {
          label = name.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        }
        cols.push({ key: f, label });
      });
    });
    return cols;
  }, [planillaSections, studentFormFields, repFormFields]);

  // Column order state for drag and drop
  const [columnOrder, setColumnOrder] = useState<string[] | null>(null);

  const dynamicColumns = useMemo(() => {
    if (!columnOrder) return baseDynamicColumns;
    const map = new Map(baseDynamicColumns.map(c => [c.key, c]));
    const ordered = columnOrder.filter(k => map.has(k)).map(k => map.get(k)!);
    // Append any new columns not in the order
    baseDynamicColumns.forEach(c => {
      if (!columnOrder.includes(c.key)) ordered.push(c);
    });
    return ordered;
  }, [baseDynamicColumns, columnOrder]);

  // Column visibility state — all visible by default
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());

  const visibleDynamicColumns = dynamicColumns.filter(c => !hiddenColumns.has(c.key));

  const toggleColumn = (key: string) => {
    setHiddenColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const currentOrder = columnOrder || dynamicColumns.map(c => c.key);
    const oldIndex = currentOrder.indexOf(active.id as string);
    const newIndex = currentOrder.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    setColumnOrder(arrayMove(currentOrder, oldIndex, newIndex));
  }, [columnOrder, dynamicColumns]);

  // Fetch active students with enrollment status
  const { data: students = [], isLoading } = useQuery({
    queryKey: ["enrollment-students", schoolId, resolvedYear?.id],
    queryFn: async () => {
      if (!schoolId) return [];

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

      const familyIds = [...new Set(studentsData.map(s => s.family_id))];
      const { data: families } = await supabase
        .from("families")
        .select("id, father_last_name, mother_last_name")
        .in("id", familyIds);

      const familyMap = new Map(families?.map(f => [f.id, `${f.father_last_name || ""} ${f.mother_last_name || ""}`.trim() || "Sin apellido"]) || []);

      let enrollmentMap = new Map<string, string>();
      if (resolvedYear?.id) {
        const { data: enrollments } = await supabase
          .from("enrollments")
          .select("student_id, section_id")
          .eq("school_year_id", resolvedYear.id)
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

  // Fetch primary representatives for completeness check
  const familyIds = useMemo(() => [...new Set(students.map(s => s.family_id))], [students]);

  const { data: representatives = [] } = useQuery({
    queryKey: ["primary-representatives", familyIds],
    queryFn: async () => {
      if (familyIds.length === 0) return [];
      const { data, error } = await supabase
        .from("representatives")
        .select("family_id, form_data")
        .in("family_id", familyIds)
        .eq("is_primary", true);
      if (error) throw error;
      return data;
    },
    enabled: familyIds.length > 0,
  });

  const { data: familiesData = [] } = useQuery({
    queryKey: ["families-data", familyIds],
    queryFn: async () => {
      if (familyIds.length === 0) return [];
      const { data, error } = await supabase
        .from("families")
        .select("*")
        .in("id", familyIds);
      if (error) throw error;
      return data;
    },
    enabled: familyIds.length > 0,
  });

  const repMap = useMemo(() => new Map(representatives.map(r => [r.family_id, r.form_data as Record<string, string> | null])), [representatives]);
  const familyDataMap = useMemo(() => new Map(familiesData.map(f => [f.id, f as Record<string, any>])), [familiesData]);

  const getCompleteness = (student: StudentWithEnrollment) => {
    return checkStudentCompleteness(
      planillaSections.map(s => ({ field_names: Array.isArray(s.field_names) ? s.field_names as string[] : [], section_type: s.section_type })),
      student.form_data,
      repMap.get(student.family_id) || null,
      familyDataMap.get(student.family_id) || null,
    );
  };

  const getStudentName = (formData: Record<string, string> | null) => {
    if (!formData) return "Sin nombre";
    const parts = [formData.primer_nombre, formData.segundo_nombre, formData.primer_apellido, formData.segundo_apellido].filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : "Sin nombre";
  };

  // Resolve dynamic column value for a student
  const getDynamicValue = (student: StudentWithEnrollment, fieldKey: string): string => {
    const [type, ...rest] = fieldKey.split(":");
    const name = rest.join(":");
    if (type === "student") return student.form_data?.[name] || "—";
    if (type === "representative") {
      const repData = repMap.get(student.family_id);
      return (repData as any)?.[name] || "—";
    }
    if (type === "family") {
      const fam = familyDataMap.get(student.family_id);
      const val = fam?.[name];
      return val !== null && val !== undefined && val !== "" ? String(val) : "—";
    }
    if (type === "custom") return student.form_data?.[name] || "—";
    return "—";
  };

  // Apply filters: search + status
  const filtered = useMemo(() => {
    return students.filter(s => {
      // Status filter
      if (statusFilter === "enrolled" && !s.isEnrolled) return false;
      if (statusFilter === "pending" && s.isEnrolled) return false;

      // Text search
      const name = getStudentName(s.form_data).toLowerCase();
      const doc = (s.document_id || "").toLowerCase();
      const family = s.familyName.toLowerCase();
      const term = searchTerm.toLowerCase();
      return name.includes(term) || doc.includes(term) || family.includes(term);
    });
  }, [students, statusFilter, searchTerm]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const enrolledCount = filtered.filter(s => s.isEnrolled).length;
  const pendingCount = filtered.filter(s => !s.isEnrolled).length;

  // School geo data for exports
  const { data: schoolGeo } = useQuery({
    queryKey: ["school-geo", school?.state_id, school?.municipality_id, school?.city_id, school?.parish_id],
    queryFn: async () => {
      const [stateRes, muniRes, cityRes, parishRes] = await Promise.all([
        school?.state_id ? supabase.from("states").select("name").eq("id", school.state_id).single() : null,
        school?.municipality_id ? supabase.from("municipalities").select("name").eq("id", school.municipality_id).single() : null,
        school?.city_id ? supabase.from("cities").select("name").eq("id", school.city_id).single() : null,
        school?.parish_id ? supabase.from("parishes").select("name").eq("id", school.parish_id).single() : null,
      ]);
      return {
        state: stateRes?.data?.name || "",
        municipality: muniRes?.data?.name || "",
        city: cityRes?.data?.name || "",
        parish: parishRes?.data?.name || "",
      };
    },
    enabled: !!school,
  });

  // Build export data from filtered results and visible columns
  const buildExportData = useCallback(() => {
    const columns = [
      { key: "estado", label: "Estado" },
      { key: "nombre", label: "Nombre" },
      { key: "cedula", label: "Cédula" },
      { key: "familia", label: "Familia" },
      ...visibleDynamicColumns.map(c => ({ key: c.key, label: c.label })),
      { key: "grado", label: "Grado" },
    ];

    const rows = filtered.map(s => {
      const row: Record<string, string> = {
        estado: s.isEnrolled ? `Inscrito - Sección ${s.enrollmentSection}` : "Pendiente",
        nombre: getStudentName(s.form_data),
        cedula: s.document_id || "—",
        familia: s.familyName,
        grado: s.form_data?.grado || "—",
      };
      visibleDynamicColumns.forEach(col => {
        row[col.key] = getDynamicValue(s, col.key);
      });
      return row;
    });

    return { columns, rows };
  }, [filtered, visibleDynamicColumns]);

  const handleExportPDF = async () => {
    const { columns, rows } = buildExportData();
    const schoolInfo: PdfSchoolInfo | undefined = school && schoolGeo ? {
      name: school.name,
      deaCode: school.dea_code,
      statisticalCode: school.statistical_code,
      address: school.address,
      state: schoolGeo.state,
      municipality: schoolGeo.municipality,
      city: schoolGeo.city,
      parish: schoolGeo.parish,
      logoUrl: school.logo_url || undefined,
      phone: school.phone,
      rif: school.rif,
    } : undefined;
    await downloadPDF(columns, rows, "Inscripciones", schoolInfo);
  };

  const handleExportExcel = () => {
    const { columns, rows } = buildExportData();
    downloadExcel(columns, rows, "Inscripciones");
  };

  const handleDownloadPlanilla = async (student: StudentWithEnrollment) => {
    if (!school || !schoolId) return;
    try {
      toast.info("Generando planilla...");

      const [familyRes, repRes, sectionsRes, configRes, enrollmentRes, geoRes, formFieldsRes] = await Promise.all([
        supabase.from("families").select("*").eq("id", student.family_id).single(),
        supabase.from("representatives").select("*").eq("family_id", student.family_id).eq("is_primary", true).limit(1).maybeSingle(),
        supabase.from("enrollment_planilla_sections").select("*").eq("school_id", schoolId).order("display_order"),
        supabase.from("planilla_general_config").select("*").eq("school_id", schoolId).maybeSingle(),
        supabase.from("enrollments").select("*, sections(*)").eq("student_id", student.id).eq("school_id", schoolId).limit(1).maybeSingle(),
        Promise.all([
          school.state_id ? supabase.from("states").select("name").eq("id", school.state_id).single() : null,
          school.municipality_id ? supabase.from("municipalities").select("name").eq("id", school.municipality_id).single() : null,
          school.city_id ? supabase.from("cities").select("name").eq("id", school.city_id).single() : null,
          school.parish_id ? supabase.from("parishes").select("name").eq("id", school.parish_id).single() : null,
        ]),
        supabase.from("form_fields").select("field_name, field_label, form_type").eq("school_id", schoolId).in("form_type", ["student", "representative"]),
      ]);

      let representative = repRes.data;
      if (!representative) {
        const { data: fallbackRep } = await supabase.from("representatives").select("*").eq("family_id", student.family_id).order("created_at").limit(1).maybeSingle();
        representative = fallbackRep;
      }

      const familyGeoPromises = await Promise.all([
        familyRes.data?.state_id ? supabase.from("states").select("name").eq("id", familyRes.data.state_id).single() : null,
        familyRes.data?.municipality_id ? supabase.from("municipalities").select("name").eq("id", familyRes.data.municipality_id).single() : null,
        familyRes.data?.city_id ? supabase.from("cities").select("name").eq("id", familyRes.data.city_id).single() : null,
        familyRes.data?.parish_id ? supabase.from("parishes").select("name").eq("id", familyRes.data.parish_id).single() : null,
      ]);

      const [stateRes, muniRes, cityRes, parishRes] = geoRes;
      const planillaSchoolGeo = {
        state: familyGeoPromises[0]?.data?.name || stateRes?.data?.name,
        municipality: familyGeoPromises[1]?.data?.name || muniRes?.data?.name,
        city: familyGeoPromises[2]?.data?.name || cityRes?.data?.name,
        parish: familyGeoPromises[3]?.data?.name || parishRes?.data?.name,
      };

      const studentFullData = {
        ...student,
        form_data: student.form_data || {},
      };

      await downloadPlanillaInscripcion({
        student: studentFullData,
        representative,
        family: familyRes.data,
        school,
        schoolGeo: planillaSchoolGeo,
        sections: sectionsRes.data || [],
        generalConfig: configRes.data,
        schoolYear: resolvedYear?.year_range || "2024-2025",
        enrollment: enrollmentRes.data,
        enrollmentSection: enrollmentRes.data?.sections,
        formFields: formFieldsRes.data || [],
      });
    } catch (err) {
      console.error("Error generating planilla:", err);
      toast.error("Error al generar la planilla");
    }
  };

  const handleEnroll = (student: StudentWithEnrollment) => {
    if (!resolvedYear) {
      uiToast({ variant: "destructive", title: "Error", description: "No hay un año escolar activo configurado." });
      return;
    }
    setSelectedStudent(student);
    setIsModalOpen(true);
  };

  const totalColSpan = 7 + visibleDynamicColumns.length;

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
                <p className="text-2xl font-bold">{filtered.length}</p>
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
          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, cédula o familia..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="pl-9"
              />
            </div>

            {/* Status filter */}
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as any); setCurrentPage(1); }}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="enrolled">Inscritos</SelectItem>
                <SelectItem value="pending">Pendientes</SelectItem>
              </SelectContent>
            </Select>

            {/* School year filter */}
            {schoolYears.length > 0 && (
              <Select value={selectedYearId} onValueChange={(v) => { setSelectedYearId(v); setCurrentPage(1); }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Año escolar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Año activo{activeYear ? ` (${activeYear.year_range})` : ""}</SelectItem>
                  {schoolYears.map(y => (
                    <SelectItem key={y.id} value={y.id}>
                      {y.year_range}{y.is_active ? " ★" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Column toggle */}
            {dynamicColumns.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Columns className="h-4 w-4" />
                    Columnas
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 max-h-80 overflow-y-auto" align="end">
                  <p className="text-sm font-medium mb-2">Columnas visibles</p>
                  <div className="flex gap-2 mb-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 flex-1"
                      onClick={() => setHiddenColumns(new Set())}
                    >
                      Seleccionar todo
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 flex-1"
                      onClick={() => setHiddenColumns(new Set(dynamicColumns.map(c => c.key)))}
                    >
                      Deseleccionar todo
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {dynamicColumns.map(col => (
                      <label key={col.key} className="flex items-center gap-2 cursor-pointer text-sm">
                        <Checkbox
                          checked={!hiddenColumns.has(col.key)}
                          onCheckedChange={() => toggleColumn(col.key)}
                        />
                        {col.label}
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {/* Export buttons */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportPDF}>
                  <FileDown className="h-4 w-4 mr-2" />
                  Exportar PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportExcel}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Exportar Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Acciones</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead>Foto</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Cédula</TableHead>
                  <TableHead>Familia</TableHead>
                  <SortableContext items={visibleDynamicColumns.map(c => c.key)} strategy={horizontalListSortingStrategy}>
                    {visibleDynamicColumns.map(col => (
                      <SortableColumnHeader key={col.key} id={col.key} label={col.label} />
                    ))}
                  </SortableContext>
                  <TableHead>Grado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={totalColSpan} className="text-center py-8 text-muted-foreground">Cargando...</TableCell>
                  </TableRow>
                ) : paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={totalColSpan} className="text-center py-8 text-muted-foreground">No hay estudiantes activos.</TableCell>
                  </TableRow>
                ) : paginated.map(student => {
                  const completeness = planillaSections.length > 0 ? getCompleteness(student) : null;
                  const rowBg = completeness
                    ? completeness.isComplete
                      ? "bg-green-50/60 hover:bg-green-100/60"
                      : "bg-red-50/60 hover:bg-red-100/60"
                    : "";

                  return (
                    <TableRow key={student.id} className={rowBg}>
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
                              <DropdownMenuItem onClick={() => handleDownloadPlanilla(student)}>
                                <FileDown className="h-4 w-4 mr-2" />
                                Descargar Planilla
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {student.isEnrolled ? (
                          <Badge className="bg-green-100 text-green-800">Inscrito - Sección {student.enrollmentSection}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-orange-600 border-orange-300">Pendiente</Badge>
                        )}
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
                      {visibleDynamicColumns.map(col => (
                        <TableCell key={col.key} className="text-sm">{getDynamicValue(student, col.key)}</TableCell>
                      ))}
                      <TableCell>{student.form_data?.grado || "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </DndContext>

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

      {selectedStudent && resolvedYear && (
        <EnrollStudentModal
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          student={selectedStudent}
          activeYear={resolvedYear}
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
