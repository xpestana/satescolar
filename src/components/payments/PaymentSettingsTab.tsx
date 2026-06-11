import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, User, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useBillingMode, useSetBillingMode, type BillingMode } from "@/hooks/useBillingMode";

export function PaymentSettingsTab({ schoolId }: { schoolId: string }) {
  const { toast } = useToast();
  const { billingMode, isLoading } = useBillingMode(schoolId);
  const setBillingMode = useSetBillingMode(schoolId);
  const [mode, setMode] = useState<BillingMode>(billingMode);

  useEffect(() => { setMode(billingMode); }, [billingMode]);

  const save = () => {
    setBillingMode.mutate(mode, {
      onSuccess: () => toast({
        title: "Configuración guardada",
        description: mode === "family"
          ? "El registro de pagos, morosidad y estado de cuenta ahora se manejan por familia."
          : "El registro de pagos, morosidad y estado de cuenta se manejan por estudiante.",
      }),
      onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Modo de Facturación</CardTitle>
        <CardDescription>
          Define cómo se registran los pagos en el colegio. Los planes de pago y los saldos
          siguen siendo por estudiante en ambos modos; puede cambiar esta opción en cualquier momento.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="py-6 text-center"><Loader2 className="animate-spin h-5 w-5 mx-auto" /></div>
        ) : (
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as BillingMode)} className="grid gap-3 md:grid-cols-2">
            <Label
              htmlFor="mode-student"
              className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${mode === "student" ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
            >
              <RadioGroupItem value="student" id="mode-student" className="mt-1" />
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-medium"><User className="h-4 w-4" />Por estudiante</div>
                <p className="text-xs text-muted-foreground font-normal leading-relaxed">
                  Cada pago se registra seleccionando un estudiante. La morosidad y el estado de cuenta
                  se consultan por estudiante individual.
                </p>
              </div>
            </Label>
            <Label
              htmlFor="mode-family"
              className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${mode === "family" ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
            >
              <RadioGroupItem value="family" id="mode-family" className="mt-1" />
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-medium"><Users className="h-4 w-4" />Por familia</div>
                <p className="text-xs text-muted-foreground font-normal leading-relaxed">
                  El pago se registra por familia con una factura única que cubre las cuotas de todos
                  sus hijos inscritos. La morosidad y el estado de cuenta se consolidan por familia.
                </p>
              </div>
            </Label>
          </RadioGroup>
        )}
        <div className="flex justify-end">
          <Button onClick={save} disabled={isLoading || setBillingMode.isPending || mode === billingMode}>
            {setBillingMode.isPending && <Loader2 className="animate-spin h-4 w-4 mr-1" />}
            Guardar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
