import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePayrollTaxConfig } from "@/hooks/payroll/usePayrollTaxConfig";
import { formatDateOnly, todayCaracasIso } from "@/lib/dateUtils";
import { isDefaultParameters } from "@/lib/payroll/withholdings/defaultRates";
import { resolveRateVersion } from "@/lib/payroll/withholdings/resolveRateVersion";

const FIELDS = [
  { key: "vat_standard_pct", label: "% retención IVA estándar", isPct: true },
  { key: "vat_full_pct", label: "% retención IVA máxima", isPct: true },
  { key: "default_vat_rate_pct", label: "Alícuota de IVA habitual", isPct: true },
  { key: "tax_unit_value", label: "Unidad tributaria (Bs)", isPct: false },
  { key: "petty_cash_ut_limit", label: "Límite de caja chica (UT)", isPct: false },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];

/** General values. A change adds a new version from a date; past payments keep what they used. */
export function WithholdingParametersCard({ schoolId }: { schoolId: string }) {
  const { toast } = useToast();
  const { parameters, addParameters, deleteFutureParameters } = usePayrollTaxConfig(schoolId);
  const today = todayCaracasIso();
  const current = resolveRateVersion(parameters, today);

  const [values, setValues] = useState<Record<FieldKey, string>>({
    vat_standard_pct: "",
    vat_full_pct: "",
    default_vat_rate_pct: "",
    tax_unit_value: "",
    petty_cash_ut_limit: "",
  });
  const [validFrom, setValidFrom] = useState(today);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!current) return;
    setValues({
      vat_standard_pct: String(current.vat_standard_pct),
      vat_full_pct: String(current.vat_full_pct),
      default_vat_rate_pct: String(current.default_vat_rate_pct),
      tax_unit_value: String(current.tax_unit_value),
      petty_cash_ut_limit: String(current.petty_cash_ut_limit),
    });
  }, [current]);

  const changes = current
    ? FIELDS.filter((f) => Number(values[f.key]) !== Number(current[f.key]))
    : [];
  const isValid = FIELDS.every((f) => {
    const n = Number(values[f.key]);
    if (values[f.key] === "" || !Number.isFinite(n) || n < 0) return false;
    if (f.isPct && n > 100) return false;
    return f.key !== "tax_unit_value" || n > 0;
  });

  const save = () => {
    addParameters.mutate(
      {
        valid_from: validFrom,
        vat_standard_pct: Number(values.vat_standard_pct),
        vat_full_pct: Number(values.vat_full_pct),
        default_vat_rate_pct: Number(values.default_vat_rate_pct),
        tax_unit_value: Number(values.tax_unit_value),
        petty_cash_ut_limit: Number(values.petty_cash_ut_limit),
      },
      {
        onSuccess: () => {
          toast({ title: "Nueva versión guardada", description: `Aplica desde el ${formatDateOnly(validFrom)}.` });
          setConfirmOpen(false);
        },
        onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          Parámetros generales
          {current && !isDefaultParameters(current) && <Badge variant="secondary">Modificados</Badge>}
        </CardTitle>
        <CardDescription>Los pagos ya registrados conservan los valores con los que se calcularon.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label className="text-xs" htmlFor={f.key}>{f.label}</Label>
              <Input
                id={f.key}
                type="number"
                step="0.01"
                min="0"
                value={values[f.key]}
                onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
              />
            </div>
          ))}
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="parameters-valid-from">Aplica desde</Label>
            <Input id="parameters-valid-from" type="date" min={today} value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
          </div>
        </div>
        <Button disabled={changes.length === 0 || !isValid || validFrom < today} onClick={() => setConfirmOpen(true)}>
          Guardar nueva versión
        </Button>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Desde</TableHead>
              <TableHead className="text-right">IVA estándar</TableHead>
              <TableHead className="text-right">IVA máxima</TableHead>
              <TableHead className="text-right">UT (Bs)</TableHead>
              <TableHead className="text-right">Caja chica (UT)</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parameters.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  {formatDateOnly(p.valid_from)}
                  {p.id === current?.id && <Badge variant="outline" className="ml-2">Vigente</Badge>}
                  {p.valid_from > today && <Badge variant="secondary" className="ml-2">Programada</Badge>}
                </TableCell>
                <TableCell className="text-right">{p.vat_standard_pct} %</TableCell>
                <TableCell className="text-right">{p.vat_full_pct} %</TableCell>
                <TableCell className="text-right">{p.tax_unit_value}</TableCell>
                <TableCell className="text-right">{p.petty_cash_ut_limit}</TableCell>
                <TableCell>
                  {p.valid_from > today && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      title="Borrar versión programada"
                      onClick={() => deleteFutureParameters.mutate(p.id, { onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }) })}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar cambio</DialogTitle>
            <DialogDescription>Aplica a los pagos desde el {formatDateOnly(validFrom)}. Los anteriores no cambian.</DialogDescription>
          </DialogHeader>
          <ul className="space-y-1 text-sm">
            {changes.map((f) => (
              <li key={f.key} className="flex justify-between gap-3">
                <span>{f.label}</span>
                <span className="font-medium whitespace-nowrap">{current?.[f.key]} → {values[f.key]}</span>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={addParameters.isPending}>
              {addParameters.isPending && <Loader2 className="animate-spin h-4 w-4 mr-1" />}Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
