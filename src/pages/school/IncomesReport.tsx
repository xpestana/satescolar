import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DashboardSkeleton } from "@/components/ui/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3 } from "lucide-react";

interface IncomeRow {
  id: string;
  operacion: number;
  mes: string;
  fecha: string;
  rif: string;
  nombre: string;
  factura: string;
  control: string;
  total: number;
  mensualidad: number;
  inscripcion: number;
  seguro: number;
  otros: number;
}

const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const formatMonthLabel = (yyyymm: string) => {
  const [year, month] = yyyymm.split("-");
  return `${MONTH_NAMES[parseInt(month) - 1]} ${year}`;
};

export default function IncomesReport() {
  const { schoolId, isLoading: schoolLoading } = useSchoolId();
  const [selectedYearId, setSelectedYearId] = useState<string>("");
  const [filterMonth, setFilterMonth] = useState<string>("");
  const [filters, setFilters] = useState({
    fecha: "", rif: "", nombre: "",
    factura: "", control: "", total: "",
    mensualidad: "", inscripcion: "", seguro: "", otros: "",
  });

  const { data: years = [] } = useQuery({
    queryKey: ["school-years-all", schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from("school_years")
        .select("id, year_range, is_active")
        .eq("school_id", schoolId!)
        .order("year_range", { ascending: false });
      return data || [];
    },
    enabled: !!schoolId,
  });

  useEffect(() => {
    if ((years as any[]).length > 0 && !selectedYearId) {
      const active = (years as any[]).find((y) => y.is_active);
      setSelectedYearId(active?.id ?? (years as any[])[0].id);
    }
  }, [years, selectedYearId]);

  // Reset month filter when year changes
  useEffect(() => { setFilterMonth(""); }, [selectedYearId]);

  const { data: rawPayments = [], isLoading } = useQuery({
    queryKey: ["incomes-report", schoolId, selectedYearId],
    queryFn: async () => {
      const { data } = (await supabase.from("payments").select(`
        id, payment_date, invoice_number, control_number,
        invoice_rif, invoice_name, total_amount_ves,
        payment_method_entries(reference_code, method, amount_ves),
        payment_items(
          amount_ves,
          payment_plan_concepts(
            payment_concepts(concept_type)
          )
        ),
        payment_others(amount_ves)
      `)
        .eq("school_id", schoolId!)
        .eq("school_year_id", selectedYearId)
        .neq("status", "voided")
        // created_at ASC para que el N° de operación sea estable e inamovible
        .order("created_at", { ascending: true })) as any;
      return (data || []) as any[];
    },
    enabled: !!schoolId && !!selectedYearId,
  });

  // Available months derived from raw data (for the month filter dropdown)
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    (rawPayments as any[]).forEach((p) => {
      if (p.payment_date) months.add(p.payment_date.substring(0, 7));
    });
    return Array.from(months).sort();
  }, [rawPayments]);

  // Transform rows with sequential numbering per month (assigned before filtering)
  const rows: IncomeRow[] = useMemo(() => {
    const monthCounters: Record<string, number> = {};
    return (rawPayments as any[]).map((p) => {
      const entries: any[] = p.payment_method_entries || [];
      const items: any[] = p.payment_items || [];
      const others: any[] = p.payment_others || [];
      const mes = p.payment_date?.substring(0, 7) || "";

      monthCounters[mes] = (monthCounters[mes] || 0) + 1;

      const byType = (type: string) =>
        items
          .filter((i) => i.payment_plan_concepts?.payment_concepts?.concept_type === type)
          .reduce((s: number, i: any) => s + (i.amount_ves || 0), 0);

      return {
        id: p.id,
        operacion: monthCounters[mes],
        mes,
        fecha: p.payment_date || "",
        rif: p.invoice_rif || "",
        nombre: p.invoice_name || "",
        factura: p.invoice_number || "",
        control: p.control_number || "",
        total: p.total_amount_ves || 0,
        mensualidad: byType("mensualidad"),
        inscripcion: byType("inscripcion"),
        seguro: byType("seguro_escolar"),
        otros: others.reduce((s: number, o: any) => s + (o.amount_ves || 0), 0),
      };
    });
  }, [rawPayments]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (filterMonth && r.mes !== filterMonth) return false;
    const matchText = (val: string, fil: string) => !fil || val.toLowerCase().includes(fil.toLowerCase());
    const matchNum = (val: number, fil: string) => !fil || val >= parseFloat(fil);
    return (
      matchText(r.fecha, filters.fecha) &&
      matchText(r.rif, filters.rif) &&
      matchText(r.nombre, filters.nombre) &&
      matchText(r.factura, filters.factura) &&
      matchText(r.control, filters.control) &&
      matchNum(r.total, filters.total) &&
      matchNum(r.mensualidad, filters.mensualidad) &&
      matchNum(r.inscripcion, filters.inscripcion) &&
      matchNum(r.seguro, filters.seguro) &&
      matchNum(r.otros, filters.otros)
    );
  }), [rows, filters, filterMonth]);

  const totals = useMemo(() => filtered.reduce(
    (acc, r) => ({
      total: acc.total + r.total,
      mensualidad: acc.mensualidad + r.mensualidad,
      inscripcion: acc.inscripcion + r.inscripcion,
      seguro: acc.seguro + r.seguro,
      otros: acc.otros + r.otros,
    }),
    { total: 0, mensualidad: 0, inscripcion: 0, seguro: 0, otros: 0 }
  ), [filtered]);

  const fmt = (n: number) => n.toLocaleString("es-VE", { minimumFractionDigits: 2 });
  const setFilter = (k: keyof typeof filters) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFilters((prev) => ({ ...prev, [k]: e.target.value }));

  if (schoolLoading || !schoolId) return <DashboardLayout><DashboardSkeleton /></DashboardLayout>;

  return (
    <DashboardLayout>
      <PageHeader title="Ingresos" breadcrumbs={[{ label: "Administrativo" }, { label: "Ingresos" }]} />

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Año escolar:</span>
          <Select value={selectedYearId} onValueChange={setSelectedYearId}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Seleccionar año" />
            </SelectTrigger>
            <SelectContent>
              {(years as any[]).map((y) => (
                <SelectItem key={y.id} value={y.id}>{y.year_range}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(years as any[]).find((y) => y.id === selectedYearId)?.is_active && (
            <Badge variant="secondary">Año activo</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Mes:</span>
          <Select value={filterMonth || "__all__"} onValueChange={(v) => setFilterMonth(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Todos los meses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos los meses</SelectItem>
              {availableMonths.map((m) => (
                <SelectItem key={m} value={m}>{formatMonthLabel(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        {[
          { label: "Total Ingresos", value: totals.total },
          { label: "Mensualidad", value: totals.mensualidad },
          { label: "Inscripción", value: totals.inscripcion },
          { label: "Seguro Escolar", value: totals.seguro },
          { label: "Otros", value: totals.otros },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className="text-base font-bold font-mono">{fmt(value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Detalle de Pagos
            {!isLoading && <Badge variant="outline">{filtered.length} registros</Badge>}
            {filterMonth && <Badge variant="secondary">{formatMonthLabel(filterMonth)}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">N°</TableHead>
                    <TableHead className="min-w-[100px]">Fecha</TableHead>
                    <TableHead className="min-w-[110px]">RIF</TableHead>
                    <TableHead className="min-w-[160px]">Nombre / Razón Social</TableHead>
                    <TableHead className="min-w-[110px]">N° Factura</TableHead>
                    <TableHead className="min-w-[110px]">N° Control</TableHead>
                    <TableHead className="min-w-[130px] text-right">Total Ingresos</TableHead>
                    <TableHead className="min-w-[110px] text-right">Mensualidad</TableHead>
                    <TableHead className="min-w-[110px] text-right">Inscripción</TableHead>
                    <TableHead className="min-w-[120px] text-right">Seguro Escolar</TableHead>
                    <TableHead className="min-w-[100px] text-right">Otros</TableHead>
                  </TableRow>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="py-1 font-normal" />
                    <TableHead className="py-1 font-normal">
                      <Input placeholder="Fecha..." className="h-7 text-xs" value={filters.fecha} onChange={setFilter("fecha")} />
                    </TableHead>
                    <TableHead className="py-1 font-normal">
                      <Input placeholder="RIF..." className="h-7 text-xs" value={filters.rif} onChange={setFilter("rif")} />
                    </TableHead>
                    <TableHead className="py-1 font-normal">
                      <Input placeholder="Nombre..." className="h-7 text-xs" value={filters.nombre} onChange={setFilter("nombre")} />
                    </TableHead>
                    <TableHead className="py-1 font-normal">
                      <Input placeholder="N° factura..." className="h-7 text-xs" value={filters.factura} onChange={setFilter("factura")} />
                    </TableHead>
                    <TableHead className="py-1 font-normal">
                      <Input placeholder="N° control..." className="h-7 text-xs" value={filters.control} onChange={setFilter("control")} />
                    </TableHead>
                    <TableHead className="py-1 font-normal">
                      <Input placeholder="≥ monto" type="number" className="h-7 text-xs" value={filters.total} onChange={setFilter("total")} />
                    </TableHead>
                    <TableHead className="py-1 font-normal">
                      <Input placeholder="≥ monto" type="number" className="h-7 text-xs" value={filters.mensualidad} onChange={setFilter("mensualidad")} />
                    </TableHead>
                    <TableHead className="py-1 font-normal">
                      <Input placeholder="≥ monto" type="number" className="h-7 text-xs" value={filters.inscripcion} onChange={setFilter("inscripcion")} />
                    </TableHead>
                    <TableHead className="py-1 font-normal">
                      <Input placeholder="≥ monto" type="number" className="h-7 text-xs" value={filters.seguro} onChange={setFilter("seguro")} />
                    </TableHead>
                    <TableHead className="py-1 font-normal">
                      <Input placeholder="≥ monto" type="number" className="h-7 text-xs" value={filters.otros} onChange={setFilter("otros")} />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center text-muted-foreground py-12">
                        No hay pagos registrados para este período
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs font-mono text-muted-foreground">{r.operacion}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {r.fecha ? new Date(r.fecha + "T12:00:00").toLocaleDateString("es-VE") : "—"}
                        </TableCell>
                        <TableCell className="text-xs font-mono">{r.rif || "—"}</TableCell>
                        <TableCell className="text-sm">{r.nombre || "—"}</TableCell>
                        <TableCell className="text-xs font-mono">{r.factura || "—"}</TableCell>
                        <TableCell className="text-xs font-mono">{r.control || "—"}</TableCell>
                        <TableCell className="text-sm text-right font-medium">{fmt(r.total)}</TableCell>
                        <TableCell className="text-xs text-right">{r.mensualidad > 0 ? fmt(r.mensualidad) : "—"}</TableCell>
                        <TableCell className="text-xs text-right">{r.inscripcion > 0 ? fmt(r.inscripcion) : "—"}</TableCell>
                        <TableCell className="text-xs text-right">{r.seguro > 0 ? fmt(r.seguro) : "—"}</TableCell>
                        <TableCell className="text-xs text-right">{r.otros > 0 ? fmt(r.otros) : "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
