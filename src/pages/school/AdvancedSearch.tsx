import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import logoBlack from "@/assets/logo-black.svg";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Pagination } from "@/components/ui/data-pagination";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, SlidersHorizontal, Loader2, GripVertical, FileText, FileSpreadsheet, FileDown, Eye, Edit, IdCard, Star, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { downloadCSV, downloadExcel, downloadPDF, downloadCarnet, type PdfHeaderConfig, type PdfFooterConfig } from "@/lib/export-utils";
import { ViewRecordModal } from "@/components/search/ViewRecordModal";
import { ViewTeacherModal } from "@/components/search/ViewTeacherModal";
import { useCarnetConfig } from "@/hooks/useCarnetConfig";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type FormType = "student" | "representative" | "teacher";

interface ColumnDef {
  key: string;
  label: string;
  isFormData: boolean;
}

const FIXED_COLUMNS_STUDENT: ColumnDef[] = [
  { key: "photo_url", label: "Foto", isFormData: false },
  { key: "document_id", label: "Cédula", isFormData: false },
  { key: "family_name", label: "Familia", isFormData: false },
];

const FIXED_COLUMNS_REP: ColumnDef[] = [
  { key: "photo_url", label: "Foto", isFormData: false },
  { key: "document_id", label: "Cédula", isFormData: false },
  { key: "email", label: "Email", isFormData: false },
  { key: "phone", label: "Teléfono", isFormData: false },
  { key: "family_name", label: "Familia", isFormData: false },
  { key: "family_students", label: "Estudiantes", isFormData: false },
  { key: "family_students_count", label: "Nº Estudiantes", isFormData: false },
];

const FIXED_COLUMNS_TEACHER: ColumnDef[] = [
  { key: "photo_url", label: "Foto", isFormData: false },
  { key: "document_id", label: "Cédula", isFormData: false },
  { key: "email", label: "Email", isFormData: false },
  { key: "phone", label: "Teléfono", isFormData: false },
];

const PAGE_SIZE = 10;

// Sortable table header cell
function SortableHeaderCell({ col }: { col: ColumnDef }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: col.key });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: "grab",
  };

  return (
    <TableHead ref={setNodeRef} style={style} className="select-none whitespace-nowrap">
      <span className="inline-flex items-center gap-1" {...attributes} {...listeners}>
        <GripVertical className="h-3 w-3 text-muted-foreground shrink-0" />
        {col.label}
      </span>
    </TableHead>
  );
}

export default function AdvancedSearch() {
  const { schoolId, isLoading: schoolLoading } = useSchoolId();
  const queryClient = useQueryClient();
  const { data: carnetConfig } = useCarnetConfig(schoolId);
  const [formType, setFormType] = useState<FormType>("student");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState<string[] | null>(null);
  const [columnOrder, setColumnOrder] = useState<string[] | null>(null);
  const [exportColumns, setExportColumns] = useState<string[] | null>(null);
  const [viewRecord, setViewRecord] = useState<any>(null);
  const [filterPrimary, setFilterPrimary] = useState<boolean | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  // Fetch form fields to build dynamic columns
  const { data: formFields } = useQuery({
    queryKey: ["form-fields-search", schoolId, formType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("form_fields")
        .select("field_name, field_label, field_order")
        .eq("school_id", schoolId!)
        .eq("form_type", formType)
        .eq("is_visible", true)
        .order("field_order");
      if (error) throw error;
      return data;
    },
    enabled: !!schoolId,
  });

  // Build all columns
  const allColumns = useMemo<ColumnDef[]>(() => {
    const fixed = formType === "student" ? FIXED_COLUMNS_STUDENT : formType === "representative" ? FIXED_COLUMNS_REP : FIXED_COLUMNS_TEACHER;
    const dynamic: ColumnDef[] = (formFields ?? []).map((f) => ({
      key: f.field_name,
      label: f.field_label,
      isFormData: true,
    }));
    return [...fixed, ...dynamic];
  }, [formType, formFields]);

  // Exportable columns (exclude photo_url)
  const exportableColumns = useMemo(
    () => allColumns.filter((c) => c.key !== "photo_url"),
    [allColumns]
  );

  // localStorage keys
  const visibilityKey = `adv-search-cols-${schoolId}-${formType}`;
  const orderKey = `adv-search-order-${schoolId}-${formType}`;

  // Load saved visibility & order
  useEffect(() => {
    if (!schoolId) return;
    try {
      const savedVis = localStorage.getItem(visibilityKey);
      setVisibleColumns(savedVis ? JSON.parse(savedVis) : null);
    } catch {
      setVisibleColumns(null);
    }
    try {
      const savedOrd = localStorage.getItem(orderKey);
      setColumnOrder(savedOrd ? JSON.parse(savedOrd) : null);
    } catch {
      setColumnOrder(null);
    }
  }, [visibilityKey, orderKey, schoolId]);

  // Reset export columns when form type changes
  useEffect(() => {
    setExportColumns(null);
  }, [formType]);

  const activeColumnKeys = visibleColumns ?? allColumns.map((c) => c.key);

  // Apply order
  const orderedActiveColumns = useMemo(() => {
    const visibleSet = new Set(activeColumnKeys);
    if (columnOrder) {
      const ordered = columnOrder.filter((k) => visibleSet.has(k));
      const remaining = activeColumnKeys.filter((k) => !columnOrder.includes(k));
      const keys = [...ordered, ...remaining];
      return keys.map((k) => allColumns.find((c) => c.key === k)!).filter(Boolean);
    }
    return allColumns.filter((c) => visibleSet.has(c.key));
  }, [activeColumnKeys, columnOrder, allColumns]);

  // Effective export column keys
  const effectiveExportKeys = exportColumns ?? activeColumnKeys.filter((k) => k !== "photo_url");

  const saveVisibility = useCallback(
    (cols: string[] | null) => {
      setVisibleColumns(cols);
      if (cols) {
        localStorage.setItem(visibilityKey, JSON.stringify(cols));
      } else {
        localStorage.removeItem(visibilityKey);
      }
    },
    [visibilityKey]
  );

  const saveOrder = useCallback(
    (order: string[] | null) => {
      setColumnOrder(order);
      if (order) {
        localStorage.setItem(orderKey, JSON.stringify(order));
      } else {
        localStorage.removeItem(orderKey);
      }
    },
    [orderKey]
  );

  const toggleColumn = (key: string) => {
    const current = activeColumnKeys;
    const next = current.includes(key)
      ? current.filter((k) => k !== key)
      : [...current, key];
    saveVisibility(next);
  };

  const resetColumns = () => {
    saveVisibility(null);
    saveOrder(null);
  };

  const deselectAll = () => {
    saveVisibility([]);
  };

  const toggleExportColumn = (key: string) => {
    const current = effectiveExportKeys;
    const next = current.includes(key)
      ? current.filter((k) => k !== key)
      : [...current, key];
    setExportColumns(next);
  };

  const resetExportColumns = () => setExportColumns(null);
  const deselectAllExport = () => setExportColumns([]);

  // Drag & drop
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const currentKeys = orderedActiveColumns.map((c) => c.key);
    const oldIndex = currentKeys.indexOf(active.id as string);
    const newIndex = currentKeys.indexOf(over.id as string);
    const newOrder = arrayMove(currentKeys, oldIndex, newIndex);
    saveOrder(newOrder);
  };

  // Fetch school info for PDF header
  const { data: schoolInfo } = useQuery({
    queryKey: ["school-info-export", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schools")
        .select("name, dea_code, statistical_code, address, logo_url, institution_type, phone, rif, states(name), municipalities(name), cities(name), parishes(name)")
        .eq("id", schoolId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!schoolId,
  });

  // Fetch planilla general config for PDF header/footer
  const { data: planillaConfig } = useQuery({
    queryKey: ["planilla-general-config", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("planilla_general_config" as any)
        .select("header_config, footer_config")
        .eq("school_id", schoolId!)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data as unknown as { header_config: PdfHeaderConfig; footer_config: PdfFooterConfig } | null;
    },
    enabled: !!schoolId,
  });

  // Fetch active school year for carnet
  const { data: activeSchoolYear } = useQuery({
    queryKey: ["active-school-year", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_years")
        .select("year_range")
        .eq("school_id", schoolId!)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data?.year_range || "Sin definir";
    },
    enabled: !!schoolId,
  });

  // Fetch all geo entities for UUID resolution
  const { data: geoCache } = useQuery({
    queryKey: ["geo-cache-all"],
    queryFn: async () => {
      const [stR, muR, ciR, paR] = await Promise.all([
        supabase.from("states").select("id, name"),
        supabase.from("municipalities").select("id, name"),
        supabase.from("cities").select("id, name"),
        supabase.from("parishes").select("id, name"),
      ]);
      const cache: Record<string, string> = {};
      for (const r of (stR.data || [])) cache[r.id] = r.name;
      for (const r of (muR.data || [])) cache[r.id] = r.name;
      for (const r of (ciR.data || [])) cache[r.id] = r.name;
      for (const r of (paR.data || [])) cache[r.id] = r.name;
      return cache;
    },
  });

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;

  // Fetch data
  const { data: records, isLoading: recordsLoading } = useQuery({
    queryKey: ["adv-search-records", schoolId, formType],
    queryFn: async () => {
      if (formType === "student") {
        const { data, error } = await supabase
          .from("students")
          .select("*, families(father_last_name, mother_last_name, is_suspended, contact_phone, address), student_schools!inner(school_id)")
          .eq("student_schools.school_id", schoolId!);
        if (error) throw error;
        return data as any[];
      } else if (formType === "representative") {
        const { data, error } = await supabase
          .from("representatives")
          .select("*, families!inner(id, father_last_name, mother_last_name, is_suspended, contact_phone, address, family_schools!inner(school_id))")
          .eq("families.family_schools.school_id", schoolId!);
        if (error) throw error;

        // Fetch students for all families
        const familyIds = [...new Set((data || []).map((r: any) => r.family_id))];
        let studentsMap: Record<string, { name: string }[]> = {};
        if (familyIds.length > 0) {
          const { data: allStudents } = await supabase
            .from("students")
            .select("family_id, form_data")
            .in("family_id", familyIds);
          for (const s of (allStudents || [])) {
            const fd = (s.form_data as Record<string, any>) || {};
            const name = [fd.primer_nombre, fd.primer_apellido].filter(Boolean).join(" ") || "Sin nombre";
            if (!studentsMap[s.family_id]) studentsMap[s.family_id] = [];
            studentsMap[s.family_id].push({ name });
          }
        }

        return (data || []).map((r: any) => ({
          ...r,
          _family_students: studentsMap[r.family_id] || [],
        })) as any[];
      } else {
        const { data, error } = await supabase
          .from("teachers")
          .select("*")
          .eq("school_id", schoolId!);
        if (error) throw error;
        return data as any[];
      }
    },
    enabled: !!schoolId,
  });

  // Filter
  const filtered = useMemo(() => {
    if (!records) return [];
    let result = records;

    // Filter by primary representative
    if (formType === "representative" && filterPrimary !== null) {
      result = result.filter((r: any) => r.is_primary === filterPrimary);
    }

    if (!searchTerm.trim()) return result;
    const term = searchTerm.toLowerCase();
    return result.filter((r: any) => {
      const fixedVals = [r.document_id, r.email, r.phone].filter(Boolean);
      if (formType !== "teacher") {
        const familyName = [
          (r.families as any)?.father_last_name,
          (r.families as any)?.mother_last_name,
        ]
          .filter(Boolean)
          .join(" ");
        fixedVals.push(familyName);
      }

      const formData = (r.form_data ?? {}) as Record<string, any>;
      const formVals = activeColumnKeys
        .filter((k) => allColumns.find((c) => c.key === k)?.isFormData)
        .map((k) => formData[k])
        .filter(Boolean);

      return [...fixedVals, ...formVals].some((v) =>
        String(v).toLowerCase().includes(term)
      );
    });
  }, [records, searchTerm, activeColumnKeys, allColumns, formType, filterPrimary]);

  // Paginate
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [formType, searchTerm]);

  const getCellValue = (record: any, col: ColumnDef) => {
    if (col.key === "photo_url") {
      const url = record.photo_url;
      return (
        <Avatar className="h-8 w-8">
          <AvatarImage src={url || ""} />
          <AvatarFallback className="text-xs">
            {(record.document_id || "?").charAt(0)}
          </AvatarFallback>
        </Avatar>
      );
    }
    if (col.key === "family_name") {
      const f = record.families as any;
      return [f?.father_last_name, f?.mother_last_name].filter(Boolean).join(" ") || "—";
    }
    if (col.key === "family_students") {
      const students = (record._family_students || []) as { name: string }[];
      return students.length > 0 ? students.map(s => s.name).join(", ") : "—";
    }
    if (col.key === "family_students_count") {
      return (record._family_students || []).length;
    }
    if (col.isFormData) {
      const fd = (record.form_data ?? {}) as Record<string, any>;
      const val = fd[col.key];
      if (val && typeof val === "string" && uuidPattern.test(val) && geoCache?.[val]) {
        return geoCache[val];
      }
      return val ?? "—";
    }
    return record[col.key] ?? "—";
  };

  const getTextValue = (record: any, col: ColumnDef): string => {
    if (col.key === "family_name") {
      const f = record.families as any;
      return [f?.father_last_name, f?.mother_last_name].filter(Boolean).join(" ") || "";
    }
    if (col.key === "family_students") {
      const students = (record._family_students || []) as { name: string }[];
      return students.map(s => s.name).join(", ");
    }
    if (col.key === "family_students_count") {
      return String((record._family_students || []).length);
    }
    if (col.isFormData) {
      const fd = (record.form_data ?? {}) as Record<string, any>;
      const val = fd[col.key];
      if (val && typeof val === "string" && uuidPattern.test(val) && geoCache?.[val]) {
        return geoCache[val];
      }
      return val != null ? String(val) : "";
    }
    return record[col.key] != null ? String(record[col.key]) : "";
  };

  // Export helpers
  const getExportData = () => {
    const cols = exportableColumns.filter((c) => effectiveExportKeys.includes(c.key));
    const rows = filtered.map((r: any) => {
      const row: Record<string, any> = {};
      cols.forEach((c) => {
        row[c.key] = getTextValue(r, c);
      });
      return row;
    });
    return { cols, rows };
  };

  const typeLabel = formType === "student" ? "Estudiantes" : formType === "representative" ? "Representantes" : "Docentes";

  const handleExportCSV = () => {
    const { cols, rows } = getExportData();
    downloadCSV(cols, rows, typeLabel);
  };

  const handleExportExcel = () => {
    const { cols, rows } = getExportData();
    downloadExcel(cols, rows, typeLabel);
  };

  const handleExportPDF = () => {
    const { cols, rows } = getExportData();
    const institutionType = schoolInfo?.institution_type === "public" ? "Unidad Educativa" :
      schoolInfo?.institution_type === "private" ? "Unidad Educativa Privada" :
      schoolInfo?.institution_type === "subsidized" ? "Unidad Educativa Subvencionada" : "Unidad Educativa";
    const pdfSchoolInfo = schoolInfo ? {
      name: `${institutionType} ${schoolInfo.name}`,
      deaCode: schoolInfo.dea_code,
      statisticalCode: schoolInfo.statistical_code,
      address: schoolInfo.address,
      phone: schoolInfo.phone,
      rif: schoolInfo.rif,
      state: (schoolInfo.states as any)?.name || "",
      municipality: (schoolInfo.municipalities as any)?.name || "",
      city: (schoolInfo.cities as any)?.name || "",
      parish: (schoolInfo.parishes as any)?.name || "",
      logoUrl: schoolInfo.logo_url || undefined,
    } : undefined;
    downloadPDF(cols, rows, typeLabel, pdfSchoolInfo, planillaConfig?.header_config, planillaConfig?.footer_config);
  };

  const handleEditRecord = (record: any) => {
    if (formType === "teacher") {
      window.location.href = `/registros/docentes/${record.id}/editar`;
    } else {
      const familyId = record.family_id;
      if (formType === "student") {
        window.location.href = `/registros/familias/${familyId}/estudiante/${record.id}/editar`;
      } else {
        window.location.href = `/registros/familias/${familyId}/representante/${record.id}/editar`;
      }
    }
  };

  const handleDownloadCarnet = async (record: any) => {
    const fd = (record.form_data ?? {}) as Record<string, any>;
    const name = [fd.primer_nombre, fd.segundo_nombre, fd.primer_apellido, fd.segundo_apellido]
      .filter(Boolean).join(" ") || "Sin nombre";
    
    const institutionType = schoolInfo?.institution_type === "public" ? "Unidad Educativa" :
      schoolInfo?.institution_type === "private" ? "Unidad Educativa Privada" :
      schoolInfo?.institution_type === "subsidized" ? "Unidad Educativa Subvencionada" : "Unidad Educativa";

    const locationParts = [
      (schoolInfo?.cities as any)?.name,
      (schoolInfo?.states as any)?.name,
    ].filter(Boolean);

    await downloadCarnet({
      personName: name,
      documentId: record.document_id || fd.documento || "",
      role: formType === "student" ? "ESTUDIANTE" : formType === "representative" ? "REPRESENTANTE" : "DOCENTE",
      photoUrl: record.photo_url || undefined,
      schoolName: schoolInfo?.name || "Institución",
      schoolLocation: locationParts.join(", ") || "",
      schoolLogoUrl: schoolInfo?.logo_url || undefined,
      schoolYear: activeSchoolYear || "Sin definir",
      primaryColor: carnetConfig?.primary_color || undefined,
      secondaryColor: carnetConfig?.secondary_color || undefined,
      watermarkUrl: carnetConfig?.watermark_url || undefined,
      watermarkOpacity: carnetConfig?.watermark_opacity ? Number(carnetConfig.watermark_opacity) : undefined,
      watermarkSize: carnetConfig?.watermark_size ? Number(carnetConfig.watermark_size) : undefined,
      layoutConfig: (carnetConfig?.layout_config as any) || undefined,
    });
  };

  const setPrimaryMutation = useMutation({
    mutationFn: async (record: any) => {
      const familyId = record.family_id;
      // Unset all in family, then set this one
      const { error: unsetErr } = await supabase.from("representatives").update({ is_primary: false } as any).eq("family_id", familyId);
      if (unsetErr) throw unsetErr;
      const { error: setErr } = await supabase.from("representatives").update({ is_primary: true } as any).eq("id", record.id);
      if (setErr) throw setErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adv-search-records", schoolId, "representative"] });
    },
  });

  const isLoading = schoolLoading || recordsLoading;

  return (
    <DashboardLayout>
      <PageHeader title="Búsqueda Avanzada" breadcrumbs={[{ label: "Registros" }, { label: "Búsqueda Avanzada" }]} />

      <div className="space-y-4">
        {/* Tabs + controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
          <Tabs
            value={formType}
            onValueChange={(v) => setFormType(v as FormType)}
          >
            <TabsList>
              <TabsTrigger value="student">Estudiantes</TabsTrigger>
              <TabsTrigger value="representative">Representantes</TabsTrigger>
              <TabsTrigger value="teacher">Docentes</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex-1 relative w-full sm:w-auto min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar en todos los campos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {formType === "representative" && (
            <div className="flex items-center gap-1">
              <Button
                variant={filterPrimary === true ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterPrimary(filterPrimary === true ? null : true)}
              >
                <Star className="h-4 w-4 mr-1" />
                Principales
              </Button>
              <Button
                variant={filterPrimary === false ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterPrimary(filterPrimary === false ? null : false)}
              >
                <Users className="h-4 w-4 mr-1" />
                No principales
              </Button>
            </div>
          )}

          {/* Column visibility */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <SlidersHorizontal className="h-4 w-4 mr-2" />
                Columnas
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 max-h-80 overflow-y-auto bg-background z-50" align="end">
              <div className="space-y-2">
                <div className="flex items-center justify-between pb-2 border-b gap-1">
                  <span className="text-sm font-medium">Columnas visibles</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={deselectAll} className="text-xs h-7">
                      Ninguna
                    </Button>
                    <Button variant="ghost" size="sm" onClick={resetColumns} className="text-xs h-7">
                      Todas
                    </Button>
                  </div>
                </div>
                {allColumns.map((col) => (
                  <label key={col.key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={activeColumnKeys.includes(col.key)}
                      onCheckedChange={() => toggleColumn(col.key)}
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Export column selector */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <FileDown className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 bg-background z-50" align="end">
              <div className="space-y-2">
                {/* Export buttons FIRST */}
                <div className="flex gap-2 pb-2 border-b">
                  <Button size="sm" variant="outline" onClick={handleExportCSV} className="flex-1 text-xs">
                    <FileText className="h-3 w-3 mr-1" /> CSV
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleExportExcel} className="flex-1 text-xs">
                    <FileSpreadsheet className="h-3 w-3 mr-1" /> Excel
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleExportPDF} className="flex-1 text-xs">
                    <FileText className="h-3 w-3 mr-1" /> PDF
                  </Button>
                </div>
                <div className="flex items-center justify-between pb-1 gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Columnas a exportar</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={deselectAllExport} className="text-xs h-6 px-2">
                      Ninguna
                    </Button>
                    <Button variant="ghost" size="sm" onClick={resetExportColumns} className="text-xs h-6 px-2">
                      Todas
                    </Button>
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1.5">
                  {exportableColumns.map((col) => (
                    <label key={col.key} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={effectiveExportKeys.includes(col.key)}
                        onCheckedChange={() => toggleExportColumn(col.key)}
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="rounded-md border overflow-x-auto">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap w-[100px] sticky left-0 bg-background z-10">Acciones</TableHead>
                      <SortableContext
                        items={orderedActiveColumns.map((c) => c.key)}
                        strategy={horizontalListSortingStrategy}
                      >
                        {orderedActiveColumns.map((col) => (
                          <SortableHeaderCell key={col.key} col={col} />
                        ))}
                      </SortableContext>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={(orderedActiveColumns.length || 1) + 1}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No se encontraron registros
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginated.map((record: any) => (
                        <TableRow key={record.id}>
                          <TableCell className="sticky left-0 bg-background z-10">
                            <TooltipProvider delayDuration={200}>
                              <div className="flex items-center gap-0.5">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewRecord(record)}>
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Ver</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditRecord(record)}>
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Editar</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownloadCarnet(record)}>
                                      <IdCard className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Descargar Carnet</TooltipContent>
                                </Tooltip>
                                {formType === "representative" && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className={`h-8 w-8 ${(record as any).is_primary ? "text-amber-500" : ""}`}
                                        onClick={() => setPrimaryMutation.mutate(record)}
                                        disabled={setPrimaryMutation.isPending || (record as any).is_primary}
                                        title={(record as any).is_primary ? "Representante principal" : "Marcar como principal"}
                                      >
                                        <Star className={`h-4 w-4 ${(record as any).is_primary ? "fill-amber-500" : ""}`} />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>{(record as any).is_primary ? "Representante Principal" : "Marcar como Principal"}</TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </TooltipProvider>
                          </TableCell>
                          {orderedActiveColumns.map((col) => (
                            <TableCell key={col.key}>
                              {getCellValue(record, col)}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </DndContext>
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={filtered.length}
              itemsPerPage={PAGE_SIZE}
            />
          </>
        )}
      </div>

      {formType !== "teacher" ? (
        <ViewRecordModal
          open={!!viewRecord}
          onClose={() => setViewRecord(null)}
          record={viewRecord}
          formType={formType as "student" | "representative"}
          columns={orderedActiveColumns}
          getTextValue={getTextValue}
        />
      ) : (
        <ViewTeacherModal
          open={!!viewRecord}
          onClose={() => setViewRecord(null)}
          record={viewRecord}
          columns={orderedActiveColumns}
          getTextValue={getTextValue}
        />
      )}
    </DashboardLayout>
  );
}
