import { NotebookPen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { GradeCertificateDocument } from "@/lib/grade-certificate";
import { formatCertificateDate } from "@/lib/grade-certificate-identity";

interface CertificateClosingCardProps {
  document: GradeCertificateDocument;
  updateDraft: (update: (draft: GradeCertificateDocument) => GradeCertificateDocument) => void;
  /** Place of issue configured for the school, to preview the "Lugar y Fecha de Expedición" line. */
  issuePlace: string;
}

/** Observaciones and fecha de expedición of the certificate. */
export function CertificateClosingCard({ document, updateDraft, issuePlace }: CertificateClosingCardProps) {
  const dateText = formatCertificateDate(document.issueDate);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <NotebookPen className="h-4 w-4" />
          Observaciones y expedición
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-[1fr_16rem] gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="certificate-observations">Observaciones</Label>
          <Textarea
            id="certificate-observations"
            value={document.observations}
            onChange={(event) => updateDraft((draft) => ({ ...draft, observations: event.target.value }))}
            placeholder="Observaciones que saldrán en la planilla…"
            className="resize-none"
            rows={3}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="certificate-issue-date">Fecha de expedición</Label>
          <Input
            id="certificate-issue-date"
            type="date"
            value={document.issueDate}
            onChange={(event) => updateDraft((draft) => ({ ...draft, issueDate: event.target.value }))}
          />
          <p className="text-xs text-muted-foreground">
            {dateText
              ? [issuePlace, dateText].filter(Boolean).join(", ")
              : "Vacía = la fecha del día en que se genere la planilla."}
            {document.issueDate && (
              <>
                {" "}
                <button
                  type="button"
                  className="underline hover:text-foreground"
                  onClick={() => updateDraft((draft) => ({ ...draft, issueDate: "" }))}
                >
                  Quitar fecha
                </button>
              </>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
