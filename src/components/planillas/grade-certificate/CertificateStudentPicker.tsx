import { useMemo, useState } from "react";
import { FileCheck2, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { type CertificateStudent, filterCertificateStudents } from "@/lib/grade-certificate-students";
import { gradeLabel } from "@/lib/gradeLevels";

/** Rows drawn at once; the search narrows the rest. */
const VISIBLE_LIMIT = 60;

const STATUS_LABEL: Record<string, string> = {
  graduated: "Egresado",
  completed: "Culminado",
  suspended: "Suspendido",
};

interface CertificateStudentPickerProps {
  students: CertificateStudent[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (student: CertificateStudent) => void;
}

/** Search box and list of every student who studied 1er–5to año in the school. */
export function CertificateStudentPicker({ students, isLoading, selectedId, onSelect }: CertificateStudentPickerProps) {
  const [search, setSearch] = useState("");
  const matches = useMemo(() => filterCertificateStudents(students, search), [students, search]);
  const visible = matches.slice(0, VISIBLE_LIMIT);

  return (
    <Card className="w-full lg:w-80 lg:shrink-0 lg:sticky lg:top-4">
      <CardHeader className="pb-3 space-y-3">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          Estudiantes de bachillerato
          {!isLoading && <Badge variant="secondary" className="tabular-nums">{students.length}</Badge>}
        </CardTitle>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre o cédula…"
            aria-label="Buscar estudiante"
            className="h-9 pl-8 pr-8 text-sm"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-2 pt-0">
        <div className="max-h-[28rem] lg:max-h-[calc(100vh-17rem)] overflow-y-auto space-y-0.5 pr-1">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
          ) : visible.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-muted-foreground">
              {students.length === 0
                ? "No hay estudiantes inscritos de 1er a 5to año."
                : "Ningún estudiante coincide con la búsqueda."}
            </p>
          ) : (
            <>
              {visible.map((student) => (
                <button
                  key={student.studentId}
                  type="button"
                  onClick={() => onSelect(student)}
                  aria-current={student.studentId === selectedId}
                  className={cn(
                    "w-full rounded-md px-3 py-2 text-left transition-colors hover:bg-muted/60",
                    student.studentId === selectedId && "bg-primary/10 hover:bg-primary/10",
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    <span className={cn("flex-1 truncate text-sm font-medium", student.studentId === selectedId && "text-primary")}>
                      {student.name}
                    </span>
                    {student.hasCertificate && (
                      <FileCheck2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-label="Ya tiene datos de certificación" />
                    )}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="truncate">
                      {student.documentId || "Sin cédula"} · {gradeLabel(student.gradeLevel)} {student.sectionName} · {student.yearRange}
                    </span>
                    {STATUS_LABEL[student.status] && (
                      <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px] font-normal">
                        {STATUS_LABEL[student.status]}
                      </Badge>
                    )}
                  </span>
                </button>
              ))}
              {matches.length > VISIBLE_LIMIT && (
                <p className="px-3 py-2 text-center text-[11px] text-muted-foreground">
                  Mostrando {VISIBLE_LIMIT} de {matches.length}. Escribe para afinar la búsqueda.
                </p>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
