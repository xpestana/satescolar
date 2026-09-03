import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useSchoolYearSelection } from "@/hooks/useSchoolYearSelection";
import { usePaymentsReportData } from "@/hooks/payments/usePaymentsReportData";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { DashboardSkeleton } from "@/components/ui/loading-skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SchoolYearSelect } from "@/components/payments/SchoolYearSelect";
import { PaymentsReportFilters } from "@/components/payments/PaymentsReportFilters";
import { PaymentsReportTable } from "@/components/payments/PaymentsReportTable";
import { exportPaymentsReportExcel } from "@/lib/paymentsReportExcel";
import { Download, ChevronLeft, ChevronRight } from "lucide-react";
import {
  EMPTY_FILTERS,
  PAGE_SIZE,
  filterPaymentRows,
  hasActiveFilters,
  pageCount,
  paginate,
  sortPaymentRows,
  summarizePaymentRows,
  type PaymentsReportFilters as Filters,
  type PaymentsReportSortKey,
  type SortDirection,
} from "@/lib/paymentsReport";

const fmt = (n: number) => n.toLocaleString("es-VE", { minimumFractionDigits: 2 });

/**
 * Reporte de Pagos (`/pagos/reporte`): consulta transversal de todo lo cobrado, descontado y
 * exonerado en un año escolar, con búsqueda, filtros avanzados, orden por columna, paginación
 * y exportación a Excel de lo que esté en pantalla.
 */
export default function PaymentsReport() {
  const { schoolId, isLoading: schoolLoading } = useSchoolId();
  const { schoolYears, selectedYearId, setSelectedYearId, selectedYear, isLoading: yearsLoading } =
    useSchoolYearSelection(schoolId);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortKey, setSortKey] = useState<PaymentsReportSortKey>("invoiceNumber");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);

  const { rows, isLoading, plans, methods } = usePaymentsReportData(schoolId, selectedYearId);

  const { data: schoolName = "" } = useQuery({
    queryKey: ["school-name", schoolId],
    queryFn: async () => {
      const { data } = await supabase.from("schools").select("name").eq("id", schoolId!).maybeSingle();
      return data?.name ?? "";
    },
    enabled: !!schoolId,
  });

  // Catálogos derivados de los propios datos, para no ofrecer filtros vacíos
  const conceptTypes = useMemo(
    () => Array.from(new Set(rows.map((r) => r.conceptType).filter(Boolean))).sort(),
    [rows],
  );
  const currencies = useMemo(
    () => Array.from(new Set(rows.map((r) => r.conceptCurrency).filter(Boolean))).sort(),
    [rows],
  );

  const filtered = useMemo(() => filterPaymentRows(rows, filters), [rows, filters]);
  const sorted = useMemo(() => sortPaymentRows(filtered, sortKey, sortDirection), [filtered, sortKey, sortDirection]);
  const totals = useMemo(() => summarizePaymentRows(sorted), [sorted]);
  const totalPages = pageCount(sorted.length);
  const visible = useMemo(() => paginate(sorted, page), [sorted, page]);

  const activeFilters = hasActiveFilters(filters);
  const activeFilterCount = useMemo(
    () => (Object.keys(EMPTY_FILTERS) as (keyof Filters)[])
      .filter((key) => key !== "search" && filters[key] !== EMPTY_FILTERS[key]).length,
    [filters],
  );

  // Volver a la primera página cuando cambian los datos mostrados
  useEffect(() => { setPage(1); }, [filters, sortKey, sortDirection, selectedYearId]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const handleSort = (key: PaymentsReportSortKey) => {
    if (key === sortKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  };

  const handleExport = () => {
    const safe = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
    const yearLabel = selectedYear?.year_range ?? "";
    const parts = ["Reporte-de-Pagos", safe(yearLabel), activeFilters ? "filtrado" : "todos"].filter(Boolean);
    exportPaymentsReportExcel(
      sorted,
      totals,
      {
        schoolName,
        yearLabel,
        filtersLabel: activeFilters ? "Con filtros aplicados" : "Sin filtros (todos los pagos del año)",
      },
      parts.join("_"),
    );
  };

  if (schoolLoading || !schoolId) return <DashboardLayout><DashboardSkeleton /></DashboardLayout>;

  return (
    <DashboardLayout>
      <PageHeader
        title="Reporte de Pagos"
        breadcrumbs={[{ label: "Administrativo", href: "/pagos" }, { label: "Reporte de Pagos" }]}
      />

      <SchoolYearSelect
        years={schoolYears}
        value={selectedYearId}
        onChange={setSelectedYearId}
        isLoading={yearsLoading}
        inactiveWarning="Está consultando el año {year}, que no es el año en curso."
      />

      <PaymentsReportFilters
        filters={filters}
        onChange={setFilters}
        plans={plans}
        methods={methods}
        conceptTypes={conceptTypes}
        currencies={currencies}
        activeCount={activeFilterCount}
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Líneas</p><p className="text-lg font-bold">{totals.rows}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Facturas</p><p className="text-lg font-bold">{totals.payments}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Cobrado (VES)</p><p className="text-lg font-bold">{fmt(totals.amountVes)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Descuentos</p><p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{fmt(totals.discountVes)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Exonerado</p><p className="text-lg font-bold text-purple-700 dark:text-purple-400">{fmt(totals.exoneratedVes)}</p></CardContent></Card>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {sorted.length === 0
            ? "Sin resultados"
            : `Mostrando ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, sorted.length)} de ${sorted.length} línea(s)`}
          {activeFilters && " (filtrado)"}
        </p>
        <Button variant="outline" className="gap-2" onClick={handleExport} disabled={sorted.length === 0}>
          <Download className="h-4 w-4" />
          Descargar Excel
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <PaymentsReportTable
              rows={visible}
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSort={handleSort}
            />
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" className="gap-1" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
          <Button variant="outline" size="sm" className="gap-1" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Siguiente
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </DashboardLayout>
  );
}
