import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ChevronDown, HelpCircle, Info, Lock, Receipt } from "lucide-react";
import { SchoolYearSelect } from "@/components/payments/SchoolYearSelect";
import { useRepresentativeFamily } from "@/hooks/useRepresentativeFamily";
import { useSchoolYearSelection } from "@/hooks/useSchoolYearSelection";
import { useStudentGradesAccess } from "@/hooks/useStudentGradesAccess";
import { useStudentReportCard } from "@/hooks/useStudentReportCard";
import { MOMENTO_LABELS, VISIBILITY_MOMENTOS } from "@/hooks/useGradeVisibilitySettings";
import StudentGradesPanel from "@/components/grades/StudentGradesPanel";
import StudentBoletaDownload from "@/components/grades/StudentBoletaDownload";
import { gateMessage } from "@/lib/gradesAccess";
import { gradeLabel } from "@/lib/gradeLevels";
import { studentFullName } from "@/lib/studentName";

/**
 * Grades and report card of one of the representative's students.
 *
 * Reached from the student card in /representative/estudiantes. Everything shown here is filtered
 * by RLS: a momento the school has not published, a blocked student or an overdue balance simply
 * returns no data, and the gate RPC tells us which of the three it was so we can explain it.
 */
export default function StudentGrades() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { familyId, schoolId } = useRepresentativeFamily();
  const { schoolYears, selectedYearId, setSelectedYearId, selectedYear, isLoading: yearsLoading } =
    useSchoolYearSelection(schoolId);
  const [momento, setMomento] = useState<number>(1);
  const [helpOpen, setHelpOpen] = useState(false);

  const { data: student, isLoading: studentLoading } = useQuery({
    queryKey: ["representative-student", studentId, familyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, document_id, form_data, photo_url")
        .eq("id", studentId!)
        .eq("family_id", familyId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!studentId && !!familyId,
  });

  const { reason, isLoading: accessLoading } = useStudentGradesAccess(studentId, selectedYearId, momento);
  const { data: reportCard, isLoading: reportLoading } = useStudentReportCard({
    studentId,
    schoolId,
    schoolYearId: selectedYearId,
  });

  // A year without an enrolment has no momentos to offer; reset so the picker is never stuck.
  useEffect(() => {
    setMomento(1);
  }, [selectedYearId]);

  const studentName = studentFullName(student?.form_data as Record<string, unknown> | null);
  const message = reason ? gateMessage(reason) : null;
  const isLoading = studentLoading || yearsLoading || accessLoading || reportLoading;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate("/representative/estudiantes")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a mis estudiantes
        </Button>

        <PageHeader
          title="Notas y Boletas"
          breadcrumbs={[
            { label: "Inicio", href: "/representative/dashboard" },
            { label: "Estudiantes", href: "/representative/estudiantes" },
            { label: "Notas y Boletas" },
          ]}
          description={
            studentLoading
              ? "Cargando estudiante..."
              : [studentName, reportCard?.gradeLevel ? gradeLabel(reportCard.gradeLevel) : null,
                 reportCard?.sectionName ? `Sección ${reportCard.sectionName}` : null]
                  .filter(Boolean)
                  .join(" · ")
          }
        />

        <Collapsible open={helpOpen} onOpenChange={setHelpOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm">
              <HelpCircle className="h-4 w-4 mr-2" />
              ¿Cómo leer las notas de mi representado?
              <ChevronDown className={`h-4 w-4 ml-2 transition-transform ${helpOpen ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <Card>
              <CardContent className="pt-6 space-y-3 text-sm text-muted-foreground">
                <p>
                  <strong className="text-foreground">El año escolar.</strong> Arriba puede elegir
                  el año que desea consultar. Empieza en el año en curso, pero puede revisar años
                  anteriores si su representado ya estudiaba en el plantel.
                </p>
                <p>
                  <strong className="text-foreground">Los momentos.</strong> El año escolar se
                  divide en tres periodos llamados <em>momentos</em>. Cada momento tiene sus propias
                  notas y su propia boleta. La <em>Definitiva Final</em> es el resultado del año
                  completo.
                </p>
                <p>
                  <strong className="text-foreground">Bachillerato.</strong> Las notas van del 01 al
                  20. Algunas materias se evalúan con letras (A, B, C, D) en lugar de números.
                </p>
                <p>
                  <strong className="text-foreground">Preescolar y Primaria.</strong> En lugar de una
                  nota numérica, el docente escribe un informe descriptivo y una calificación
                  literal por área.
                </p>
                <p>
                  <strong className="text-foreground">Si no ve un momento.</strong> El colegio
                  publica las notas cuando están listas: si un momento aún no aparece, vuelva a
                  intentarlo más adelante o consulte con la institución.
                </p>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        <SchoolYearSelect
          years={schoolYears}
          value={selectedYearId}
          onChange={setSelectedYearId}
          isLoading={yearsLoading}
          inactiveWarning="Está viendo el año {year}, que no es el año escolar en curso"
        />

        <div className="flex items-center gap-2 flex-wrap">
          {VISIBILITY_MOMENTOS.map((m) => (
            <Button
              key={m}
              size="sm"
              variant={momento === m ? "default" : "outline"}
              onClick={() => setMomento(m)}
            >
              {MOMENTO_LABELS[m]}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : message ? (
          <Alert variant={message.variant}>
            {reason === "delinquent" ? <Receipt className="h-4 w-4" /> : reason === "hidden_by_school" ? <Info className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            <AlertTitle>{message.title}</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>{message.description}</p>
              {message.actionHref && (
                <Button size="sm" variant="outline" onClick={() => navigate(message.actionHref!)}>
                  {message.actionLabel}
                </Button>
              )}
            </AlertDescription>
          </Alert>
        ) : !reportCard?.sectionId ? (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Sin inscripción en este año escolar</AlertTitle>
            <AlertDescription>
              Su representado no tiene una inscripción registrada en el año {selectedYear?.year_range}.
              Elija otro año escolar para consultar sus notas.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary">{MOMENTO_LABELS[momento]}</Badge>
              <Badge variant="outline">{gradeLabel(reportCard.gradeLevel)}</Badge>
              <Badge variant="outline">Sección {reportCard.sectionName}</Badge>
            </div>

            <StudentGradesPanel reportCard={reportCard} momento={momento} />

            <StudentBoletaDownload
              schoolId={schoolId!}
              studentId={studentId!}
              studentName={studentName}
              documentId={(student?.document_id as string) ?? null}
              sectionId={reportCard.sectionId}
              sectionName={reportCard.sectionName || ""}
              gradeKey={reportCard.gradeLevel || ""}
              levelKind={reportCard.levelKind}
              yearId={selectedYearId}
              yearRange={selectedYear?.year_range || ""}
              momento={momento}
            />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
