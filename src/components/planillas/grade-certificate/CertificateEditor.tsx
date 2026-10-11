import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCertificateStudentIdentity } from "@/hooks/useCertificateStudentIdentity";
import { useGradeCertificateDraft } from "@/hooks/useGradeCertificateDraft";
import { useOwnSchoolInstitution } from "@/hooks/useOwnSchoolInstitution";
import { usePlanillasConfig } from "@/hooks/usePlanillasConfig";
import { todayCaracasIso } from "@/lib/dateUtils";
import { toCertificateText } from "@/lib/grade-certificate";
import { generateGradeCertificateDocx } from "@/lib/grade-certificate-docx";
import { buildCertificatePrintModel } from "@/lib/grade-certificate-print";
import type { CertificateStudent } from "@/lib/grade-certificate-students";
import { downloadBlob } from "@/lib/resumen-final-docx";
import { gradeLabel } from "@/lib/gradeLevels";
import { CertificateClosingCard } from "./CertificateClosingCard";
import { CertificateSaveBar } from "./CertificateSaveBar";
import { InstitutionsEditor } from "./InstitutionsEditor";
import { StudentIdentityCard } from "./StudentIdentityCard";
import { SyncGradesDialog } from "./SyncGradesDialog";
import { YearExtrasEditor } from "./YearExtrasEditor";
import { YearGradesEditor } from "./YearGradesEditor";

interface CertificateEditorProps {
  student: CertificateStudent;
  /** Lets the tab ask before switching to another student with unsaved changes. */
  onDirtyChange: (isDirty: boolean) => void;
}

/** Everything the school captures for one student's certificate. Mount it keyed by student. */
export function CertificateEditor({ student, onDirtyChange }: CertificateEditorProps) {
  const { draft, updateDraft, isLoading, isDirty, isSaving, save, discard } = useGradeCertificateDraft(student.studentId);
  const { ownSchool } = useOwnSchoolInstitution();
  const { gradeCertificateConfig, schoolHeader } = usePlanillasConfig();
  const { data: identity } = useCertificateStudentIdentity(student.studentId);
  const [syncOpen, setSyncOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    onDirtyChange(isDirty);
    return () => onDirtyChange(false);
  }, [isDirty, onDirtyChange]);

  const handleSave = async () => {
    try {
      await save();
      toast.success("Certificación guardada");
    } catch (e) {
      toast.error((e as Error).message || "Error al guardar la certificación");
    }
  };

  const handleDownload = async () => {
    if (!identity) {
      toast.error("Aún se están cargando los datos del estudiante. Intenta de nuevo.");
      return;
    }
    setIsDownloading(true);
    try {
      const model = buildCertificatePrintModel({
        document: draft,
        identity,
        schoolHeader,
        schoolConfig: gradeCertificateConfig,
        today: todayCaracasIso(),
      });
      downloadBlob(await generateGradeCertificateDocx(model), model.fileName);
      toast.success("Certificación generada y descargada");
    } catch (e) {
      toast.error(`Error al generar la certificación: ${(e as Error).message || "error desconocido"}`);
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold leading-tight truncate">{student.name}</h3>
            <p className="text-sm text-muted-foreground">
              {student.documentId || "Sin cédula"} · Última inscripción: {gradeLabel(student.gradeLevel)}{" "}
              {student.sectionName} ({student.yearRange})
            </p>
          </div>
          <Button onClick={() => setSyncOpen(true)}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Sincronizar notas
          </Button>
        </CardContent>
      </Card>

      <StudentIdentityCard studentId={student.studentId} />
      <InstitutionsEditor document={draft} updateDraft={updateDraft} ownSchool={ownSchool} />
      <YearGradesEditor document={draft} updateDraft={updateDraft} />
      <YearExtrasEditor document={draft} updateDraft={updateDraft} />
      <CertificateClosingCard
        document={draft}
        updateDraft={updateDraft}
        issuePlace={gradeCertificateConfig.issue_place || toCertificateText(schoolHeader.entidad_federal)}
      />

      <CertificateSaveBar
        isDirty={isDirty}
        isSaving={isSaving}
        isDownloading={isDownloading}
        onSave={handleSave}
        onDiscard={discard}
        onDownload={handleDownload}
      />

      <SyncGradesDialog
        open={syncOpen}
        onOpenChange={setSyncOpen}
        studentId={student.studentId}
        draft={draft}
        ownSchool={ownSchool}
        onApply={(next, count) => {
          updateDraft(() => next);
          toast.success(`Se trajeron ${count} elemento(s). Revisa y pulsa Guardar.`);
        }}
      />
    </div>
  );
}
