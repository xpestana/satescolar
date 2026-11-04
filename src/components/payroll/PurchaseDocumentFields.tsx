import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { NO_ISLR_CONCEPT } from "@/lib/payroll/withholdings/beneficiaryFormSchema";
import type { DraftWithholding } from "@/lib/payroll/withholdings/buildPaymentDraft";
import { formatMoney } from "@/lib/payroll/buildPayrollReceiptData";
import type { IslrConcept } from "@/lib/payroll/withholdings/types";

export interface EditableDocument {
  key: string;
  documentType: "invoice" | "debit_note";
  documentNumber: string;
  controlNumber: string;
  issueDate: string;
  taxableBase: string;
  exemptAmount: string;
  vatRatePct: string;
  vatAmount: string;
  totalAmount: string;
  islrConceptId: string;
  isPettyCash: boolean;
  isVatNotItemized: boolean;
  isNonCompliant: boolean;
  vatOverrideOn: boolean;
  vatOverridePct: string;
  islrOverrideOn: boolean;
  islrOverridePct: string;
  overrideReason: string;
}

interface PurchaseDocumentFieldsProps {
  document: EditableDocument;
  concepts: IslrConcept[];
  showIslr: boolean;
  showVat: boolean;
  withholdings: DraftWithholding[];
  canRemove: boolean;
  onChange: (patch: Partial<EditableDocument>) => void;
  onRemove: () => void;
}

/** One invoice of a supplier payment, with the withholding it produces. */
export function PurchaseDocumentFields({
  document: doc,
  concepts,
  showIslr,
  showVat,
  withholdings,
  canRemove,
  onChange,
  onRemove,
}: PurchaseDocumentFieldsProps) {
  const updateBase = (taxableBase: string) => {
    const vat = (Number(taxableBase) * Number(doc.vatRatePct)) / 100;
    onChange({ taxableBase, vatAmount: taxableBase ? (Math.round(vat * 100) / 100).toString() : "" });
  };
  const updateVatRate = (vatRatePct: string) => {
    const vat = (Number(doc.taxableBase) * Number(vatRatePct)) / 100;
    onChange({ vatRatePct, vatAmount: doc.taxableBase ? (Math.round(vat * 100) / 100).toString() : doc.vatAmount });
  };

  const vat = withholdings.find((w) => w.tax_type === "vat");
  const islr = withholdings.find((w) => w.tax_type === "islr");

  return (
    <div className="rounded-md border p-3 space-y-3 min-w-0">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Tipo</Label>
          <Select value={doc.documentType} onValueChange={(v) => onChange({ documentType: v as EditableDocument["documentType"] })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="invoice">Factura</SelectItem>
              <SelectItem value="debit_note">Nota de débito</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Número *</Label>
          <Input className="h-8 text-xs" value={doc.documentNumber} onChange={(e) => onChange({ documentNumber: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">N° de control *</Label>
          <Input className="h-8 text-xs" value={doc.controlNumber} onChange={(e) => onChange({ controlNumber: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Fecha *</Label>
          <Input className="h-8 text-xs" type="date" value={doc.issueDate} onChange={(e) => onChange({ issueDate: e.target.value })} />
        </div>
      </div>

      {doc.isVatNotItemized ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Total de la factura *</Label>
            <Input className="h-8 text-xs" type="number" step="0.01" value={doc.totalAmount} onChange={(e) => onChange({ totalAmount: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Alícuota %</Label>
            <Input className="h-8 text-xs" type="number" step="0.01" value={doc.vatRatePct} onChange={(e) => updateVatRate(e.target.value)} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Base imponible</Label>
            <Input className="h-8 text-xs" type="number" step="0.01" value={doc.taxableBase} onChange={(e) => updateBase(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Monto exento</Label>
            <Input className="h-8 text-xs" type="number" step="0.01" value={doc.exemptAmount} onChange={(e) => onChange({ exemptAmount: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Alícuota %</Label>
            <Input className="h-8 text-xs" type="number" step="0.01" value={doc.vatRatePct} onChange={(e) => updateVatRate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">IVA</Label>
            <Input className="h-8 text-xs" type="number" step="0.01" value={doc.vatAmount} onChange={(e) => onChange({ vatAmount: e.target.value })} />
          </div>
        </div>
      )}

      {showIslr && (
        <div className="space-y-1">
          <Label className="text-xs">Concepto de ISLR *</Label>
          <Select value={doc.islrConceptId} onValueChange={(v) => onChange({ islrConceptId: v })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_ISLR_CONCEPT}>No aplica (venta de bienes)</SelectItem>
              {concepts.filter((c) => c.is_active).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {showVat && (
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
          <label className="flex items-center gap-1.5">
            <Checkbox checked={doc.isPettyCash} onCheckedChange={(v) => onChange({ isPettyCash: !!v })} />Caja chica
          </label>
          <label className="flex items-center gap-1.5">
            <Checkbox checked={doc.isVatNotItemized} onCheckedChange={(v) => onChange({ isVatNotItemized: !!v })} />IVA no discriminado
          </label>
          <label className="flex items-center gap-1.5">
            <Checkbox checked={doc.isNonCompliant} onCheckedChange={(v) => onChange({ isNonCompliant: !!v })} />Factura con incumplimientos
          </label>
        </div>
      )}

      {(vat || islr) && (
        <div className="rounded-md bg-muted/40 p-2 text-xs space-y-1">
          {vat && (
            <div className="flex justify-between gap-2">
              <span>Retención IVA{vat.no_withholding_reason ? `: ${vat.no_withholding_reason}` : ` ${vat.rate_pct} % de ${formatMoney(vat.tax_amount_ves, "VES")}`}</span>
              <span className="font-medium whitespace-nowrap">{formatMoney(vat.withheld_ves, "VES")}</span>
            </div>
          )}
          {islr && (
            <div className="flex justify-between gap-2">
              <span>
                Retención ISLR
                {islr.no_withholding_reason
                  ? `: ${islr.no_withholding_reason}`
                  : ` ${islr.rate_pct} %${islr.subtrahend_ves > 0 ? ` − sustraendo ${formatMoney(islr.subtrahend_ves, "VES")}` : ""}`}
              </span>
              <span className="font-medium whitespace-nowrap">{formatMoney(islr.withheld_ves, "VES")}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
            {vat && (
              <label className="flex items-center gap-1.5">
                <Checkbox checked={doc.vatOverrideOn} onCheckedChange={(v) => onChange({ vatOverrideOn: !!v })} />Cambiar % IVA
              </label>
            )}
            {islr && (
              <label className="flex items-center gap-1.5">
                <Checkbox checked={doc.islrOverrideOn} onCheckedChange={(v) => onChange({ islrOverrideOn: !!v })} />Cambiar % ISLR
              </label>
            )}
          </div>
          {(doc.vatOverrideOn || doc.islrOverrideOn) && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {doc.vatOverrideOn && (
                <Input className="h-8 text-xs" type="number" step="0.01" placeholder="% IVA" value={doc.vatOverridePct} onChange={(e) => onChange({ vatOverridePct: e.target.value })} />
              )}
              {doc.islrOverrideOn && (
                <Input className="h-8 text-xs" type="number" step="0.01" placeholder="% ISLR" value={doc.islrOverridePct} onChange={(e) => onChange({ islrOverridePct: e.target.value })} />
              )}
              <Input className="h-8 text-xs col-span-2" placeholder="Motivo del cambio *" value={doc.overrideReason} onChange={(e) => onChange({ overrideReason: e.target.value })} />
            </div>
          )}
        </div>
      )}

      {canRemove && (
        <div className="flex justify-end">
          <Button type="button" size="sm" variant="ghost" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5 mr-1 text-destructive" />Quitar
          </Button>
        </div>
      )}
    </div>
  );
}
