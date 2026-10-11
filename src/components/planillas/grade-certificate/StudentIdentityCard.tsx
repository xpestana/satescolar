import { AlertTriangle, IdCard } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCertificateStudentIdentity } from "@/hooks/useCertificateStudentIdentity";
import {
  type CertificateStudentIdentity,
  identityLabel,
  missingIdentityFields,
} from "@/lib/grade-certificate-identity";

const FIELD_ORDER: Array<keyof CertificateStudentIdentity> = [
  "documentId", "lastNames", "firstNames", "birthDate", "birthCountry", "birthState", "birthMunicipality",
];

/** Read-only preview of the student's data the certificate will print, with what is still missing. */
export function StudentIdentityCard({ studentId }: { studentId: string }) {
  const { data: identity, isLoading } = useCertificateStudentIdentity(studentId);
  const missing = identity ? missingIdentityFields(identity) : [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <IdCard className="h-4 w-4" />
          Datos de identificación del estudiante
        </CardTitle>
        <CardDescription>Se toman de la ficha del estudiante; aquí no se editan.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading || !identity ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <>
            <dl className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3">
              {FIELD_ORDER.map((field) => (
                <div key={field} className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{identityLabel(field)}</dt>
                  <dd className="text-sm font-medium truncate" title={identity[field]}>
                    {identity[field] || <span className="font-normal text-amber-600">Sin registrar</span>}
                  </dd>
                </div>
              ))}
            </dl>
            {missing.length > 0 && (
              <p className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  Falta {missing.map(identityLabel).join(", ").toLowerCase()}. Complétalo en la ficha del
                  estudiante para que salga en la certificación.
                </span>
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
