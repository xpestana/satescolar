import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardList, Loader2, Save } from "lucide-react";
import { SignatureEditor, emptySignature } from "@/components/grades/SignatureFields";
import type { BoletinSignature } from "@/lib/bachilleratoTemplate";

/** What a school sees before configuring anything: the two signers of the paper sheet. */
const SUGGESTED: BoletinSignature[] = [
  { ...emptySignature(), cargo: "Directora" },
  { ...emptySignature(), cargo: "Coordinadora Pedagógica" },
];

/**
 * Institutional signatures of the diagnosis sheet (grades_config.diagnosis_signatures). They print
 * after the teacher's own signature, which each teacher manages.
 */
export default function DiagnosisSignaturesCard({ schoolId, saved, saving, onSave }: {
  schoolId: string;
  saved: BoletinSignature[] | null | undefined;
  saving: boolean;
  onSave: (sigs: BoletinSignature[]) => void;
}) {
  const [sigs, setSigs] = useState<BoletinSignature[]>(SUGGESTED);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setSigs(saved && saved.length > 0 ? saved : SUGGESTED);
    setDirty(false);
  }, [saved]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Firmas del Diagnóstico</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">
          Se imprimen en la ficha de diagnóstico después de la firma del docente del área. Usa el
          interruptor para dejar de imprimir una firma sin borrar sus datos.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <SignatureEditor
          sigs={sigs}
          schoolId={schoolId}
          showEnabled
          onChange={(next) => {
            setSigs(next);
            setDirty(true);
          }}
        />
        <Button size="sm" disabled={!dirty || saving} onClick={() => onSave(sigs)}>
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
          Guardar firmas
        </Button>
      </CardContent>
    </Card>
  );
}
