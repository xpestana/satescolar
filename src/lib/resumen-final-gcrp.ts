import { formatResumenFinalGrade } from "@/lib/gradeLiteral";

type GcrpSubject = {
  name: string;
  evaluation_type: string;
};

type GcrpAssignment = {
  id: string;
  school_subjects: GcrpSubject | null;
};

type GradeRecord = {
  grade_value: string | null;
  adjustment_points: number;
  final_status: string | null;
};

function formatGradeAverage(values: number[]): string {
  if (values.length === 0) return "";
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const rounded = Math.round(avg * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function computeGpGradeAndGrupo(
  studentId: string,
  gcrpAssignmentIds: string[],
  gcrpAssignmentsData: GcrpAssignment[],
  gradeMap: Map<string, GradeRecord>,
  gradeKey: (sid: string, aid: string) => string,
): { gpGrade: string; grupoName: string } {
  if (gcrpAssignmentIds.length === 0) return { gpGrade: "", grupoName: "" };

  const numericGrades: number[] = [];
  const literalGrades: string[] = [];
  const grupoNames: string[] = [];

  for (const aid of gcrpAssignmentIds) {
    const assignment = gcrpAssignmentsData.find((a) => a.id === aid);
    const subj = assignment?.school_subjects;
    if (!subj) continue;

    if (subj.name) grupoNames.push(subj.name);

    const g = gradeMap.get(gradeKey(studentId, aid));
    if (!g) continue;

    const evalType = subj.evaluation_type || "numeric";
    const display = formatResumenFinalGrade(
      g.grade_value,
      g.adjustment_points,
      evalType,
    );
    if (!display) continue;

    if (evalType === "literal") {
      literalGrades.push(display);
      continue;
    }

    const num = parseFloat(display.replace(",", "."));
    if (!isNaN(num)) numericGrades.push(num);
  }

  const gpGrade =
    numericGrades.length > 0
      ? formatGradeAverage(numericGrades)
      : (literalGrades[0] ?? "");

  const grupoName = [...new Set(grupoNames)].join(", ");

  return { gpGrade, grupoName };
}
