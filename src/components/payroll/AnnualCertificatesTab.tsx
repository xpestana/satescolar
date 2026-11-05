import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";
import { PayrollGuide } from "@/components/payroll/PayrollGuide";
import { annualCertificatesGuide } from "@/components/payroll/payrollGuides";
import { usePayrollSalaryWithholdings } from "@/hooks/payroll/usePayrollWithholdings";
import { todayCaracasIso } from "@/lib/dateUtils";
import { formatMoney } from "@/lib/payroll/buildPayrollReceiptData";
import { buildAnnualCertificate, type WithholdingRow } from "@/lib/payroll/withholdings/buildWithholdingVoucherData";
import { generateAnnualCertificatePdf } from "@/lib/payroll/withholdings/generateWithholdingPdf";

/** Yearly ISLR certificate (ARC) of each worker, from the salary withholdings of the year. */
export function AnnualCertificatesTab({ schoolId }: { schoolId: string }) {
  const currentYear = Number(todayCaracasIso().slice(0, 4));
  const [year, setYear] = useState(currentYear);
  const { data: rows = [], isLoading } = usePayrollSalaryWithholdings(schoolId, year, true);

  const certificates = useMemo(() => {
    const byWorker = new Map<string, WithholdingRow[]>();
    for (const row of rows) byWorker.set(row.beneficiary_id, [...(byWorker.get(row.beneficiary_id) ?? []), row]);
    return [...byWorker.entries()]
      .map(([id, workerRows]) => ({ id, certificate: buildAnnualCertificate(workerRows, year) }))
      .filter((c): c is { id: string; certificate: NonNullable<typeof c.certificate> } => !!c.certificate)
      .sort((a, b) => a.certificate.worker.name.localeCompare(b.certificate.worker.name));
  }, [rows, year]);

  return (
    <div className="space-y-4">
      <PayrollGuide guide={annualCertificatesGuide()} className="mb-0" />

      <div className="space-y-1.5 w-40">
        <Label className="text-xs">Año</Label>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trabajador</TableHead>
                <TableHead>RIF</TableHead>
                <TableHead className="text-right">Monto sujeto</TableHead>
                <TableHead className="text-right">ISLR retenido</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : certificates.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No hay retenciones de sueldos en {year}.</TableCell></TableRow>
              ) : (
                certificates.map(({ id, certificate }) => (
                  <TableRow key={id}>
                    <TableCell className="font-medium">
                      {certificate.worker.name}
                      <div className="text-xs text-muted-foreground">{certificate.worker.documentId}</div>
                    </TableCell>
                    <TableCell>{certificate.worker.taxId}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{formatMoney(certificate.totalBase, "VES")}</TableCell>
                    <TableCell className="text-right whitespace-nowrap font-medium">{formatMoney(certificate.totalWithheld, "VES")}</TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        title="Descargar comprobante anual"
                        onClick={() => generateAnnualCertificatePdf(certificate).save(`arc-${year}-${certificate.worker.documentId}.pdf`)}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
