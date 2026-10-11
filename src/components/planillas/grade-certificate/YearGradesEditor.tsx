import { useState } from "react";
import { BookOpen } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  type CertificateYearLevel,
  type GradeCertificateDocument,
  CERTIFICATE_GRADE_LEVELS,
  isGradeRowFilled,
  updateYearRecord,
} from "@/lib/grade-certificate";
import { gradeLabel } from "@/lib/gradeLevels";
import { YearGradesTable } from "./YearGradesTable";

interface YearGradesEditorProps {
  document: GradeCertificateDocument;
  updateDraft: (update: (draft: GradeCertificateDocument) => GradeCertificateDocument) => void;
}

/** "Plan de Estudio": one tab per year (1er–5to año) with its áreas de formación. */
export function YearGradesEditor({ document, updateDraft }: YearGradesEditorProps) {
  const [activeYear, setActiveYear] = useState<string>("1");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          Plan de estudio
        </CardTitle>
        <CardDescription>
          Notas por año. Puedes traerlas con Sincronizar notas y corregirlas aquí, o escribirlas a mano
          cuando el estudiante cursó el año en otro plantel.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeYear} onValueChange={setActiveYear}>
          <TabsList className="h-auto flex-wrap justify-start">
            {document.yearRecords.map((year) => {
              const filled = year.grades.filter(isGradeRowFilled).length;
              return (
                <TabsTrigger key={year.yearLevel} value={String(year.yearLevel)} className="gap-1.5">
                  {gradeLabel(CERTIFICATE_GRADE_LEVELS[year.yearLevel - 1])}
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
                      filled > 0 ? "bg-primary/15 text-primary" : "bg-muted-foreground/15 text-muted-foreground",
                    )}
                    title={filled > 0 ? `${filled} área(s) con datos` : "Sin notas"}
                  >
                    {filled > 0 ? filled : "–"}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>
          {document.yearRecords.map((year) => (
            <TabsContent key={year.yearLevel} value={String(year.yearLevel)} className="mt-4">
              <YearGradesTable
                year={year}
                institutions={document.institutions}
                onChange={(grades) =>
                  updateDraft((draft) =>
                    updateYearRecord(draft, year.yearLevel as CertificateYearLevel, (y) => ({ ...y, grades })))}
              />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
