import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePayrollTaxConfig } from "@/hooks/payroll/usePayrollTaxConfig";
import { IslrRatesCard } from "@/components/payroll/IslrRatesCard";
import { WithholdingParametersCard } from "@/components/payroll/WithholdingParametersCard";
import { formatDateOnly } from "@/lib/dateUtils";

type Tax = "vat" | "islr";

const TAX_COPY: Record<Tax, { label: string; on: string; off: string }> = {
  vat: {
    label: "IVA",
    on: "Se retendrá IVA a los proveedores y se emitirán comprobantes.",
    off: "Dejará de calcularse la retención de IVA en los pagos nuevos. Lo ya emitido no cambia.",
  },
  islr: {
    label: "ISLR",
    on: "Se retendrá ISLR a proveedores y personal, y se pedirá el % de AR-I de cada trabajador.",
    off: "Dejará de calcularse la retención de ISLR en los pagos nuevos. Lo ya emitido no cambia.",
  },
};

/** Settings tab: turn withholdings on, adjust percentages and set the voucher numbering. */
export function PayrollWithholdingsConfigTab({ schoolId }: { schoolId: string }) {
  const { toast } = useToast();
  const { settings, vatEnabled, islrEnabled, isLoading, ensureDefaults, updateSettings, markRatesValidated } = usePayrollTaxConfig(schoolId);
  const [confirmTax, setConfirmTax] = useState<Tax | null>(null);
  const [nextVat, setNextVat] = useState("1");
  const [nextIslr, setNextIslr] = useState("1");

  useEffect(() => {
    if (!settings) return;
    setNextVat(String(settings.next_vat_voucher_seq));
    setNextIslr(String(settings.next_islr_voucher_seq));
  }, [settings]);

  const showError = (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" });

  if (isLoading) {
    return <Card><CardContent className="py-8 text-center text-muted-foreground">Cargando...</CardContent></Card>;
  }

  if (!settings) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Retenciones de IVA e ISLR</CardTitle>
          <CardDescription>
            Para colegios que son agentes de retención. Se cargan unos valores iniciales que el contador debe revisar,
            y seguirán apagadas hasta que las active.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => ensureDefaults.mutate(undefined, { onError: showError })} disabled={ensureDefaults.isPending}>
            {ensureDefaults.isPending && <Loader2 className="animate-spin h-4 w-4 mr-1" />}Configurar retenciones
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isOn = (tax: Tax) => (tax === "vat" ? vatEnabled : islrEnabled);

  const confirmToggle = () => {
    if (!confirmTax) return;
    const field = confirmTax === "vat" ? "vat_agent_enabled" : "islr_agent_enabled";
    updateSettings.mutate(
      { [field]: !isOn(confirmTax) },
      {
        onSuccess: () => {
          toast({ title: `Retención de ${TAX_COPY[confirmTax].label} ${isOn(confirmTax) ? "desactivada" : "activada"}` });
          setConfirmTax(null);
        },
        onError: showError,
      }
    );
  };

  const validateRates = () => {
    markRatesValidated.mutate(undefined, {
      onSuccess: () => toast({ title: "Tabla marcada como validada" }),
      onError: showError,
    });
  };

  const saveSequences = () => {
    updateSettings.mutate(
      { next_vat_voucher_seq: Number(nextVat), next_islr_voucher_seq: Number(nextIslr) },
      { onSuccess: () => toast({ title: "Consecutivos guardados" }), onError: showError }
    );
  };

  const validSequence = (value: string) => Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 99999999;
  const sequencesChanged =
    Number(nextVat) !== settings.next_vat_voucher_seq || Number(nextIslr) !== settings.next_islr_voucher_seq;

  return (
    <div className="space-y-4">
      {!settings.rates_validated_at ? (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Tabla por validar</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>Estos valores son un punto de partida. Debe revisarlos el contador del colegio antes de activar las retenciones.</p>
            <Button size="sm" variant="outline" onClick={validateRates} disabled={markRatesValidated.isPending}>
              Marcar como validada por el contador
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <p className="text-xs text-muted-foreground">Tabla validada el {formatDateOnly(settings.rates_validated_at.slice(0, 10))}.</p>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Activación</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {(["vat", "islr"] as Tax[]).map((tax) => (
            <div key={tax} className="flex items-center justify-between gap-3">
              <Label htmlFor={`toggle-${tax}`}>Retener {TAX_COPY[tax].label}</Label>
              <Switch id={`toggle-${tax}`} checked={isOn(tax)} onCheckedChange={() => setConfirmTax(tax)} />
            </div>
          ))}
        </CardContent>
      </Card>

      <WithholdingParametersCard schoolId={schoolId} />
      <IslrRatesCard schoolId={schoolId} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Numeración de comprobantes</CardTitle>
          <CardDescription>Escriba el próximo número para continuar la secuencia que lleva hoy el colegio.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="next-vat">Próximo comprobante de IVA</Label>
            <Input id="next-vat" type="number" min="1" className="w-44" value={nextVat} onChange={(e) => setNextVat(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="next-islr">Próximo comprobante de ISLR</Label>
            <Input id="next-islr" type="number" min="1" className="w-44" value={nextIslr} onChange={(e) => setNextIslr(e.target.value)} />
          </div>
          <Button
            variant="outline"
            onClick={saveSequences}
            disabled={!sequencesChanged || !validSequence(nextVat) || !validSequence(nextIslr) || updateSettings.isPending}
          >
            Guardar
          </Button>
        </CardContent>
      </Card>

      <Dialog open={!!confirmTax} onOpenChange={(v) => !v && setConfirmTax(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirmTax && `${isOn(confirmTax) ? "Desactivar" : "Activar"} la retención de ${TAX_COPY[confirmTax].label}`}
            </DialogTitle>
            <DialogDescription>
              {confirmTax && (isOn(confirmTax) ? TAX_COPY[confirmTax].off : TAX_COPY[confirmTax].on)}
              {confirmTax && !isOn(confirmTax) && !settings.rates_validated_at && " La tabla todavía no está validada por el contador."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmTax(null)}>Cancelar</Button>
            <Button onClick={confirmToggle} disabled={updateSettings.isPending}>
              {updateSettings.isPending && <Loader2 className="animate-spin h-4 w-4 mr-1" />}Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
