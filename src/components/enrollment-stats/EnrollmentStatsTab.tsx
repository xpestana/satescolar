import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useSchoolYears } from "@/hooks/useSchoolYears";
import { useSchoolSections } from "@/hooks/useSchoolSections";
import { usePdfSchoolBranding } from "@/hooks/usePdfSchoolBranding";
import { useEnrollmentStatsReport } from "@/hooks/useEnrollmentStatsReport";
import { formatGradeSectionLabel, gradeLabel } from "@/lib/gradeLevels";
import { exportEnrollmentStatsExcel } from "@/lib/enrollmentStats/enrollmentStatsExcel";
import { exportEnrollmentStatsPdf } from "@/lib/enrollmentStats/enrollmentStatsPdf";
import type { EnrollmentStatsExportMeta, ReportTable } from "@/lib/enrollmentStats/reportTables";
import { ALL_OPTION, EnrollmentStatsFilters, type EnrollmentStatsFilterValue } from "./EnrollmentStatsFilters";
import { MissingDemographicsAlert } from "./MissingDemographicsAlert";
import { ReportTableCard } from "./ReportTableCard";

function TableGrid({ tables, highlightLast = false }: { tables: ReportTable[]; highlightLast?: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {tables.map((table, i) => (
        <ReportTableCard
          key={`${table.title}-${i}`}
          table={table}
          variant={highlightLast && i === tables.length - 1 ? "total" : "default"}
        />
      ))}
    </div>
  );
}

/** "Estadística de matrícula": enrolled students by age, sex and document, plus form answers by sex. */
export function EnrollmentStatsTab() {
  const { toast } = useToast();
  const { schoolId } = useSchoolId();
  const { data: years = [] } = useSchoolYears(schoolId);
  const { data: sections = [], isLoading: sectionsLoading } = useSchoolSections(schoolId);
  const branding = usePdfSchoolBranding(schoolId);
  const [filters, setFilters] = useState<EnrollmentStatsFilterValue>({
    yearId: "",
    gradeLevel: ALL_OPTION,
    sectionId: ALL_OPTION,
  });
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);

  // Starts on the active year, like Notas.
  useEffect(() => {
    if (filters.yearId || years.length === 0) return;
    const initial = years.find((y) => y.is_active) ?? years[0];
    setFilters((f) => ({ ...f, yearId: initial.id }));
  }, [years, filters.yearId]);

  const statsFilter = useMemo(
    () => ({
      gradeLevel: filters.gradeLevel === ALL_OPTION ? null : filters.gradeLevel,
      sectionId: filters.sectionId === ALL_OPTION ? null : filters.sectionId,
    }),
    [filters.gradeLevel, filters.sectionId],
  );

  const { stats, sheets, isLoading, error } = useEnrollmentStatsReport(schoolId, filters.yearId, sections, statsFilter);
  const [demographicsSheet, answersSheet] = sheets;
  const sectionCount = stats.sectionBlocks.length;

  const year = years.find((y) => y.id === filters.yearId);
  const selectedSection = sections.find((s) => s.id === statsFilter.sectionId);
  const scopeLabel = selectedSection
    ? formatGradeSectionLabel(selectedSection)
    : statsFilter.gradeLevel
      ? gradeLabel(statsFilter.gradeLevel)
      : "Todos los grados";
  const today = new Date().toLocaleDateString("es-VE", { day: "2-digit", month: "2-digit", year: "numeric" });

  const exportMeta: EnrollmentStatsExportMeta = {
    schoolName: branding.schoolInfo?.name,
    yearLabel: year?.year_range,
    scopeLabel,
    dateLabel: today,
  };
  const filename = `Matricula_${year?.year_range ?? ""}_${scopeLabel}`.replace(/[^\w-]+/g, "_");

  const runExport = async (kind: "excel" | "pdf") => {
    setExporting(kind);
    try {
      if (kind === "excel") exportEnrollmentStatsExcel(sheets, exportMeta, filename);
      else await exportEnrollmentStatsPdf(sheets, exportMeta, branding, filename);
    } catch (e) {
      toast({
        title: "No se pudo exportar",
        description: e instanceof Error ? e.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setExporting(null);
    }
  };

  const loading = isLoading || sectionsLoading || !filters.yearId;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="flex-1">
          <EnrollmentStatsFilters years={years} sections={sections} value={filters} onChange={setFilters} />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={loading || !!exporting} onClick={() => runExport("excel")}>
            {exporting === "excel" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-1 h-4 w-4" />}
            Excel
          </Button>
          <Button variant="outline" size="sm" disabled={loading || !!exporting} onClick={() => runExport("pdf")}>
            {exporting === "pdf" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileText className="mr-1 h-4 w-4" />}
            PDF
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Edad cumplida al {today}. Documento: CI = V/E, CE = cédula escolar, Pasaporte = P.
      </p>

      {error ? (
        <p className="text-sm text-destructive">No se pudo cargar la estadística: {error.message}</p>
      ) : loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-72 w-full" />
          ))}
        </div>
      ) : sectionCount === 0 ? (
        <p className="text-sm text-muted-foreground">No hay secciones para los filtros seleccionados.</p>
      ) : (
        <>
          <MissingDemographicsAlert stats={stats} />

          <section className="space-y-3">
            <h3 className="text-base font-semibold">Por sección</h3>
            <TableGrid tables={demographicsSheet.tables.slice(0, sectionCount)} />
          </section>

          <section className="space-y-3">
            <h3 className="text-base font-semibold">Totales</h3>
            <TableGrid tables={demographicsSheet.tables.slice(sectionCount)} highlightLast />
          </section>

          <section className="space-y-3">
            <h3 className="text-base font-semibold">{answersSheet.title}</h3>
            {answersSheet.tables.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                El formulario de estudiantes no tiene campos de selección o casillas para contar.
              </p>
            ) : (
              <TableGrid tables={answersSheet.tables} />
            )}
          </section>
        </>
      )}
    </div>
  );
}
