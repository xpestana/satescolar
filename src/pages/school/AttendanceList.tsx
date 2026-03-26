import { useState, useMemo, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, ClipboardList, SlidersHorizontal, FileDown, FileText, FileSpreadsheet, GripVertical } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { Pagination } from "@/components/ui/data-pagination";
import { downloadExcel, downloadPDF, type PdfHeaderConfig, type PdfFooterConfig } from "@/lib/export-utils";
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

const PAGE_SIZE = 50;

type DateFilter = "today" | "7days" | "30days" | "6months" | "12months";
type EntityType = "student" | "teacher" | "representative";

function getDateFrom(filter: DateFilter): string {
  const now = new Date();
  switch (filter) {
    case "today": return now.toISOString().split("T")[0];
    case "7days": return new Date(now.getTime() - 7 * 86400000).toISOString().split("T")[0];
    case "30days": return new Date(now.getTime() - 30 * 86400000).toISOString().split("T")[0];
    case "6months": return new Date(now.getTime() - 180 * 86400000).toISOString().split("T")[0];
    case "12months": return new Date(now.getTime() - 365 * 86400000).toISOString().split("T")[0];
  }
}

function normalize(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

interface ColumnDef {
  key: string;
  label: string;
  isFormData?: boolean;
  isFixed?: boolean; // always visible, not toggleable
}

// Fixed attendance columns (always visible)
const ATTENDANCE_FIXED_COLUMNS: ColumnDef[] = [
  { key: "attendance_date", label: "Fecha", isFixed: true },
  { key: "attendance_time", label: "Hora", isFixed: true },
  { key: "record_type", label: "Tipo", isFixed: true },
  { key: "status", label: "Estado", isFixed: true },
  { key: "notification_info", label: "Correo Notificado", isFixed: true },
];

// Entity base columns per type
const ENTITY_BASE_COLUMNS: Record<EntityType, ColumnDef[]> = {
  student: [
    { key: "document_id", label: "Cédula" },
  ],
  teacher: [
    { key: "document_id", label: "Cédula" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Teléfono" },
  ],
  representative: [
    { key: "document_id", label: "Cédula" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Teléfono" },
  ],
};

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

function AttendanceTab({
  entityType,
  schoolInfo,
  planillaConfig,
}: {
  entityType: EntityType;
  schoolInfo: any;
  planillaConfig: { header_config: PdfHeaderConfig; footer_config: PdfFooterConfig } | null;
}) {
  const { schoolId } = useSchoolId();
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [page, setPage] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState<string[] | null>(null);
  const [columnOrder, setColumnOrder] = useState<string[] | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  // Fetch form fields for dynamic columns
  const formType = entityType === "student" ? "student" : entityType === "teacher" ? "teacher" : "representative";
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

  // Build all columns: entity base + form data + attendance fixed
  const allColumns = useMemo<ColumnDef[]>(() => {
    const base = ENTITY_BASE_COLUMNS[entityType];
    const dynamic: ColumnDef[] = (formFields ?? []).map(f => ({
      key: `fd_${f.field_name}`,
      label: f.field_label,
      isFormData: true,
    }));
    return [...base, ...dynamic, ...ATTENDANCE_FIXED_COLUMNS];
  }, [entityType, formFields]);

  const toggleableColumns = useMemo(() => allColumns.filter(c => !c.isFixed), [allColumns]);

  // localStorage keys
  const visKey = `att-cols-${schoolId}-${entityType}`;
  const ordKey = `att-order-${schoolId}-${entityType}`;

  useEffect(() => {
    if (!schoolId) return;
    try {
      const sv = localStorage.getItem(visKey);
      setVisibleColumns(sv ? JSON.parse(sv) : null);
    } catch { setVisibleColumns(null); }
    try {
      const so = localStorage.getItem(ordKey);
      setColumnOrder(so ? JSON.parse(so) : null);
    } catch { setColumnOrder(null); }
  }, [visKey, ordKey, schoolId]);

  const activeColumnKeys = visibleColumns ?? toggleableColumns.map(c => c.key);

  const orderedActiveColumns = useMemo(() => {
    // Always include fixed columns, plus toggled ones
    const visibleSet = new Set([...activeColumnKeys, ...ATTENDANCE_FIXED_COLUMNS.map(c => c.key)]);
    const allKeys = allColumns.filter(c => visibleSet.has(c.key)).map(c => c.key);
    if (columnOrder) {
      const ordered = columnOrder.filter(k => visibleSet.has(k));
      const remaining = allKeys.filter(k => !columnOrder.includes(k));
      const keys = [...ordered, ...remaining];
      return keys.map(k => allColumns.find(c => c.key === k)!).filter(Boolean);
    }
    return allColumns.filter(c => visibleSet.has(c.key));
  }, [activeColumnKeys, columnOrder, allColumns]);

  const saveVisibility = useCallback((cols: string[] | null) => {
    setVisibleColumns(cols);
    if (cols) localStorage.setItem(visKey, JSON.stringify(cols));
    else localStorage.removeItem(visKey);
  }, [visKey]);

  const saveOrder = useCallback((order: string[] | null) => {
    setColumnOrder(order);
    if (order) localStorage.setItem(ordKey, JSON.stringify(order));
    else localStorage.removeItem(ordKey);
  }, [ordKey]);

  const toggleColumn = (key: string) => {
    const current = activeColumnKeys;
    const next = current.includes(key) ? current.filter(k => k !== key) : [...current, key];
    saveVisibility(next);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const currentKeys = orderedActiveColumns.map(c => c.key);
    const oldIndex = currentKeys.indexOf(active.id as string);
    const newIndex = currentKeys.indexOf(over.id as string);
    const newOrder = arrayMove(currentKeys, oldIndex, newIndex);
    saveOrder(newOrder);
  };

  // Fetch attendance records
  const { data: records = [], isLoading } = useQuery({
    queryKey: ["attendance-records", schoolId, entityType, dateFilter],
    queryFn: async () => {
      if (!schoolId) return [];
      const dateFrom = getDateFrom(dateFilter);
      const { data, error } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("school_id", schoolId)
        .eq("entity_type", entityType)
        .gte("attendance_date", dateFrom)
        .order("attendance_timestamp", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolId,
  });

  const entityIds = useMemo(() => [...new Set(records.map(r => r.entity_id))], [records]);

  const { data: entities = {} } = useQuery({
    queryKey: ["attendance-entities", entityType, entityIds],
    queryFn: async () => {
      if (entityIds.length === 0) return {};
      const table = entityType === "teacher" ? "teachers" :
                    entityType === "student" ? "students" : "representatives";
      const { data } = await supabase
        .from(table)
        .select("id, form_data, document_id, email, phone")
        .in("id", entityIds);
      const map: Record<string, any> = {};
      (data || []).forEach(e => { map[e.id] = e; });
      return map;
    },
    enabled: entityIds.length > 0,
  });

  const enrichedRecords = useMemo(() => {
    return records.map(r => {
      const entity = entities[r.entity_id];
      const fd = (entity?.form_data as any) || {};
      const fullName = [fd.primer_nombre, fd.segundo_nombre, fd.primer_apellido, fd.segundo_apellido].filter(Boolean).join(" ");
      // Build flat record with form data prefixed
      const row: Record<string, any> = {
        ...r,
        fullName,
        document_id: entity?.document_id || fd.documento || "",
        email: entity?.email || "",
        phone: entity?.phone || fd.telefono || "",
        notification_info: r.notification_sent ? (r.notification_email || "Sí") : "—",
      };
      // Add form_data fields with fd_ prefix
      if (fd) {
        Object.keys(fd).forEach(k => {
          row[`fd_${k}`] = fd[k];
        });
      }
      return row;
    });
  }, [records, entities]);

  const filtered = useMemo(() => {
    if (!search.trim()) return enrichedRecords;
    const terms = normalize(search).split(/\s+/);
    return enrichedRecords.filter(r => {
      const target = normalize([r.fullName, r.document_id, r.email].filter(Boolean).join(" "));
      return terms.every(t => target.includes(t));
    });
  }, [enrichedRecords, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const getCellValue = (r: any, col: ColumnDef) => {
    switch (col.key) {
      case "attendance_time": return r.attendance_time?.substring(0, 5);
      case "record_type": return <Badge variant="outline">{r.record_type?.toUpperCase()}</Badge>;
      case "status": return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
          {r.status === "present" ? "Presente" : r.status}
        </Badge>
      );
      case "notification_info": return <span className="text-xs text-muted-foreground">{r.notification_info}</span>;
      default: return r[col.key] ?? "—";
    }
  };

  const getTextValue = (r: any, col: ColumnDef): string => {
    switch (col.key) {
      case "attendance_time": return r.attendance_time?.substring(0, 5) || "";
      case "record_type": return r.record_type?.toUpperCase() || "";
      case "status": return r.status === "present" ? "Presente" : (r.status || "");
      case "notification_info": return r.notification_info || "";
      default: return r[col.key] != null ? String(r[col.key]) : "";
    }
  };

  const typeLabel = entityType === "student" ? "Estudiantes" : entityType === "teacher" ? "Docentes" : "Representantes";

  const getExportData = () => {
    const cols = orderedActiveColumns.map(c => ({ key: c.key, label: c.label }));
    const rows = filtered.map(r => {
      const row: Record<string, any> = {};
      cols.forEach(c => { row[c.key] = getTextValue(r, c); });
      return row;
    });
    return { cols, rows };
  };

  const handleExportExcel = () => {
    const { cols, rows } = getExportData();
    downloadExcel(cols, rows, `Asistencias - ${typeLabel}`);
  };

  const handleExportPDF = () => {
    const { cols, rows } = getExportData();
    const institutionType = schoolInfo?.institution_type === "public" ? "Unidad Educativa" :
      schoolInfo?.institution_type === "private" ? "Unidad Educativa Privada" :
      schoolInfo?.institution_type === "subsidized" ? "Unidad Educativa Subvencionada" : "Unidad Educativa";
    const pdfSchool = schoolInfo ? {
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
    downloadPDF(cols, rows, `Asistencias - ${typeLabel}`, pdfSchool, planillaConfig?.header_config, planillaConfig?.footer_config);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o documento..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Select value={dateFilter} onValueChange={(v) => { setDateFilter(v as DateFilter); setPage(1); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoy</SelectItem>
            <SelectItem value="7days">Últimos 7 días</SelectItem>
            <SelectItem value="30days">Último mes</SelectItem>
            <SelectItem value="6months">Últimos 6 meses</SelectItem>
            <SelectItem value="12months">Últimos 12 meses</SelectItem>
          </SelectContent>
        </Select>

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
                  <Button variant="ghost" size="sm" onClick={() => saveVisibility([])} className="text-xs h-7">
                    Ninguna
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { saveVisibility(null); saveOrder(null); }} className="text-xs h-7">
                    Todas
                  </Button>
                </div>
              </div>
              {toggleableColumns.map(col => (
                <label key={col.key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={activeColumnKeys.includes(col.key)}
                    onCheckedChange={() => toggleColumn(col.key)}
                  />
                  {col.label}
                </label>
              ))}
              <p className="text-xs text-muted-foreground pt-1 border-t">
                Fecha, Hora, Tipo, Estado y Correo siempre visibles.
              </p>
            </div>
          </PopoverContent>
        </Popover>

        {/* Export */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <FileDown className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 bg-background z-50" align="end">
            <div className="flex flex-col gap-2">
              <Button size="sm" variant="outline" onClick={handleExportExcel} className="justify-start">
                <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
              </Button>
              <Button size="sm" variant="outline" onClick={handleExportPDF} className="justify-start">
                <FileText className="h-4 w-4 mr-2" /> PDF
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <Table>
            <TableHeader>
              <TableRow>
                <SortableContext items={orderedActiveColumns.map(c => c.key)} strategy={horizontalListSortingStrategy}>
                  {orderedActiveColumns.map(col => (
                    <SortableHeaderCell key={col.key} col={col} />
                  ))}
                </SortableContext>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={orderedActiveColumns.length} className="text-center py-8 text-muted-foreground">Cargando...</TableCell>
                </TableRow>
              ) : paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={orderedActiveColumns.length} className="text-center py-8 text-muted-foreground">No hay registros</TableCell>
                </TableRow>
              ) : paged.map(r => (
                <TableRow key={r.id}>
                  {orderedActiveColumns.map(col => (
                    <TableCell key={col.key} className={col.key === "document_id" ? "text-muted-foreground" : ""}>
                      {getCellValue(r, col)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DndContext>
      </div>

      {totalPages > 1 && (
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={filtered.length} itemsPerPage={PAGE_SIZE} />
      )}

      <p className="text-xs text-muted-foreground text-right">{filtered.length} registro(s)</p>
    </div>
  );
}

export default function AttendanceList() {
  const { schoolId } = useSchoolId();

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

  return (
    <DashboardLayout>
      <PageHeader
        title="Asistencias"
        breadcrumbs={[{ label: "Utilidades" }, { label: "Asistencias" }]}
      />

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <ClipboardList className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Registros de Asistencia</h3>
              <p className="text-sm text-muted-foreground">Consulta los registros de asistencia por rol</p>
            </div>
          </div>

          <Tabs defaultValue="students">
            <TabsList className="mb-4">
              <TabsTrigger value="students">Estudiantes</TabsTrigger>
              <TabsTrigger value="teachers">Docentes</TabsTrigger>
              <TabsTrigger value="representatives">Representantes</TabsTrigger>
            </TabsList>

            <TabsContent value="students">
              <AttendanceTab entityType="student" schoolInfo={schoolInfo} planillaConfig={planillaConfig ?? null} />
            </TabsContent>
            <TabsContent value="teachers">
              <AttendanceTab entityType="teacher" schoolInfo={schoolInfo} planillaConfig={planillaConfig ?? null} />
            </TabsContent>
            <TabsContent value="representatives">
              <AttendanceTab entityType="representative" schoolInfo={schoolInfo} planillaConfig={planillaConfig ?? null} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
