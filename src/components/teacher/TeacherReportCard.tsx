import { useState, useEffect, useCallback, useMemo } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, FileText, Info, Save } from "lucide-react";
import { toast } from "sonner";
import PrimaryFinalReportModal from "@/components/grades/PrimaryFinalReportModal";
import PreschoolFinalReportModal from "@/components/grades/PreschoolFinalReportModal";

const PRIMARY_GRADES = new Set([
  "1_grado", "2_grado", "3_grado", "4_grado", "5_grado", "6_grado",
]);

const PRESCHOOL_GRADES = new Set([
  "pre_maternal", "maternal", "i_nivel", "ii_nivel", "iii_nivel",
]);

const STATUS_OPTIONS = [
  { value: "aprobado", label: "Aprobado" },
  { value: "no_aprobado", label: "No Aprobado" },
  { value: "no_cursante", label: "No Cursante" },
  { value: "pp", label: "PP" },
];

interface ExtraFields {
  attendance_count: number;
  absence_count: number;
  final_status: string;
}

const DEFAULT_EXTRA: ExtraFields = { attendance_count: 0, absence_count: 0, final_status: "" };

interface StudentRow {
  student_id: string;
  student_name: string;
  document_id: string | null;
}

interface TeacherReportCardProps {
  assignmentId: string;
  schoolId: string;
  gradeLevel: string;
  momento: number;
  students: StudentRow[];
}

export function TeacherReportCard({
  assignmentId,
  schoolId,
  gradeLevel,
  momento,
  students,
}: TeacherReportCardProps) {
  const queryClient = useQueryClient();
  const isPrimary = PRIMARY_GRADES.has(gradeLevel);
  const isPreschool = PRESCHOOL_GRADES.has(gradeLevel);
  const tableName = isPrimary ? "primary_final_reports" : "preschool_final_reports";

  const [literals, setLiterals] = useState<Record<string, string>>({});
  const [dbLiterals, setDbLiterals] = useState<Record<string, string>>({});
  const [extraFields, setExtraFields] = useState<Record<string, ExtraFields>>({});
  const [dbExtraFields, setDbExtraFields] = useState<Record<string, ExtraFields>>({});
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [savingAll, setSavingAll] = useState(false);

  // Report modal
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportModalStudent, setReportModalStudent] = useState<{ id: string; name: string } | null>(null);

  // Grades config
  const { data: gradesConfig } = useQuery({
    queryKey: ["grades-config", schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from("grades_config")
        .select("*")
        .eq("school_id", schoolId)
        .maybeSingle();
      return data;
    },
    enabled: !!schoolId,
  });

  const reportType = isPrimary
    ? ((gradesConfig?.primary_report_type || "descriptive") as "descriptive" | "indicators")
    : ((gradesConfig?.preschool_report_type || "descriptive") as "descriptive" | "indicators");

  // Fetch existing reports
  const { data: reports = [], isLoading } = useQuery({
    queryKey: [`${tableName}-teacher`, assignmentId, momento],
    queryFn: async () => {
      const { data } = await supabase
        .from(tableName as any)
        .select("*")
        .eq("assignment_id", assignmentId)
        .eq("momento", momento);
      return (data as any[]) || [];
    },
    enabled: !!assignmentId,
  });

  // Initialize state from reports
  useEffect(() => {
    if (!students.length) return;
    const lits: Record<string, string> = {};
    const dbLits: Record<string, string> = {};
    const extra: Record<string, ExtraFields> = {};
    const dbExtra: Record<string, ExtraFields> = {};

    for (const s of students) {
      const key = s.student_id;
      const existing = reports.find((r: any) => r.student_id === s.student_id);
      if (existing) {
        lits[key] = existing.literal || "";
        dbLits[key] = existing.literal || "";
        const ef: ExtraFields = {
          attendance_count: existing.attendance_count ?? 0,
          absence_count: existing.absence_count ?? 0,
          final_status: existing.final_status || "",
        };
        extra[key] = { ...ef };
        dbExtra[key] = { ...ef };
      } else {
        lits[key] = "";
        dbLits[key] = "";
        extra[key] = { ...DEFAULT_EXTRA };
        dbExtra[key] = { ...DEFAULT_EXTRA };
      }
    }
    setLiterals(lits);
    setDbLiterals(dbLits);
    setExtraFields(extra);
    setDbExtraFields(dbExtra);
  }, [students, reports]);

  const handleLiteralChange = (studentId: string, value: string) => {
    const cleaned = value.toUpperCase().replace(/[^A-E]/g, "").slice(0, 1);
    setLiterals(prev => ({ ...prev, [studentId]: cleaned }));
  };

  const handleExtraChange = (studentId: string, field: keyof ExtraFields, value: string | number) => {
    setExtraFields(prev => ({
      ...prev,
      [studentId]: { ...(prev[studentId] || DEFAULT_EXTRA), [field]: value },
    }));
  };

  const isDirty = useCallback((studentId: string): boolean => {
    const litDirty = (literals[studentId] || "") !== (dbLiterals[studentId] || "");
    const ef = extraFields[studentId] || DEFAULT_EXTRA;
    const dbEf = dbExtraFields[studentId] || DEFAULT_EXTRA;
    const extraDirty = ef.attendance_count !== dbEf.attendance_count ||
      ef.absence_count !== dbEf.absence_count ||
      ef.final_status !== dbEf.final_status;
    return litDirty || extraDirty;
  }, [literals, dbLiterals, extraFields, dbExtraFields]);

  const totalDirty = useMemo(() => students.filter(s => isDirty(s.student_id)).length, [students, isDirty]);

  const saveReport = useCallback(async (studentId: string) => {
    const key = studentId;
    if (!isDirty(key)) return;

    setSavingKeys(prev => new Set(prev).add(key));
    try {
      const literal = literals[key] || "";
      const ef = extraFields[key] || DEFAULT_EXTRA;
      const payload = {
        student_id: studentId,
        assignment_id: assignmentId,
        school_id: schoolId,
        momento,
        literal,
        attendance_count: ef.attendance_count,
        absence_count: ef.absence_count,
        final_status: ef.final_status || null,
        updated_at: new Date().toISOString(),
      };
      await supabase
        .from(tableName as any)
        .upsert(payload as any, { onConflict: "student_id,assignment_id,momento" });

      setDbLiterals(prev => ({ ...prev, [key]: literal }));
      setDbExtraFields(prev => ({ ...prev, [key]: { ...ef } }));

      setSavedKeys(prev => {
        const next = new Set(prev).add(key);
        setTimeout(() => setSavedKeys(p => { const n = new Set(p); n.delete(key); return n; }), 1500);
        return next;
      });
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSavingKeys(prev => { const n = new Set(prev); n.delete(key); return n; });
    }
  }, [literals, extraFields, dbLiterals, dbExtraFields, assignmentId, schoolId, momento, tableName, isDirty]);

  const saveAll = useCallback(async () => {
    if (totalDirty === 0) return;
    setSavingAll(true);
    try {
      const upserts: any[] = [];
      for (const s of students) {
        if (!isDirty(s.student_id)) continue;
        const ef = extraFields[s.student_id] || DEFAULT_EXTRA;
        upserts.push({
          student_id: s.student_id,
          assignment_id: assignmentId,
          school_id: schoolId,
          momento,
          literal: literals[s.student_id] || "",
          attendance_count: ef.attendance_count,
          absence_count: ef.absence_count,
          final_status: ef.final_status || null,
          updated_at: new Date().toISOString(),
        });
      }
      if (upserts.length > 0) {
        await supabase
          .from(tableName as any)
          .upsert(upserts as any, { onConflict: "student_id,assignment_id,momento" });
      }
      const newDbLits = { ...dbLiterals };
      const newDbExtra = { ...dbExtraFields };
      for (const u of upserts) {
        newDbLits[u.student_id] = u.literal;
        newDbExtra[u.student_id] = {
          attendance_count: u.attendance_count,
          absence_count: u.absence_count,
          final_status: u.final_status || "",
        };
      }
      setDbLiterals(newDbLits);
      setDbExtraFields(newDbExtra);
      toast.success(`${upserts.length} registros guardados`);
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSavingAll(false);
    }
  }, [totalDirty, students, isDirty, literals, extraFields, assignmentId, schoolId, momento, tableName, dbLiterals, dbExtraFields]);

  const hasReport = (studentId: string) =>
    reports.some((r: any) => r.student_id === studentId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">
              {isPrimary ? "Boleta de Primaria" : "Boleta de Preescolar"}
            </h3>
            <Badge variant="secondary" className="text-xs">Momento {momento}</Badge>
          </div>
          {totalDirty > 0 && (
            <Button size="sm" onClick={saveAll} disabled={savingAll}>
              {savingAll ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Guardar Todo ({totalDirty})
            </Button>
          )}
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">Estudiante</TableHead>
                <TableHead className="min-w-[100px]">Cédula</TableHead>
                <TableHead className="text-center min-w-[80px]">Informe</TableHead>
                <TableHead className="text-center min-w-[70px]">Literal</TableHead>
                <TableHead className="text-center min-w-[90px]">Asistencias</TableHead>
                <TableHead className="text-center min-w-[90px]">Inasistencias</TableHead>
                <TableHead className="text-center min-w-[120px]">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map(s => {
                const key = s.student_id;
                const isSaving = savingKeys.has(key);
                const isSaved = savedKeys.has(key);
                const dirty = isDirty(key);
                const ef = extraFields[key] || DEFAULT_EXTRA;
                const literalVal = literals[key] || "";
                const studentHasReport = hasReport(key);

                return (
                  <TableRow key={key}>
                    <TableCell className="font-medium">{s.student_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.document_id || "—"}</TableCell>
                    <TableCell className="text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              setReportModalStudent({ id: s.student_id, name: s.student_name });
                              setReportModalOpen(true);
                            }}
                          >
                            <FileText className={`h-4 w-4 ${studentHasReport ? "text-primary" : ""}`} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="text-xs">Redactar Informe</TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="relative inline-block">
                        <Input
                          type="text"
                          maxLength={1}
                          value={literalVal}
                          onChange={(e) => handleLiteralChange(s.student_id, e.target.value)}
                          onBlur={() => saveReport(s.student_id)}
                          className={`h-8 w-12 text-center text-sm font-semibold uppercase mx-auto ${dirty ? "border-orange-400 ring-1 ring-orange-300" : ""}`}
                          placeholder="—"
                        />
                        {dirty && !isSaving && !isSaved && (
                          <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-orange-400" />
                        )}
                        {isSaving && (
                          <Loader2 className="absolute top-1.5 right-0.5 h-3 w-3 animate-spin text-muted-foreground" />
                        )}
                        {isSaved && !isSaving && (
                          <Check className="absolute top-1.5 right-0.5 h-3 w-3 text-green-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        min={0}
                        value={ef.attendance_count}
                        onChange={(e) => handleExtraChange(s.student_id, "attendance_count", Math.max(0, parseInt(e.target.value) || 0))}
                        onBlur={() => saveReport(s.student_id)}
                        className="h-8 w-16 text-xs text-center mx-auto"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        min={0}
                        value={ef.absence_count}
                        onChange={(e) => handleExtraChange(s.student_id, "absence_count", Math.max(0, parseInt(e.target.value) || 0))}
                        onBlur={() => saveReport(s.student_id)}
                        className="h-8 w-16 text-xs text-center mx-auto"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Select
                        value={ef.final_status}
                        onValueChange={(v) => {
                          handleExtraChange(s.student_id, "final_status", v);
                          setTimeout(() => saveReport(s.student_id), 50);
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs w-28 mx-auto">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Report Modals */}
        {reportModalStudent && isPrimary && (
          <PrimaryFinalReportModal
            open={reportModalOpen}
            onClose={() => { setReportModalOpen(false); setReportModalStudent(null); }}
            studentId={reportModalStudent.id}
            studentName={reportModalStudent.name}
            assignmentId={assignmentId}
            schoolId={schoolId}
            momento={momento}
            gradeLevel={gradeLevel}
            reportType={reportType}
            onSaved={() => {
              queryClient.invalidateQueries({ queryKey: [`${tableName}-teacher`, assignmentId, momento] });
            }}
          />
        )}
        {reportModalStudent && isPreschool && (
          <PreschoolFinalReportModal
            open={reportModalOpen}
            onClose={() => { setReportModalOpen(false); setReportModalStudent(null); }}
            studentId={reportModalStudent.id}
            studentName={reportModalStudent.name}
            assignmentId={assignmentId}
            schoolId={schoolId}
            momento={momento}
            gradeLevel={gradeLevel}
            reportType={reportType}
            onSaved={() => {
              queryClient.invalidateQueries({ queryKey: [`${tableName}-teacher`, assignmentId, momento] });
            }}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
