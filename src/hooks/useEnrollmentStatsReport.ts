import { useMemo } from "react";
import { buildAnswerBreakdown } from "@/lib/enrollmentStats/buildAnswerBreakdown";
import { buildEnrollmentStats } from "@/lib/enrollmentStats/buildEnrollmentStats";
import type { EnrollmentStatsFilter } from "@/lib/enrollmentStats/enrollmentStatsTypes";
import { buildReportSheets } from "@/lib/enrollmentStats/reportTables";
import {
  useEnrollmentAnswerBreakdown,
  useEnrollmentDemographics,
  useStudentChoiceFields,
} from "@/hooks/useEnrollmentStatsData";
import type { SchoolSection } from "@/hooks/useSchoolSections";

/**
 * View model of the "Estadística de matrícula" tab: fetches the year aggregates once and derives
 * every block for the current grade/section filter on the client.
 */
export function useEnrollmentStatsReport(
  schoolId: string | null | undefined,
  schoolYearId: string,
  sections: SchoolSection[],
  filter: EnrollmentStatsFilter,
) {
  const demographics = useEnrollmentDemographics(schoolId, schoolYearId);
  const answers = useEnrollmentAnswerBreakdown(schoolId, schoolYearId);
  const choiceFields = useStudentChoiceFields(schoolId);

  const stats = useMemo(
    () => buildEnrollmentStats(demographics.data ?? [], sections, filter),
    [demographics.data, sections, filter],
  );

  const fieldBreakdown = useMemo(() => {
    return buildAnswerBreakdown(answers.data ?? [], choiceFields.data ?? [], new Set(stats.sectionIds));
  }, [answers.data, choiceFields.data, stats.sectionIds]);

  const sheets = useMemo(() => buildReportSheets(stats, fieldBreakdown), [stats, fieldBreakdown]);

  return {
    stats,
    sheets,
    isLoading: demographics.isLoading || answers.isLoading || choiceFields.isLoading,
    error: demographics.error ?? answers.error ?? choiceFields.error,
  };
}
