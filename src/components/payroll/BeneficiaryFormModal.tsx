import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePayrollBeneficiaries } from "@/hooks/payroll/usePayrollBeneficiaries";
import { usePayrollTeachers } from "@/hooks/payroll/usePayrollTeachers";
import { CATEGORY_LABELS, type PayrollBeneficiary, type PayrollCategory } from "@/lib/payroll/types";

interface BeneficiaryFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolId: string;
  beneficiary?: PayrollBeneficiary | null;
}

const CATEGORY_ORDER: PayrollCategory[] = ["teacher", "admin", "worker", "other"];

export function BeneficiaryFormModal({ open, onOpenChange, schoolId, beneficiary }: BeneficiaryFormModalProps) {
  const { toast } = useToast();
  const { createBeneficiary, updateBeneficiary } = usePayrollBeneficiaries(schoolId);
  const { data: teachers = [] } = usePayrollTeachers(schoolId);

  const [category, setCategory] = useState<PayrollCategory>("other");
  const [teacherId, setTeacherId] = useState<string>("");
  const [fullName, setFullName] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  const isEdit = !!beneficiary;

  useEffect(() => {
    if (!open) return;
    setCategory(beneficiary?.category ?? "other");
    setTeacherId(beneficiary?.teacher_id ?? "");
    setFullName(beneficiary?.full_name ?? "");
    setDocumentId(beneficiary?.document_id ?? "");
    setEmail(beneficiary?.email ?? "");
    setPhone(beneficiary?.phone ?? "");
    setNotes(beneficiary?.notes ?? "");
  }, [open, beneficiary]);

  const onPickTeacher = (id: string) => {
    setTeacherId(id);
    const t = teachers.find((x) => x.id === id);
    if (t) {
      setFullName(t.name);
      setDocumentId(t.document_id ?? "");
      setEmail(t.email ?? "");
      setPhone(t.phone ?? "");
    }
  };

  const isSaving = createBeneficiary.isPending || updateBeneficiary.isPending;

  const handleSubmit = () => {
    if (!fullName.trim()) {
      toast({ title: "El nombre es obligatorio", variant: "destructive" });
      return;
    }
    const payload = {
      category,
      teacher_id: category === "teacher" ? teacherId || null : null,
      full_name: fullName.trim(),
      document_id: documentId.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      notes: notes.trim() || null,
    };
    const onSuccess = () => {
      toast({ title: isEdit ? "Beneficiario actualizado" : "Beneficiario registrado" });
      onOpenChange(false);
    };
    const onError = (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" });

    if (isEdit && beneficiary) {
      updateBeneficiary.mutate({ id: beneficiary.id, ...payload }, { onSuccess, onError });
    } else {
      createBeneficiary.mutate(payload, { onSuccess, onError });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Beneficiario" : "Nuevo Beneficiario"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-2">
            <Label>Categoría *</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as PayrollCategory)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORY_ORDER.map((c) => (
                  <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {category === "teacher" && (
            <div className="space-y-2">
              <Label>Docente</Label>
              <Select value={teacherId} onValueChange={onPickTeacher}>
                <SelectTrigger><SelectValue placeholder="Seleccione un docente" /></SelectTrigger>
                <SelectContent>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}{t.document_id ? ` — ${t.document_id}` : ""}
                    </SelectItem>
                  ))}
                  {teachers.length === 0 && (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">No hay docentes registrados</div>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Al elegir un docente se completan sus datos automáticamente.</p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Nombre completo *</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nombre y apellido" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Cédula</Label>
              <Input value={documentId} onChange={(e) => setDocumentId(e.target.value)} placeholder="V-12345678" />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Correo</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@ejemplo.com" />
            <p className="text-xs text-muted-foreground">Se usa para enviarle el recibo de pago.</p>
          </div>
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving && <Loader2 className="animate-spin h-4 w-4 mr-1" />}
            {isEdit ? "Guardar" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
