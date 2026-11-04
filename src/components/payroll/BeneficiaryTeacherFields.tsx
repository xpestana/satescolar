import { Link } from "react-router-dom";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TeacherOption } from "@/hooks/payroll/usePayrollTeachers";

interface BeneficiaryTeacherFieldsProps {
  teachers: TeacherOption[];
  mode: "linked" | "payroll_only";
  teacherId: string;
  error?: string;
  canAddInTeachersArea: boolean;
  onModeChange: (mode: "linked" | "payroll_only") => void;
  onPickTeacher: (teacherId: string) => void;
}

/** A teacher can be linked to the Teachers area or live only in payroll, with no account. */
export function BeneficiaryTeacherFields({
  teachers,
  mode,
  teacherId,
  error,
  canAddInTeachersArea,
  onModeChange,
  onPickTeacher,
}: BeneficiaryTeacherFieldsProps) {
  const addLink = canAddInTeachersArea && (
    <Link to="/registros/docentes/nuevo" className="text-primary underline">
      agregarlo en Docentes
    </Link>
  );

  if (teachers.length === 0) {
    return (
      <p className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
        No hay docentes activos, así que se registrará solo en Nómina, sin cuenta ni acceso al sistema.
        {addLink && <> Si necesita acceso, puede {addLink}.</>}
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3">
      <RadioGroup value={mode} onValueChange={(v) => onModeChange(v as "linked" | "payroll_only")} className="gap-2">
        <div className="flex items-center gap-2">
          <RadioGroupItem value="linked" id="teacher-linked" />
          <Label htmlFor="teacher-linked" className="font-normal">Vincular un docente registrado</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="payroll_only" id="teacher-payroll-only" />
          <Label htmlFor="teacher-payroll-only" className="font-normal">Registrar solo en Nómina</Label>
        </div>
      </RadioGroup>

      {mode === "linked" ? (
        <div className="space-y-2">
          <Label>Docente *</Label>
          <Select value={teacherId} onValueChange={onPickTeacher}>
            <SelectTrigger><SelectValue placeholder="Seleccione un docente" /></SelectTrigger>
            <SelectContent>
              {teachers.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}{t.document_id ? ` — ${t.document_id}` : ""}{t.isSuspended ? " (suspendido)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <p className="text-xs text-muted-foreground">Al elegirlo se completan sus datos.</p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          No crea cuenta ni acceso. Si luego se agrega en Docentes con la misma cédula, se vincula solo.
          {addLink && <> También puede {addLink}.</>}
        </p>
      )}
    </div>
  );
}
