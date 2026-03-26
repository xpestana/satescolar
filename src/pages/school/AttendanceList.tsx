import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, ClipboardList } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { Pagination } from "@/components/ui/data-pagination";

const PAGE_SIZE = 50;

type DateFilter = "today" | "7days" | "30days" | "6months" | "12months";

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

function AttendanceTab({ entityType }: { entityType: "teacher" | "student" | "representative" }) {
  const { schoolId } = useSchoolId();
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [page, setPage] = useState(1);

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

  // Get entity details
  const entityIds = useMemo(() => [...new Set(records.map(r => r.entity_id))], [records]);
  
  const { data: entities = {} } = useQuery({
    queryKey: ["attendance-entities", entityType, entityIds],
    queryFn: async () => {
      if (entityIds.length === 0) return {};
      const table = entityType === "teacher" ? "teachers" :
                    entityType === "student" ? "students" : "representatives";
      const { data } = await supabase
        .from(table)
        .select("id, form_data, document_id")
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
      const firstName = fd.primer_nombre || "";
      const lastName = fd.primer_apellido || "";
      const fullName = [fd.primer_nombre, fd.segundo_nombre, fd.primer_apellido, fd.segundo_apellido].filter(Boolean).join(" ");
      return { ...r, firstName, lastName, fullName, documentId: entity?.document_id || fd.documento || "" };
    });
  }, [records, entities]);

  const filtered = useMemo(() => {
    if (!search.trim()) return enrichedRecords;
    const terms = normalize(search).split(/\s+/);
    return enrichedRecords.filter(r => {
      const target = normalize(r.fullName);
      return terms.every(t => target.includes(t));
    });
  }, [enrichedRecords, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o apellido..."
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
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Apellido</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Hora</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Correo Notificado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Cargando...</TableCell>
              </TableRow>
            ) : paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No hay registros</TableCell>
              </TableRow>
            ) : paged.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.firstName}</TableCell>
                <TableCell>{r.lastName}</TableCell>
                <TableCell className="text-muted-foreground">{r.documentId}</TableCell>
                <TableCell>{r.attendance_date}</TableCell>
                <TableCell>{r.attendance_time?.substring(0, 5)}</TableCell>
                <TableCell><Badge variant="outline">{r.record_type?.toUpperCase()}</Badge></TableCell>
                <TableCell>
                  <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                    {r.status === "present" ? "Presente" : r.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.notification_sent ? r.notification_email || "Sí" : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={filtered.length} itemsPerPage={PAGE_SIZE} />
      )}

      <p className="text-xs text-muted-foreground text-right">{filtered.length} registro(s)</p>
    </div>
  );
}

export default function AttendanceList() {
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

          <Tabs defaultValue="teachers">
            <TabsList className="mb-4">
              <TabsTrigger value="teachers">Docentes</TabsTrigger>
              <TabsTrigger value="students">Estudiantes</TabsTrigger>
              <TabsTrigger value="representatives">Representantes</TabsTrigger>
            </TabsList>

            <TabsContent value="teachers">
              <AttendanceTab entityType="teacher" />
            </TabsContent>
            <TabsContent value="students">
              <AttendanceTab entityType="student" />
            </TabsContent>
            <TabsContent value="representatives">
              <AttendanceTab entityType="representative" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
