import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PenLine, Search } from "lucide-react";
import type { GradeStudent } from "@/hooks/useGradeStudents";

interface MobileStudentGradeCardsProps {
  students: GradeStudent[];
  /** Small badge on the right of each card (e.g. "2/4 notas"). */
  renderStatus: (student: GradeStudent) => ReactNode;
  /** Button text, e.g. "Agregar nota" or "Editar notas". */
  actionLabel: (student: GradeStudent) => string;
  /** Receives the student's position in `students`, whatever the search shows. */
  onOpen: (index: number) => void;
}

/**
 * Phone version of the teacher's grade tables: one card per student with name, cédula and a
 * button that opens a dialog. The wide tables don't fit on a phone (the sticky name and cédula
 * columns cover the grades), so they are hidden below `md` and this list is shown instead.
 */
export function MobileStudentGradeCards({ students, renderStatus, actionLabel, onOpen }: MobileStudentGradeCardsProps) {
  const [search, setSearch] = useState("");
  const positionOf = useMemo(() => new Map(students.map((s, i) => [s.student_id, i])), [students]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return students;
    return students.filter(
      (s) => s.student_name.toLowerCase().includes(term) || (s.document_id ?? "").toLowerCase().includes(term),
    );
  }, [students, search]);

  return (
    <div className="space-y-2">
      {students.length > 8 && (
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar estudiante o cédula…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9"
          />
        </div>
      )}

      {visible.length === 0 ? (
        <p className="rounded-md border bg-muted/20 py-8 text-center text-sm text-muted-foreground">
          Ningún estudiante coincide con la búsqueda.
        </p>
      ) : (
        visible.map((s) => {
          const index = positionOf.get(s.student_id) ?? 0;
          return (
            <div key={s.student_id} className="rounded-lg border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-snug">
                    <span className="mr-1 text-muted-foreground">{index + 1}.</span>
                    {s.student_name}
                  </p>
                  <p className="text-xs text-muted-foreground">C.I. {s.document_id || "—"}</p>
                </div>
                <div className="shrink-0">{renderStatus(s)}</div>
              </div>
              <Button size="sm" className="mt-3 w-full" onClick={() => onOpen(index)}>
                <PenLine className="mr-1.5 h-3.5 w-3.5" />
                {actionLabel(s)}
              </Button>
            </div>
          );
        })
      )}
    </div>
  );
}
