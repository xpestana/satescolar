import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Pagination } from "@/components/ui/data-pagination";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Search, SlidersHorizontal, Loader2, GripVertical, FileText, FileSpreadsheet, FileDown,
  Eye, Edit, IdCard, Ban, CheckCircle, Plus, KeyRound, RefreshCw,
} from "lucide-react";
import { downloadCSV, downloadExcel, downloadPDF, downloadCarnet, type PdfHeaderConfig, type PdfFooterConfig } from "@/lib/export-utils";
import { ViewRecordModal } from "@/components/search/ViewRecordModal";
import { useNavigate } from "react-router-dom";
import { useCarnetConfig } from "@/hooks/useCarnetConfig";
import { toast } from "sonner";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, horizontalListSortingStrategy, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface ColumnDef {
  key: string;
  label: string;
  isFormData: boolean;
}

const FIXED_COLUMNS: ColumnDef[] = [
  { key: "photo_url", label: "Foto", isFormData: false },
  { key: "document_id", label: "Cédula", isFormData: false },
  { key: "email", label: "Email", isFormData: false },
  { key: "phone", label: "Teléfono", isFormData: false },
  { key: "status", label: "Estado", isFormData: false },
];

const PAGE_SIZE = 10;

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

function generatePassword(length = 8): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default function TeachersList() {
  const { schoolId, isLoading: schoolLoading } = useSchoolId();
  const { data: carnetConfig } = useCarnetConfig(schoolId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState<string[] | null>(null);
  const [columnOrder, setColumnOrder] = useState<string[] | null>(null);
  const [exportColumns, setExportColumns] = useState<string[] | null>(null);
  const [viewRecord, setViewRecord] = useState<any>(null);

  // Password modal
  const [passwordModal, setPasswordModal] = useState<{ open: boolean; teacherId: string; teacherName: string }>({
    open: false, teacherId: "", teacherName: "",
  });
  const [newPassword, setNewPassword] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  // Fetch form fields
  const { data: formFields } = useQuery({
    queryKey: ["form-fields-teachers", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("form_fields")
        .select("field_name, field_label, field_order")
        .eq("school_id", schoolId!)
        .eq("form_type", "teacher")
        .eq("is_visible", true)
        .order("field_order");
      if (error) throw error;
      return data;
    },
    enabled: !!schoolId,
  });

  const allColumns = useMemo<ColumnDef[]>(() => {
    const dynamic: ColumnDef[] = (formFields ?? []).map((f) => ({
      key: f.field_name,
      label: f.field_label,
      isFormData: true,
    }));
    return [...FIXED_COLUMNS, ...dynamic];
  }, [formFields]);

  const exportableColumns = useMemo(
    () => allColumns.filter((c) => c.key !== "photo_url" && c.key !== "status"),
    [allColumns]
  );

  const visibilityKey = `teachers-cols-${schoolId}`;
  const orderKey = `teachers-order-${schoolId}`;

  useEffect(() => {
    if (!schoolId) return;
    try {
      const savedVis = localStorage.getItem(visibilityKey);
      setVisibleColumns(savedVis ? JSON.parse(savedVis) : null);
    } catch { setVisibleColumns(null); }
    try {
      const savedOrd = localStorage.getItem(orderKey);
      setColumnOrder(savedOrd ? JSON.parse(savedOrd) : null);
    } catch { setColumnOrder(null); }
  }, [visibilityKey, orderKey, schoolId]);

  const activeColumnKeys = visibleColumns ?? allColumns.map((c) => c.key);

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

  const effectiveExportKeys = exportColumns ?? activeColumnKeys.filter((k) => k !== "photo_url" && k !== "status");

  const saveVisibility = useCallback((cols: string[] | null) => {
    setVisibleColumns(cols);
    if (cols) localStorage.setItem(visibilityKey, JSON.stringify(cols));
    else localStorage.removeItem(visibilityKey);
  }, [visibilityKey]);

  const saveOrder = useCallback((order: string[] | null) => {
    setColumnOrder(order);
    if (order) localStorage.setItem(orderKey, JSON.stringify(order));
    else localStorage.removeItem(orderKey);
  }, [orderKey]);

  const toggleColumn = (key: string) => {
    const current = activeColumnKeys;
    const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
    saveVisibility(next);
  };
  const resetColumns = () => { saveVisibility(null); saveOrder(null); };
  const deselectAll = () => saveVisibility([]);
  const toggleExportColumn = (key: string) => {
    const current = effectiveExportKeys;
    const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
    setExportColumns(next);
  };
  const resetExportColumns = () => setExportColumns(null);
  const deselectAllExport = () => setExportColumns([]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const currentKeys = orderedActiveColumns.map((c) => c.key);
    const oldIndex = currentKeys.indexOf(active.id as string);
    const newIndex = currentKeys.indexOf(over.id as string);
    saveOrder(arrayMove(currentKeys, oldIndex, newIndex));
  };

  // Fetch school info
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

  // Fetch teachers
  const { data: teachers, isLoading: teachersLoading } = useQuery({
    queryKey: ["teachers", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teachers")
        .select("*")
        .eq("school_id", schoolId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!schoolId,
  });

  // Suspend mutation
  const suspendMutation = useMutation({
    mutationFn: async ({ id, suspend }: { id: string; suspend: boolean }) => {
      const { error } = await supabase
        .from("teachers")
        .update({ is_suspended: suspend })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers", schoolId] });
      toast.success("Estado del docente actualizado");
    },
    onError: () => toast.error("Error al actualizar el estado"),
  });

  // Filter
  const filtered = useMemo(() => {
    if (!teachers) return [];
    if (!searchTerm.trim()) return teachers;
    const term = searchTerm.toLowerCase();
    return teachers.filter((r: any) => {
      const fixedVals = [r.document_id, r.email, r.phone].filter(Boolean);
      const formData = (r.form_data ?? {}) as Record<string, any>;
      const formVals = Object.values(formData).filter(Boolean);
      return [...fixedVals, ...formVals].some((v) => String(v).toLowerCase().includes(term));
    });
  }, [teachers, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  const getCellValue = (record: any, col: ColumnDef) => {
    if (col.key === "photo_url") {
      return (
        <Avatar className="h-8 w-8">
          <AvatarImage src={record.photo_url || ""} />
          <AvatarFallback className="text-xs">{(record.document_id || "?").charAt(0)}</AvatarFallback>
        </Avatar>
      );
    }
    if (col.key === "status") {
      return record.is_suspended ? (
        <Badge variant="destructive" className="text-xs">Suspendido</Badge>
      ) : (
        <Badge variant="default" className="text-xs bg-green-600">Activo</Badge>
      );
    }
    if (col.isFormData) {
      const fd = (record.form_data ?? {}) as Record<string, any>;
      return fd[col.key] ?? "—";
    }
    return record[col.key] ?? "—";
  };

  const getTextValue = (record: any, col: ColumnDef): string => {
    if (col.key === "status") return record.is_suspended ? "Suspendido" : "Activo";
    if (col.isFormData) {
      const fd = (record.form_data ?? {}) as Record<string, any>;
      return fd[col.key] != null ? String(fd[col.key]) : "";
    }
    return record[col.key] != null ? String(record[col.key]) : "";
  };

  const getExportData = () => {
    const cols = exportableColumns.filter((c) => effectiveExportKeys.includes(c.key));
    const rows = filtered.map((r: any) => {
      const row: Record<string, any> = {};
      cols.forEach((c) => { row[c.key] = getTextValue(r, c); });
      return row;
    });
    return { cols, rows };
  };

  const handleExportCSV = () => { const { cols, rows } = getExportData(); downloadCSV(cols, rows, "Docentes"); };
  const handleExportExcel = () => { const { cols, rows } = getExportData(); downloadExcel(cols, rows, "Docentes"); };
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
    downloadPDF(cols, rows, "Docentes", pdfSchoolInfo, planillaConfig?.header_config, planillaConfig?.footer_config);
  };

  const handleDownloadCarnet = async (record: any) => {
    const fd = (record.form_data ?? {}) as Record<string, any>;
    const name = [fd.primer_nombre, fd.segundo_nombre, fd.primer_apellido, fd.segundo_apellido]
      .filter(Boolean).join(" ") || "Sin nombre";
    const institutionType = schoolInfo?.institution_type === "public" ? "Unidad Educativa" :
      schoolInfo?.institution_type === "private" ? "Unidad Educativa Privada" :
      schoolInfo?.institution_type === "subsidized" ? "Unidad Educativa Subvencionada" : "Unidad Educativa";
    const locationParts = [(schoolInfo?.cities as any)?.name, (schoolInfo?.states as any)?.name].filter(Boolean);
    await downloadCarnet({
      personName: name,
      documentId: record.document_id || fd.documento || "",
      role: "DOCENTE" as any,
      photoUrl: record.photo_url || undefined,
      schoolName: schoolInfo ? `${institutionType} ${schoolInfo.name}` : "Institución",
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

  const handleOpenPasswordModal = (record: any) => {
    const fd = (record.form_data ?? {}) as Record<string, any>;
    const name = [fd.primer_nombre, fd.primer_apellido].filter(Boolean).join(" ") || "Docente";
    setNewPassword("");
    setPasswordModal({ open: true, teacherId: record.id, teacherName: name });
  };

  const passwordMutation = useMutation({
    mutationFn: async ({ teacherId, password }: { teacherId: string; password: string }) => {
      const response = await supabase.functions.invoke("update-teacher-password", {
        body: { teacher_id: teacherId, new_password: password },
      });
      if (response.error) throw new Error(response.error.message);
      const result = response.data;
      if (result?.error) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      toast.success(`Contraseña actualizada para ${passwordModal.teacherName}`);
      setPasswordModal({ open: false, teacherId: "", teacherName: "" });
      setNewPassword("");
    },
    onError: (error) => {
      toast.error(error.message || "Error al actualizar la contraseña");
    },
  });

  const handleSavePassword = () => {
    if (!newPassword.trim()) {
      toast.error("Ingrese una contraseña");
      return;
    }
    passwordMutation.mutate({ teacherId: passwordModal.teacherId, password: newPassword });
  };

  const isLoading = schoolLoading || teachersLoading;

  const teacherColumns = useMemo<ColumnDef[]>(() => {
    return orderedActiveColumns;
  }, [orderedActiveColumns]);

  return (
    <DashboardLayout>
      <PageHeader title="Docentes" breadcrumbs={[{ label: "Registros" }, { label: "Docentes" }]} />

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
          <Button onClick={() => navigate("/registros/docentes/nuevo")} className="shadow-sm">
            <Plus className="h-4 w-4 mr-2" />
            Agregar Docente
          </Button>

          <div className="flex-1 relative w-full sm:w-auto min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar docentes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

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
                    <Button variant="ghost" size="sm" onClick={deselectAll} className="text-xs h-7">Ninguna</Button>
                    <Button variant="ghost" size="sm" onClick={resetColumns} className="text-xs h-7">Todas</Button>
                  </div>
                </div>
                {allColumns.map((col) => (
                  <label key={col.key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={activeColumnKeys.includes(col.key)} onCheckedChange={() => toggleColumn(col.key)} />
                    {col.label}
                  </label>
                ))}
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
            <PopoverContent className="w-72 bg-background z-50" align="end">
              <div className="space-y-2">
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
                    <Button variant="ghost" size="sm" onClick={deselectAllExport} className="text-xs h-6 px-2">Ninguna</Button>
                    <Button variant="ghost" size="sm" onClick={resetExportColumns} className="text-xs h-6 px-2">Todas</Button>
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1.5">
                  {exportableColumns.map((col) => (
                    <label key={col.key} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={effectiveExportKeys.includes(col.key)} onCheckedChange={() => toggleExportColumn(col.key)} />
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
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap w-[140px] sticky left-0 bg-background z-10">Acciones</TableHead>
                      <SortableContext items={teacherColumns.map((c) => c.key)} strategy={horizontalListSortingStrategy}>
                        {teacherColumns.map((col) => (
                          <SortableHeaderCell key={col.key} col={col} />
                        ))}
                      </SortableContext>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={(teacherColumns.length || 1) + 1} className="text-center py-8 text-muted-foreground">
                          No se encontraron docentes
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginated.map((record: any) => (
                        <TableRow key={record.id} className={record.is_suspended ? "opacity-60 bg-muted/30" : ""}>
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
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/registros/docentes/${record.id}/editar`)}>
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Editar</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost" size="icon" className="h-8 w-8"
                                      onClick={() => suspendMutation.mutate({ id: record.id, suspend: !record.is_suspended })}
                                    >
                                      {record.is_suspended ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Ban className="h-4 w-4 text-orange-500" />}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>{record.is_suspended ? "Reactivar" : "Suspender"}</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenPasswordModal(record)}>
                                      <KeyRound className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Contraseña</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownloadCarnet(record)}>
                                      <IdCard className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Carnet</TooltipContent>
                                </Tooltip>
                              </div>
                            </TooltipProvider>
                          </TableCell>
                          {teacherColumns.map((col) => (
                            <TableCell key={col.key}>{getCellValue(record, col)}</TableCell>
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

      {/* View modal */}
      <ViewRecordModal
        open={!!viewRecord}
        onClose={() => setViewRecord(null)}
        record={viewRecord}
        formType={"teacher" as any}
        columns={teacherColumns}
        getTextValue={getTextValue}
      />

      {/* Password modal */}
      <Dialog open={passwordModal.open} onOpenChange={(open) => !open && setPasswordModal({ open: false, teacherId: "", teacherName: "" })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modificar Contraseña</DialogTitle>
            <DialogDescription>Establecer contraseña para {passwordModal.teacherName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nueva Contraseña</Label>
              <div className="flex gap-2">
                <Input
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Ingrese la contraseña"
                />
                <Button type="button" variant="outline" size="icon" onClick={() => setNewPassword(generatePassword())} title="Generar contraseña">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordModal({ open: false, teacherId: "", teacherName: "" })}>
              Cancelar
            </Button>
            <Button onClick={handleSavePassword} disabled={passwordMutation.isPending}>
              {passwordMutation.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
