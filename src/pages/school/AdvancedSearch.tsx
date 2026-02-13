import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Pagination } from "@/components/ui/data-pagination";
import { Search, SlidersHorizontal, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type FormType = "student" | "representative";

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
];

const PAGE_SIZE = 10;

export default function AdvancedSearch() {
  const { schoolId, isLoading: schoolLoading } = useSchoolId();
  const [formType, setFormType] = useState<FormType>("student");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState<string[] | null>(null);

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
    const fixed = formType === "student" ? FIXED_COLUMNS_STUDENT : FIXED_COLUMNS_REP;
    const dynamic: ColumnDef[] = (formFields ?? []).map((f) => ({
      key: f.field_name,
      label: f.field_label,
      isFormData: true,
    }));
    return [...fixed, ...dynamic];
  }, [formType, formFields]);

  // localStorage persistence
  const storageKey = `adv-search-cols-${schoolId}-${formType}`;

  useEffect(() => {
    if (!schoolId) return;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        setVisibleColumns(JSON.parse(saved));
      } catch {
        setVisibleColumns(null);
      }
    } else {
      setVisibleColumns(null);
    }
  }, [storageKey, schoolId]);

  const activeColumnKeys = visibleColumns ?? allColumns.map((c) => c.key);
  const activeColumns = allColumns.filter((c) => activeColumnKeys.includes(c.key));

  const toggleColumn = (key: string) => {
    const current = activeColumnKeys;
    const next = current.includes(key)
      ? current.filter((k) => k !== key)
      : [...current, key];
    setVisibleColumns(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  };

  const resetColumns = () => {
    setVisibleColumns(null);
    localStorage.removeItem(storageKey);
  };

  // Fetch data
  const { data: records, isLoading: recordsLoading } = useQuery({
    queryKey: ["adv-search-records", schoolId, formType],
    queryFn: async () => {
      const table = formType === "student" ? "students" : "representatives";
      const { data, error } = await supabase
        .from(table)
        .select("*, families(father_last_name, mother_last_name)")
        .eq("school_id", schoolId!);
      if (error) throw error;
      return data;
    },
    enabled: !!schoolId,
  });

  // Filter
  const filtered = useMemo(() => {
    if (!records) return [];
    if (!searchTerm.trim()) return records;
    const term = searchTerm.toLowerCase();
    return records.filter((r: any) => {
      // Search in fixed fields
      const fixedVals = [r.document_id, r.email, r.phone].filter(Boolean);
      const familyName = [
        (r.families as any)?.father_last_name,
        (r.families as any)?.mother_last_name,
      ]
        .filter(Boolean)
        .join(" ");
      fixedVals.push(familyName);

      // Search in form_data
      const formData = (r.form_data ?? {}) as Record<string, any>;
      const formVals = activeColumnKeys
        .filter((k) => allColumns.find((c) => c.key === k)?.isFormData)
        .map((k) => formData[k])
        .filter(Boolean);

      return [...fixedVals, ...formVals].some((v) =>
        String(v).toLowerCase().includes(term)
      );
    });
  }, [records, searchTerm, activeColumnKeys, allColumns]);

  // Paginate
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
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
    if (col.isFormData) {
      const fd = (record.form_data ?? {}) as Record<string, any>;
      return fd[col.key] ?? "—";
    }
    return record[col.key] ?? "—";
  };

  const isLoading = schoolLoading || recordsLoading;

  return (
    <DashboardLayout>
      <PageHeader title="Búsqueda Avanzada" breadcrumbs={[{ label: "Registros" }, { label: "Búsqueda Avanzada" }]} />

      <div className="space-y-4">
        {/* Tabs + controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <Tabs
            value={formType}
            onValueChange={(v) => setFormType(v as FormType)}
          >
            <TabsList>
              <TabsTrigger value="student">Estudiantes</TabsTrigger>
              <TabsTrigger value="representative">Representantes</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex-1 relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar en todos los campos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <SlidersHorizontal className="h-4 w-4 mr-2" />
                Columnas
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 max-h-80 overflow-y-auto" align="end">
              <div className="space-y-2">
                <div className="flex items-center justify-between pb-2 border-b">
                  <span className="text-sm font-medium">Columnas visibles</span>
                  <Button variant="ghost" size="sm" onClick={resetColumns} className="text-xs h-7">
                    Mostrar todas
                  </Button>
                </div>
                {allColumns.map((col) => (
                  <label
                    key={col.key}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
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
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {activeColumns.map((col) => (
                      <TableHead key={col.key}>{col.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={activeColumns.length}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No se encontraron registros
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginated.map((record: any) => (
                      <TableRow key={record.id}>
                        {activeColumns.map((col) => (
                          <TableCell key={col.key}>
                            {getCellValue(record, col)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={filtered.length}
                itemsPerPage={PAGE_SIZE}
              />
            )}

            <p className="text-xs text-muted-foreground">
              {filtered.length} registro{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
            </p>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
