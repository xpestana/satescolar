/**
 * Builds the "matrícula por edad, sexo y documento" sheet from the rows already aggregated by
 * `get_enrollment_demographics` (one call per school year). Grade/section filters are applied
 * here, over the cached rows, so switching filters never hits the database.
 */
import {
  GRADE_LABELS,
  formatGradeSectionLabel,
  gradeLabel,
  resolveGradeLevelKind,
  type GradeLevelKind,
} from "@/lib/gradeLevels";
import { addToSexCount, emptySexCount } from "./sexCount";
import type {
  AgeCount,
  DemographicsBlock,
  DemographicsRow,
  DocumentCount,
  DocumentKind,
  EnrollmentStats,
  EnrollmentStatsFilter,
  StatsSection,
} from "./enrollmentStatsTypes";

const GRADE_ORDER = Object.keys(GRADE_LABELS);
const DOCUMENT_KINDS: readonly DocumentKind[] = ["CI", "CE", "P"];

const LEVEL_LABELS: Record<Exclude<GradeLevelKind, "unknown">, string> = {
  preschool: "Total Educación Inicial",
  primary: "Total Primaria",
  secondary: "Total Secundaria",
};

function gradeRank(gradeLevel: string): number {
  const index = GRADE_ORDER.indexOf(gradeLevel);
  return index === -1 ? GRADE_ORDER.length : index;
}

/** Grade order, then letter, with the técnica section right after its regular twin. */
export function compareSections(a: StatsSection, b: StatsSection): number {
  return (
    gradeRank(a.grade_level) - gradeRank(b.grade_level) ||
    (a.name ?? "").localeCompare(b.name ?? "", "es") ||
    Number(!!a.is_technical) - Number(!!b.is_technical)
  );
}

function toDocumentKind(value: string | null): DocumentKind | "unknown" {
  return DOCUMENT_KINDS.includes(value as DocumentKind) ? (value as DocumentKind) : "unknown";
}

/** Sorted distinct ages present in `rows`; `null` (no birth date) goes last. */
function collectAges(rows: DemographicsRow[]): (number | null)[] {
  const ages = new Set<number>();
  let hasNull = false;
  rows.forEach((row) => {
    if (row.age == null) hasNull = true;
    else ages.add(row.age);
  });
  const sorted: (number | null)[] = [...ages].sort((a, b) => a - b);
  return hasNull ? [...sorted, null] : sorted;
}

function buildBlock(
  key: string,
  title: string,
  rows: DemographicsRow[],
  ageScale: (number | null)[],
): DemographicsBlock {
  const ages = new Map<number | null, AgeCount>(
    ageScale.map((age) => [age, { age, counts: emptySexCount() }]),
  );
  const bySex = emptySexCount();
  const byDocument: DocumentCount = { CI: 0, CE: 0, P: 0, unknown: 0 };

  rows.forEach((row) => {
    const ageCount = ages.get(row.age ?? null);
    if (ageCount) addToSexCount(ageCount.counts, row.sex, row.total);
    addToSexCount(bySex, row.sex, row.total);
    byDocument[toDocumentKind(row.document_kind)] += row.total;
  });

  return { key, title, ages: [...ages.values()], bySex, byDocument };
}

function matchesFilter(section: StatsSection, filter: EnrollmentStatsFilter): boolean {
  if (filter.sectionId) return section.id === filter.sectionId;
  if (filter.gradeLevel) return section.grade_level === filter.gradeLevel;
  return true;
}

export function buildEnrollmentStats(
  rows: DemographicsRow[],
  sections: StatsSection[],
  filter: EnrollmentStatsFilter,
): EnrollmentStats {
  const scopedSections = sections.filter((s) => matchesFilter(s, filter)).sort(compareSections);
  const sectionById = new Map(scopedSections.map((s) => [s.id, s]));
  const scopedRows = rows.filter((row) => sectionById.has(row.section_id));
  const ageScale = collectAges(scopedRows);

  const rowsWhere = (predicate: (section: StatsSection) => boolean) =>
    scopedRows.filter((row) => predicate(sectionById.get(row.section_id)!));

  const sectionBlocks = scopedSections.map((section) =>
    buildBlock(
      `section:${section.id}`,
      formatGradeSectionLabel(section),
      rowsWhere((s) => s.id === section.id),
      ageScale,
    ),
  );

  const grades = [...new Set(scopedSections.map((s) => s.grade_level))];
  const gradeBlocks = filter.gradeLevel || filter.sectionId
    ? []
    : grades.map((grade) =>
        buildBlock(`grade:${grade}`, gradeLabel(grade), rowsWhere((s) => s.grade_level === grade), ageScale),
      );

  const groupBlocks: DemographicsBlock[] = [];
  const secondary = scopedSections.filter((s) => resolveGradeLevelKind(s.grade_level) === "secondary");
  if (secondary.length > 0) {
    const isSecondary = (s: StatsSection) => resolveGradeLevelKind(s.grade_level) === "secondary";
    groupBlocks.push(
      buildBlock("group:general", "Total Media General", rowsWhere((s) => isSecondary(s) && !s.is_technical), ageScale),
    );
    if (secondary.some((s) => s.is_technical)) {
      groupBlocks.push(
        buildBlock("group:technical", "Total Media Técnica", rowsWhere((s) => isSecondary(s) && !!s.is_technical), ageScale),
      );
    }
  }
  const levels = new Set(scopedSections.map((s) => resolveGradeLevelKind(s.grade_level)));
  if (levels.size > 1) {
    (Object.keys(LEVEL_LABELS) as (keyof typeof LEVEL_LABELS)[])
      .filter((level) => levels.has(level))
      .forEach((level) =>
        groupBlocks.push(
          buildBlock(
            `level:${level}`,
            LEVEL_LABELS[level],
            rowsWhere((s) => resolveGradeLevelKind(s.grade_level) === level),
            ageScale,
          ),
        ),
      );
  }

  const total = buildBlock("total", "Total", scopedRows, ageScale);

  return {
    sectionIds: scopedSections.map((s) => s.id),
    sectionBlocks,
    gradeBlocks,
    groupBlocks,
    total,
    hasUnknownSex: total.bySex.unknown > 0,
    hasUnknownAge: ageScale.includes(null),
  };
}
