import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, Circle, Download, FileText, Loader2, PenLine, Search } from "lucide-react";
import { toast } from "sonner";
import DiagnosisEditorModal from "@/components/diagnosis/DiagnosisEditorModal";
import PdfPreviewDialog from "@/components/grades/PdfPreviewDialog";
import { useStudentDiagnoses } from "@/hooks/useStudentDiagnoses";
import { usePdfPreview } from "@/hooks/usePdfPreview";
import type { GradeStudent } from "@/hooks/useGradeStudents";
import { buildDiagnosisDocument } from "@/lib/diagnosisSheetData";

type StatusFilter = "all" | "pending" | "done";

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendientes" },
  { value: "done", label: "Redactados" },
];

interface DiagnosisStudentListProps {
  assignmentId: string;
  schoolId: string;
  students: GradeStudent[];
  studentsLoading?: boolean;
  /** Without it the list only lets you view and download the PDFs. */
  canEdit: boolean;
  /** Used in the PDF file names, e.g. "Matemática 1er Año A". */
  fileLabel: string;
}

/**
 * Students of an assignment with the state of their diagnosis. Shared by the teacher's screen and
 * the school's "Diagnóstico" tab.
 */
export default function DiagnosisStudentList({
  assignmentId,
  schoolId,
  students,
  studentsLoading,
  canEdit,
  fileLabel,
}: DiagnosisStudentListProps) {
  const { data: diagnoses = {}, isLoading: diagnosesLoading } = useStudentDiagnoses(assignmentId);
  const { preview, openPreview, closePreview } = usePdfPreview();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [editorIndex, setEditorIndex] = useState<number | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const doneCount = students.filter((s) => diagnoses[s.student_id]).length;
  const writtenStudents = students.filter((s) => diagnoses[s.student_id]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return students.filter((s) => {
      const done = !!diagnoses[s.student_id];
      if (filter === "pending" && done) return false;
      if (filter === "done" && !done) return false;
      if (!term) return true;
      return s.student_name.toLowerCase().includes(term) || (s.document_id ?? "").toLowerCase().includes(term);
    });
  }, [students, diagnoses, search, filter]);

  const downloadPdf = async (targets: GradeStudent[], key: string, filename: string, title: string) => {
    setDownloadingId(key);
    try {
      const html = await buildDiagnosisDocument(
        assignmentId,
        targets.map((s) => ({ studentId: s.student_id, studentName: s.full_name, documentId: s.document_id })),
      );
      await openPreview(html, filename, title);
    } catch (e) {
      toast.error("No se pudo generar el PDF", { description: (e as Error).message });
    } finally {
      setDownloadingId(null);
    }
  };

  const downloadOne = (s: GradeStudent) =>
    downloadPdf([s], s.student_id, `Diagnostico_${s.full_name}`, `${s.full_name} — Diagnóstico`);

  const downloadAll = () =>
    downloadPdf(writtenStudents, "all", `Diagnosticos_${fileLabel}`, `${fileLabel} — Diagnósticos (${writtenStudents.length})`);

  /** The editor walks the whole list in order, whatever the filter shows. */
  const openEditor = (s: GradeStudent) => setEditorIndex(students.findIndex((x) => x.student_id === s.student_id));

  if (studentsLoading || diagnosesLoading) {
    return (
      <div className="space-y-3 py-2">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="rounded-md border bg-muted/20 py-12 text-center text-muted-foreground">
        No hay estudiantes inscritos en esta sección y año escolar.
      </div>
    );
  }

  const actionButtons = (s: GradeStudent, compact: boolean) => {
    const done = !!diagnoses[s.student_id];
    return (
      <>
        {canEdit && (
          <Button size="sm" variant={done ? "outline" : "default"} className={compact ? "flex-1" : "h-8"} onClick={() => openEditor(s)}>
            <PenLine className="mr-1.5 h-3.5 w-3.5" />
            {done ? "Editar" : "Redactar"}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className={compact ? "flex-1" : "h-8"}
          disabled={!done || downloadingId === s.student_id}
          onClick={() => downloadOne(s)}
          title={done ? "Ver y descargar el PDF" : "Aún no tiene diagnóstico"}
        >
          {downloadingId === s.student_id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileText className="mr-1.5 h-3.5 w-3.5" />}
          PDF
        </Button>
      </>
    );
  };

  const statusBadge = (done: boolean) =>
    done ? (
      <Badge variant="outline" className="gap-1 border-emerald-300 text-emerald-700">
        <CheckCircle2 className="h-3 w-3" /> Redactado
      </Badge>
    ) : (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <Circle className="h-3 w-3" /> Pendiente
      </Badge>
    );

  return (
    <div className="space-y-4">
      {/* Progress + bulk download */}
      <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="font-medium">{doneCount} de {students.length} redactados</span>
            <span className="text-muted-foreground">{Math.round((doneCount / students.length) * 100)}%</span>
          </div>
          <Progress value={(doneCount / students.length) * 100} className="h-2" />
        </div>
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          disabled={writtenStudents.length === 0 || downloadingId === "all"}
          onClick={downloadAll}
        >
          {downloadingId === "all" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
          Descargar todos ({writtenStudents.length})
        </Button>
      </div>

      {/* Search + status filter */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar estudiante o cédula…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 pl-9" />
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-lg border bg-muted/40 p-0.5 sm:inline-grid">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-md border bg-muted/20 py-10 text-center text-sm text-muted-foreground">
          No hay estudiantes con este filtro.
        </div>
      ) : (
        <>
          {/* Phone: cards with full-width actions */}
          <div className="space-y-2 md:hidden">
            {visible.map((s) => (
              <div key={s.student_id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{s.student_name}</p>
                    <p className="text-xs text-muted-foreground">{s.document_id || "Sin cédula"}</p>
                  </div>
                  {statusBadge(!!diagnoses[s.student_id])}
                </div>
                <div className="mt-3 flex gap-2">{actionButtons(s, true)}</div>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden rounded-md border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>Estudiante</TableHead>
                  <TableHead>Cédula</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((s) => (
                  <TableRow key={s.student_id}>
                    <TableCell className="text-center text-muted-foreground">
                      {students.findIndex((x) => x.student_id === s.student_id) + 1}
                    </TableCell>
                    <TableCell className="font-medium">{s.student_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.document_id || "—"}</TableCell>
                    <TableCell>{statusBadge(!!diagnoses[s.student_id])}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">{actionButtons(s, false)}</div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {canEdit && editorIndex !== null && (
        <DiagnosisEditorModal
          open
          onClose={() => setEditorIndex(null)}
          assignmentId={assignmentId}
          schoolId={schoolId}
          students={students}
          index={editorIndex}
          onIndexChange={setEditorIndex}
          diagnoses={diagnoses}
        />
      )}

      <PdfPreviewDialog preview={preview} onClose={closePreview} />
    </div>
  );
}
