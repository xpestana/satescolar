import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Receipt, Upload, AlertTriangle } from "lucide-react";
import { VENEZUELAN_BANKS, METHOD_TYPE_LABELS } from "@/lib/venezuelan-banks";
import { ensureFreshBcvRates } from "@/lib/ensureFreshBcvRates";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  schoolId: string;
  schoolYearId: string;
  familyId: string;
  studentId: string;
  studentName: string;
  balance: any; // student_concept_balances row with payment_plan_concepts(payment_concepts(name))
}

export function PaymentReportModal({
  open, onOpenChange, schoolId, schoolYearId, familyId, studentId, studentName, balance,
}: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const conceptName = balance?.payment_plan_concepts?.payment_concepts?.name || "Cuota";
  const conceptCurrency = balance?.concept_currency || balance?.currency || "VES";

  const [amount, setAmount] = useState<string>("");
  const [paymentCurrency, setPaymentCurrency] = useState<string>("VES");
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [schoolMethodId, setSchoolMethodId] = useState<string>("");
  const [payerMethod, setPayerMethod] = useState<string>("transferencia");
  const [payerBank, setPayerBank] = useState<string>("");
  const [payerPhone, setPayerPhone] = useState<string>("");
  const [payerDocument, setPayerDocument] = useState<string>("");
  const [payerEmail, setPayerEmail] = useState<string>("");
  const [payerHolder, setPayerHolder] = useState<string>("");
  const [reference, setReference] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open && balance) {
      const initialCurrency = conceptCurrency;
      setPaymentCurrency(initialCurrency);
      setAmount(
        Number(
          initialCurrency === conceptCurrency
            ? (balance?.remaining_original_amount ?? balance?.balance ?? 0)
            : 0
        ).toFixed(2)
      );
      setPaymentDate(new Date().toISOString().split("T")[0]);
      setSchoolMethodId("");
      setPayerMethod("transferencia");
      setPayerBank(""); setPayerPhone(""); setPayerDocument("");
      setPayerEmail(""); setPayerHolder(""); setReference("");
      setNotes(""); setFile(null);
    }
  }, [open, balance, conceptCurrency]);

  useEffect(() => {
    if (!open || !schoolId) return;
    let cancelled = false;

    (async () => {
      try {
        const result = await ensureFreshBcvRates();
        if (!cancelled && result.updated) {
          qc.invalidateQueries({ queryKey: ["exchange-rates", schoolId] });
          qc.invalidateQueries({ queryKey: ["bcv-latest-public", schoolId] });
          qc.invalidateQueries({ queryKey: ["family-delinquent-balances-rep"] });
        }
      } catch {
        if (!cancelled) {
          toast({
            title: "Tasa BCV no actualizada",
            description: "No se pudo actualizar BCV hoy. Se usará la última tasa disponible.",
            variant: "destructive",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, schoolId, qc, toast]);

  const { data: schoolMethods = [] } = useQuery({
    queryKey: ["school-payment-methods-public", schoolId],
    queryFn: async () => {
      const { data } = await supabase.from("school_payment_methods")
        .select("*")
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .order("display_order");
      return data || [];
    },
    enabled: open && !!schoolId,
  });

  const selectedSchoolMethod = useMemo(
    () => schoolMethods.find((m: any) => m.id === schoolMethodId),
    [schoolMethods, schoolMethodId]
  );

  const { data: rates = [] } = useQuery({
    queryKey: ["exchange-rates", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exchange_rates")
        .select("currency, rate_to_ves, updated_at")
        .eq("school_id", schoolId);
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!schoolId,
  });

  const { data: bcvInfo } = useQuery({
    queryKey: ["bcv-latest-public", schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from("bcv_rates")
        .select("published_date, fetched_at")
        .eq("currency", "USD")
        .order("published_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: open && !!schoolId,
  });

  const getRateToVes = (currency: string) => {
    if (currency === "VES") return 1;
    return Number(rates.find((r: any) => r.currency === currency)?.rate_to_ves || 1);
  };

  const amountNum = Number(amount || 0);
  const selectedRate = getRateToVes(paymentCurrency);
  const equivalentVes = amountNum * selectedRate;

  const isZelle = payerMethod === "zelle";
  const requiresBank = ["transferencia", "pago_movil"].includes(payerMethod);

  const submit = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Debe adjuntar el capture del pago (obligatorio)");
      if (!schoolMethodId) throw new Error("Seleccione el método de pago del colegio (a dónde envió el dinero)");
      if (!amount || parseFloat(amount) <= 0) throw new Error("Ingrese el monto pagado");
      if (requiresBank && !payerBank) throw new Error("Indique el banco desde el que pagó");
      if (requiresBank && !payerPhone && payerMethod === "pago_movil") throw new Error("Indique el teléfono del titular");
      if (requiresBank && !payerDocument) throw new Error("Indique la cédula del titular");
      if (isZelle && !payerEmail) throw new Error("Indique el correo de la cuenta Zelle");
      if (isZelle && !payerHolder) throw new Error("Indique el nombre del titular de la cuenta Zelle");
      if (!reference && payerMethod !== "efectivo") throw new Error("Indique el número de referencia");

      // Upload receipt to storage bucket payment-receipts
      setUploading(true);
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const path = `${schoolId}/${familyId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("payment-receipts")
        .upload(path, file, { contentType: file.type, upsert: false });
      setUploading(false);
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("payment_reports").insert({
        school_id: schoolId,
        family_id: familyId,
        student_id: studentId,
        school_year_id: schoolYearId,
        reported_by: user!.id,
        plan_concept_id: balance?.plan_concept_id || null,
        concept_name: conceptName,
        amount_reported: parseFloat(amount),
        currency_reported: paymentCurrency,
        payment_date: paymentDate,
        school_payment_method_id: schoolMethodId,
        school_method_label: selectedSchoolMethod?.label || "",
        payer_method: payerMethod,
        payer_bank_name: payerBank,
        payer_phone: payerPhone,
        payer_document: payerDocument,
        payer_account_email: payerEmail,
        payer_account_holder: payerHolder,
        reference_code: reference,
        receipt_url: path,
        notes,
        status: "pending",
      });
      if (insErr) throw insErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment-reports-family"] });
      qc.invalidateQueries({ queryKey: ["family-delinquent-balances-rep"] });
      toast({ title: "Pago reportado", description: "El colegio revisará tu reporte y lo confirmará pronto." });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const cfg = (selectedSchoolMethod?.config || {}) as Record<string, any>;
  const cfgDetails = [
    cfg.bank_name,
    cfg.account_number ? `Cta: ...${String(cfg.account_number).slice(-4)}` : null,
    cfg.account_holder,
    cfg.phone,
    cfg.email,
    cfg.document_id,
  ].filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" />Reportar pago</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4 grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Estudiante:</span><p className="font-medium">{studentName}</p></div>
              <div><span className="text-muted-foreground">Cuota:</span><p className="font-medium">{conceptName}</p></div>
              <div>
                <span className="text-muted-foreground">Saldo vencido:</span>
                <p className="font-medium">
                  {Number(balance?.remaining_original_amount ?? balance?.balance ?? 0).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {conceptCurrency}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Equiv. hoy: {Number(balance?.balance_ves_today ?? balance?.balance ?? 0).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} VES
                </p>
              </div>
              <div><span className="text-muted-foreground">Estado:</span><p><Badge variant="outline">Cuota pendiente</Badge></p></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3"><CardTitle className="text-sm">Datos del pago</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Tasas de referencia</p>
                <p>
                  USD: {getRateToVes("USD").toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ·
                  EUR: {getRateToVes("EUR").toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ·
                  COP: {getRateToVes("COP").toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                {bcvInfo?.published_date && (
                  <p className="mt-1">
                    BCV publicado: {new Date(`${bcvInfo.published_date}T12:00:00`).toLocaleDateString("es-VE")}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Moneda del pago *</Label>
                  <Select
                    value={paymentCurrency}
                    onValueChange={(newCurrency) => {
                      if (newCurrency !== paymentCurrency) {
                        const oldRate = getRateToVes(paymentCurrency);
                        const newRate = getRateToVes(newCurrency);
                        const currentAmount = Number(amount || 0);
                        if (currentAmount > 0 && oldRate > 0 && newRate > 0) {
                          const ves = currentAmount * oldRate;
                          const converted = ves / newRate;
                          setAmount(converted.toFixed(2));
                        }
                      }
                      setPaymentCurrency(newCurrency);
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VES">VES</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="COP">COP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Monto pagado ({paymentCurrency}) *</Label>
                  <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  <p className="text-[11px] text-muted-foreground">
                    Equivalente: {equivalentVes.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} VES
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fecha del pago *</Label>
                  <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">¿A qué método del colegio envió el dinero? *</Label>
                <Select value={schoolMethodId} onValueChange={setSchoolMethodId}>
                  <SelectTrigger><SelectValue placeholder="Seleccione cuenta destino" /></SelectTrigger>
                  <SelectContent>
                    {schoolMethods.length === 0 && <SelectItem value="__none__" disabled>El colegio no ha configurado métodos</SelectItem>}
                    {schoolMethods.map((m: any) => (
                      <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {cfgDetails.length > 0 && (
                  <p className="text-[11px] text-muted-foreground">{cfgDetails.join(" · ")}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Método utilizado *</Label>
                <Select value={payerMethod} onValueChange={setPayerMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(METHOD_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {requiresBank && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">Banco desde el que pagó *</Label>
                    <Select value={payerBank} onValueChange={setPayerBank}>
                      <SelectTrigger><SelectValue placeholder="Seleccione banco" /></SelectTrigger>
                      <SelectContent>
                        {VENEZUELAN_BANKS.map((b) => (
                          <SelectItem key={b.codigo} value={b.nombre}>{b.codigo} - {b.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Teléfono del titular {payerMethod === "pago_movil" ? "*" : ""}</Label>
                    <Input value={payerPhone} onChange={(e) => setPayerPhone(e.target.value)} placeholder="04141234567" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Cédula del titular *</Label>
                    <Input value={payerDocument} onChange={(e) => setPayerDocument(e.target.value)} placeholder="V-12345678" />
                  </div>
                </div>
              )}

              {isZelle && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Correo de la cuenta Zelle *</Label>
                    <Input type="email" value={payerEmail} onChange={(e) => setPayerEmail(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Nombre del titular *</Label>
                    <Input value={payerHolder} onChange={(e) => setPayerHolder(e.target.value)} />
                  </div>
                </div>
              )}

              {payerMethod !== "efectivo" && (
                <div className="space-y-1">
                  <Label className="text-xs">N° de referencia *</Label>
                  <Input value={reference} onChange={(e) => setReference(e.target.value)} />
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs">Capture / comprobante (obligatorio) *</Label>
                <Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                {file && <p className="text-[11px] text-muted-foreground">{file.name} ({(file.size / 1024).toFixed(1)} KB)</p>}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Notas (opcional)</Label>
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <div className="rounded-md bg-muted/40 p-3 flex gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>El pago será confirmado por la administración del colegio. Recibirás una actualización en el listado de pagos.</span>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={() => submit.mutate()} disabled={submit.isPending || uploading}>
              {(submit.isPending || uploading) && <Loader2 className="animate-spin h-4 w-4 mr-1" />}
              <Upload className="h-4 w-4 mr-1" />Reportar pago
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
