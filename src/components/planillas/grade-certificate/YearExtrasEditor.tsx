import { Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type CertificateYearLevel,
  type CertificateYearRecord,
  type GradeCertificateDocument,
  updateYearRecord,
} from "@/lib/grade-certificate";
import { CERTIFICATE_CELL_INPUT, CertificateTextInput } from "./CertificateTextInput";
import { LiteralSelect } from "./LiteralSelect";

interface YearExtrasEditorProps {
  document: GradeCertificateDocument;
  updateDraft: (update: (draft: GradeCertificateDocument) => GradeCertificateDocument) => void;
}

/** Orientación y Convivencia and Participación en Grupos (GCRP): one literal per year. */
export function YearExtrasEditor({ document, updateDraft }: YearExtrasEditorProps) {
  const patch = (yearLevel: CertificateYearLevel, changes: Partial<CertificateYearRecord>) =>
    updateDraft((draft) => updateYearRecord(draft, yearLevel, (year) => ({ ...year, ...changes })));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />
          Orientación y Convivencia · Grupos de Creación, Recreación y Producción
        </CardTitle>
        <CardDescription>Se evalúan con literal. Lo que quede vacío sale con asteriscos.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium w-16">Año</th>
                <th className="px-2 py-2 font-medium w-40">Orientación y Convivencia</th>
                <th className="px-3 py-2 text-left font-medium min-w-[12rem]">Grupo</th>
                <th className="px-2 py-2 font-medium w-32">Literal del grupo</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {document.yearRecords.map((year) => (
                <tr key={year.yearLevel} className="hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-1 font-medium tabular-nums">{year.yearLevel}°</td>
                  <td className="px-2 py-1">
                    <LiteralSelect
                      value={year.orientationLiteral}
                      onChange={(orientationLiteral) => patch(year.yearLevel, { orientationLiteral })}
                      aria-label={`Literal de Orientación y Convivencia de ${year.yearLevel}° año`}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <CertificateTextInput
                      value={year.groupName}
                      onValueChange={(groupName) => patch(year.yearLevel, { groupName })}
                      placeholder="Ej. SEMILLERO CIENTÍFICO"
                      aria-label={`Grupo de ${year.yearLevel}° año`}
                      className={CERTIFICATE_CELL_INPUT}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <LiteralSelect
                      value={year.groupLiteral}
                      onChange={(groupLiteral) => patch(year.yearLevel, { groupLiteral })}
                      aria-label={`Literal del grupo de ${year.yearLevel}° año`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
