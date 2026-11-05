import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePayrollContributionConfig, type ContributionParametersInput } from "@/hooks/payroll/usePayrollContributionConfig";
import { PayrollGuide } from "@/components/payroll/PayrollGuide";
import { contributionsConfigGuide } from "@/components/payroll/payrollGuides";
import { formatDateOnly, todayCaracasIso } from "@/lib/dateUtils";
import { resolveRateVersion } from "@/lib/payroll/withholdings/resolveRateVersion";
import {
  CONTRIBUTION_KINDS,
  CONTRIBUTION_LABELS,
  CONTRIBUTION_METHOD_LABELS,
  type ContributionKind,
  type ContributionMethod,
  type ContributionParameters,
} from "@/lib/payroll/contributions/types";

type FormValues = Record<string, string>;

const NUMBER_FIELDS: { key: keyof ContributionParametersInput; label: string; isPct: boolean }[] = [
  { key: "minimum_wage_ves", label: "Salario mínimo mensual (Bs)", isPct: false },
  ...CONTRIBUTION_KINDS.flatMap((kind) => [
    { key: `${kind}_pct` as keyof ContributionParametersInput, label: `${CONTRIBUTION_LABELS[kind]}: % del trabajador`, isPct: true },
    { key: `${kind}_cap_wages` as keyof ContributionParametersInput, label: `${CONTRIBUTION_LABELS[kind]}: tope (salarios mínimos)`, isPct: false },
  ]),
];
const METHOD_KEYS = CONTRIBUTION_KINDS.map((kind) => `${kind}_method` as const);

function toValues(p: ContributionParameters): FormValues {
  const values: FormValues = {};
  for (const f of NUMBER_FIELDS) values[f.key] = String(p[f.key]);
  for (const key of METHOD_KEYS) values[key] = p[key];
  return values;
}

/** Settings tab: turn contributions on and keep their versioned values. */
export function PayrollContributionsConfigTab({ schoolId }: { schoolId: string }) {
  const { toast } = useToast();
  const { settings, parameters, enabled, isLoading, ensureDefaults, setEnabled, markValidated, addParameters, deleteFutureParameters } =
    usePayrollContributionConfig(schoolId);
  const today = todayCaracasIso();
  const current = useMemo(() => resolveRateVersion(parameters, today), [parameters, today]);

  const [values, setValues] = useState<FormValues>({});
  const [validFrom, setValidFrom] = useState(today);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (current) setValues(toValues(current));
  }, [current]);

  const showError = (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" });

  if (isLoading) {
    return <Card><CardContent className="py-8 text-center text-muted-foreground">Cargando...</CardContent></Card>;
  }

  if (!settings || parameters.length === 0) {
    return (
      <div className="space-y-4">
        <PayrollGuide guide={contributionsConfigGuide(false)} className="mb-0" />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">IVSS, paro forzoso y FAOV</CardTitle>
            <CardDescription>
              Descuenta la parte del trabajador de cada sueldo. Se cargan unos valores iniciales que el contador debe revisar,
              y seguirán apagados hasta que los active.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => ensureDefaults.mutate(undefined, { onError: showError })} disabled={ensureDefaults.isPending}>
              {ensureDefaults.isPending && <Loader2 className="animate-spin h-4 w-4 mr-1" />}Configurar parafiscales
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const changes = current
    ? [...NUMBER_FIELDS.map((f) => f.key), ...METHOD_KEYS].filter((key) => values[key] !== String(current[key]))
    : [];
  const isValid = NUMBER_FIELDS.every((f) => {
    const n = Number(values[f.key]);
    if (values[f.key] === "" || !Number.isFinite(n) || n < 0) return false;
    if (f.isPct && n > 100) return false;
    return f.key !== "minimum_wage_ves" || n > 0;
  });
  const labelOf = (key: string) =>
    NUMBER_FIELDS.find((f) => f.key === key)?.label ??
    `${CONTRIBUTION_LABELS[key.replace("_method", "") as ContributionKind]}: forma de cálculo`;
  const shown = (key: string, value: string | number | undefined) =>
    key.endsWith("_method") ? CONTRIBUTION_METHOD_LABELS[value as ContributionMethod] : String(value);

  const save = () => {
    const input = { valid_from: validFrom } as Record<string, string | number>;
    for (const f of NUMBER_FIELDS) input[f.key] = Number(values[f.key]);
    for (const key of METHOD_KEYS) input[key] = values[key];
    addParameters.mutate(input as unknown as ContributionParametersInput, {
      onSuccess: () => {
        toast({ title: "Nueva versión guardada", description: `Aplica desde el ${formatDateOnly(validFrom)}.` });
        setConfirmOpen(false);
      },
      onError: showError,
    });
  };

  return (
    <div className="space-y-4">
      <PayrollGuide guide={contributionsConfigGuide(true)} className="mb-0" />

      {!settings.rates_validated_at ? (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Valores por validar</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>Son un punto de partida. Debe revisarlos el contador del colegio antes de activar los parafiscales.</p>
            <Button
              size="sm"
              variant="outline"
              disabled={markValidated.isPending}
              onClick={() => markValidated.mutate(undefined, { onSuccess: () => toast({ title: "Valores marcados como validados" }), onError: showError })}
            >
              Marcar como validados por el contador
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <p className="text-xs text-muted-foreground">Valores validados el {formatDateOnly(settings.rates_validated_at.slice(0, 10))}.</p>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Activación</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="toggle-contributions">Descontar parafiscales en los sueldos</Label>
            <Switch
              id="toggle-contributions"
              checked={enabled}
              disabled={setEnabled.isPending}
              onCheckedChange={(checked) =>
                setEnabled.mutate(checked, {
                  onSuccess: () => toast({ title: checked ? "Parafiscales activados" : "Parafiscales desactivados" }),
                  onError: showError,
                })
              }
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Aplica a los pagos nuevos en los períodos que descuentan. Los pagos ya registrados no cambian.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Valores</CardTitle>
          <CardDescription>Los pagos ya registrados conservan los valores con los que se calcularon.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs" htmlFor="minimum_wage_ves">Salario mínimo mensual (Bs)</Label>
              <Input
                id="minimum_wage_ves"
                type="number"
                step="0.01"
                min="0"
                value={values.minimum_wage_ves ?? ""}
                onChange={(e) => setValues((prev) => ({ ...prev, minimum_wage_ves: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {CONTRIBUTION_KINDS.map((kind) => (
              <div key={kind} className="rounded-md border p-3 space-y-2">
                <p className="text-sm font-medium">{CONTRIBUTION_LABELS[kind]}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs" htmlFor={`${kind}_pct`}>% del trabajador</Label>
                    <Input
                      id={`${kind}_pct`}
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={values[`${kind}_pct`] ?? ""}
                      onChange={(e) => setValues((prev) => ({ ...prev, [`${kind}_pct`]: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs" htmlFor={`${kind}_cap_wages`}>Tope (salarios mín.)</Label>
                    <Input
                      id={`${kind}_cap_wages`}
                      type="number"
                      step="1"
                      min="0"
                      value={values[`${kind}_cap_wages`] ?? ""}
                      onChange={(e) => setValues((prev) => ({ ...prev, [`${kind}_cap_wages`]: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Forma de cálculo</Label>
                  <Select
                    value={values[`${kind}_method`] ?? "monthly"}
                    onValueChange={(v) => setValues((prev) => ({ ...prev, [`${kind}_method`]: v }))}
                  >
                    <SelectTrigger aria-label={`${CONTRIBUTION_LABELS[kind]}: forma de cálculo`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(CONTRIBUTION_METHOD_LABELS) as ContributionMethod[]).map((m) => (
                        <SelectItem key={m} value={m}>{CONTRIBUTION_METHOD_LABELS[m]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="contributions-valid-from">Aplica desde</Label>
              <Input id="contributions-valid-from" type="date" min={today} value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
            </div>
            <Button disabled={changes.length === 0 || !isValid || validFrom < today} onClick={() => setConfirmOpen(true)}>
              Guardar nueva versión
            </Button>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Desde</TableHead>
                  <TableHead className="text-right">Salario mín.</TableHead>
                  {CONTRIBUTION_KINDS.map((kind) => (
                    <TableHead key={kind} className="text-right">{CONTRIBUTION_LABELS[kind]}</TableHead>
                  ))}
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parameters.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDateOnly(p.valid_from)}
                      {p.id === current?.id && <Badge variant="outline" className="ml-2">Vigente</Badge>}
                      {p.valid_from > today && <Badge variant="secondary" className="ml-2">Programada</Badge>}
                    </TableCell>
                    <TableCell className="text-right">{p.minimum_wage_ves}</TableCell>
                    {CONTRIBUTION_KINDS.map((kind) => (
                      <TableCell key={kind} className="text-right text-xs whitespace-nowrap">
                        {p[`${kind}_pct`]} %
                        {Number(p[`${kind}_cap_wages`]) > 0 ? ` · tope ${p[`${kind}_cap_wages`]}` : " · sin tope"}
                        {p[`${kind}_method`] === "mondays" ? " · lunes" : " · mes"}
                      </TableCell>
                    ))}
                    <TableCell>
                      {p.valid_from > today && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          title="Borrar versión programada"
                          onClick={() => deleteFutureParameters.mutate(p.id, { onError: showError })}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar cambio</DialogTitle>
            <DialogDescription>Aplica a los pagos desde el {formatDateOnly(validFrom)}. Los anteriores no cambian.</DialogDescription>
          </DialogHeader>
          <ul className="space-y-1 text-sm">
            {changes.map((key) => (
              <li key={key} className="flex justify-between gap-3">
                <span>{labelOf(key)}</span>
                <span className="font-medium whitespace-nowrap">
                  {shown(key, current?.[key as keyof ContributionParameters] as string | number)} → {shown(key, values[key])}
                </span>
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
    </div>
  );
}
