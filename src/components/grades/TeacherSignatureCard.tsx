import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Loader2, Save } from "lucide-react";
import { BoletinSignature } from "@/lib/bachilleratoTemplate";
import { SignatureFieldsCard } from "@/components/grades/SignatureFields";

export interface TeacherSignatureRow extends BoletinSignature {
  is_active: boolean;
}

const teacherFullName = (formData: unknown) => {
  const fd = (formData ?? {}) as Record<string, any>;
  const first = fd.nombre || fd.primer_nombre || "";
  const last = fd.apellido || fd.primer_apellido || "";
  return `${first} ${last}`.trim();
};

const EMPTY: TeacherSignatureRow = {
  nombre: "", cedula: "", cargo: "", firma_url: "", sello_url: "", is_active: true,
};

/**
 * Lets a teacher (or the school on their behalf) set the signature printed on the
 * boletas they author. One signature per teacher, reused across all their boletas.
 */
export default function TeacherSignatureCard({ teacherId, schoolId, canEdit = true }: {
  teacherId: string;
  schoolId: string;
  canEdit?: boolean;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<TeacherSignatureRow>(EMPTY);
  const [dirty, setDirty] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["teacher-signature", teacherId],
    queryFn: async () => {
      const [sigRes, teacherRes] = await Promise.all([
        supabase
          .from("teacher_signatures")
          .select("nombre, cedula, cargo, firma_url, sello_url, is_active")
          .eq("teacher_id", teacherId)
          .maybeSingle(),
        supabase
          .from("teachers")
          .select("form_data, document_id")
          .eq("id", teacherId)
          .maybeSingle(),
      ]);
      if (sigRes.error) throw sigRes.error;
      return { signature: sigRes.data as TeacherSignatureRow | null, teacher: teacherRes.data };
    },
    enabled: !!teacherId,
  });

  // Prefill from the teacher record the first time — nombre lives in form_data,
  // cédula in the dedicated document_id column. There is no cargo in the schema.
  useEffect(() => {
    if (!data) return;
    setForm(
      data.signature ?? {
        ...EMPTY,
        nombre: teacherFullName(data.teacher?.form_data),
        cedula: data.teacher?.document_id ?? "",
      },
    );
    setDirty(false);
  }, [data]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("teacher_signatures")
        .upsert({ teacher_id: teacherId, school_id: schoolId, ...form }, { onConflict: "teacher_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["teacher-signature", teacherId] });
      toast.success("Firma guardada");
    },
    onError: (e: any) => toast.error("No se pudo guardar la firma", { description: e.message }),
  });

  const upd = (patch: Partial<TeacherSignatureRow>) => {
    setForm((f) => ({ ...f, ...patch }));
    setDirty(true);
  };

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none"
          onClick={() => setOpen((v) => !v)}>
          <span className="text-sm font-medium flex-1">Firma del docente en la boleta</span>
          {form.is_active
            ? <span className="text-xs text-muted-foreground">Se imprime</span>
            : <span className="text-xs text-muted-foreground">No se imprime</span>}
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </div>

        {open && (
          <div className="border-t p-4 space-y-3">
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_active} disabled={!canEdit}
                    onCheckedChange={(v) => upd({ is_active: v })} className="scale-75" />
                  <Label className="text-xs">Incluir esta firma en las boletas</Label>
                </div>

                <div className="max-w-md">
                  <SignatureFieldsCard sig={form} schoolId={schoolId} uploadPrefix="teacher-sig"
                    disabled={!canEdit} onChange={upd} />
                </div>

                {canEdit && (
                  <Button size="sm" className="h-7 text-xs" disabled={!dirty || saveMut.isPending}
                    onClick={() => saveMut.mutate()}>
                    {saveMut.isPending
                      ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      : <Save className="h-3.5 w-3.5 mr-1" />}
                    Guardar firma
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
