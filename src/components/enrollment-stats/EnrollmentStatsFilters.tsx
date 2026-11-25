import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { SearchableSelect, type SearchableOption } from "@/components/forms/SearchableSelect";
import { gradeLabel, sectionDisplayName } from "@/lib/gradeLevels";
import { compareSections } from "@/lib/enrollmentStats/buildEnrollmentStats";
import type { SchoolYearOption } from "@/hooks/useSchoolYears";
import type { SchoolSection } from "@/hooks/useSchoolSections";

export const ALL_OPTION = "all";

export interface EnrollmentStatsFilterValue {
  yearId: string;
  gradeLevel: string;
  sectionId: string;
}

interface Props {
  years: SchoolYearOption[];
  sections: SchoolSection[];
  value: EnrollmentStatsFilterValue;
  onChange: (value: EnrollmentStatsFilterValue) => void;
}

export function EnrollmentStatsFilters({ years, sections, value, onChange }: Props) {
  const yearOptions = useMemo<SearchableOption[]>(
    () => years.map((y) => ({ value: y.id, label: `${y.year_range}${y.is_active ? " (Activo)" : ""}` })),
    [years],
  );

  const sorted = useMemo(() => [...sections].sort(compareSections), [sections]);

  const gradeOptions = useMemo<SearchableOption[]>(() => {
    const grades = [...new Set(sorted.map((s) => s.grade_level))];
    return [{ value: ALL_OPTION, label: "Todos los grados" }, ...grades.map((g) => ({ value: g, label: gradeLabel(g) }))];
  }, [sorted]);

  const sectionOptions = useMemo<SearchableOption[]>(
    () => [
      { value: ALL_OPTION, label: "Todas las secciones" },
      ...sorted
        .filter((s) => s.grade_level === value.gradeLevel)
        .map((s) => ({ value: s.id, label: `Sección ${sectionDisplayName(s)}` })),
    ],
    [sorted, value.gradeLevel],
  );

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label htmlFor="stats-year">Año Escolar</Label>
        <SearchableSelect
          id="stats-year"
          value={value.yearId}
          options={yearOptions}
          onChange={(yearId) => onChange({ ...value, yearId })}
          placeholder="Seleccione año"
          searchPlaceholder="Buscar año..."
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="stats-grade">Grado / Año</Label>
        <SearchableSelect
          id="stats-grade"
          value={value.gradeLevel}
          options={gradeOptions}
          onChange={(gradeLevel) => onChange({ ...value, gradeLevel, sectionId: ALL_OPTION })}
          placeholder="Todos los grados"
          searchPlaceholder="Buscar grado..."
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="stats-section">Sección</Label>
        <SearchableSelect
          id="stats-section"
          value={value.sectionId}
          options={sectionOptions}
          onChange={(sectionId) => onChange({ ...value, sectionId })}
          placeholder="Todas las secciones"
          searchPlaceholder="Buscar sección..."
          disabled={value.gradeLevel === ALL_OPTION}
        />
      </div>
    </div>
  );
}
