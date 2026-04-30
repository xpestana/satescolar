import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardSkeleton } from "@/components/ui/loading-skeletons";
import { useSchoolId } from "@/hooks/useSchoolId";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Bell } from "lucide-react";

const WEEK_DAYS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const MONTH_DAYS = [1, 5, 10, 15, 20, 25, 28];

export default function DelinquencyConfig() {
  const { schoolId, isLoading: schoolLoading } = useSchoolId();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [overdueDay, setOverdueDay] = useState("15");
  const [reminderMode, setReminderMode] = useState("never");
  const [selectedWeekDays, setSelectedWeekDays] = useState<string[]>([]);
  const [selectedMonthDays, setSelectedMonthDays] = useState<number[]>([]);

  const { data: config, isLoading } = useQuery({
    queryKey: ["delinquency-config", schoolId],
    queryFn: async () => {
      const { data } = await supabase.from("delinquency_config").select("*").eq("school_id", schoolId!).maybeSingle();
      return data;
    },
    enabled: !!schoolId,
  });

  useEffect(() => {
    if (config) {
      setOverdueDay(config.overdue_after_day?.toString() || "15");
      setReminderMode(config.reminder_mode || "never");
      setSelectedWeekDays((config.reminder_days_of_week as string[]) || []);
      setSelectedMonthDays((config.reminder_days_of_month as number[]) || []);
    }
  }, [config]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        school_id: schoolId!,
        overdue_after_day: parseInt(overdueDay) || 15,
        reminder_mode: reminderMode,
        reminder_days_of_week: reminderMode === "weekly" ? selectedWeekDays : null,
        reminder_days_of_month: reminderMode === "monthly_days" ? selectedMonthDays : null,
      };
      if (config) {
        const { error } = await supabase.from("delinquency_config").update(payload).eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("delinquency_config").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["delinquency-config"] });
      toast({ title: "Configuración guardada" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleWeekDay = (day: string) => {
    setSelectedWeekDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]);
  };
  const toggleMonthDay = (day: number) => {
    setSelectedMonthDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]);
  };

  if (schoolLoading || !schoolId) return <DashboardLayout><DashboardSkeleton /></DashboardLayout>;

  return (
    <DashboardLayout>
      <PageHeader title="Configuración de Morosidad" breadcrumbs={[{ label: "Administrativo", href: "/pagos" }, { label: "Configuración Morosidad" }]} />

      <div className="max-w-2xl space-y-6">
        {isLoading ? <Loader2 className="animate-spin mx-auto" /> : (
          <>
            <Card>
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Bell className="h-5 w-5" />Día de Corte</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label>A partir del día del mes se considera moroso:</Label>
                  <Input type="number" min="1" max="31" value={overdueDay} onChange={(e) => setOverdueDay(e.target.value)} className="w-32" />
                  <p className="text-xs text-muted-foreground">Si un concepto tiene día de vencimiento y no ha sido pagado después de este día, el alumno se considera moroso.</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Frecuencia de Recordatorios</CardTitle></CardHeader>
              <CardContent>
                <RadioGroup value={reminderMode} onValueChange={setReminderMode} className="space-y-4">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="never" id="never" /><Label htmlFor="never">Nunca (no enviar recordatorios automáticos)</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="daily" id="daily" /><Label htmlFor="daily">Diario</Label>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="weekly" id="weekly" /><Label htmlFor="weekly">Días específicos de la semana</Label>
                    </div>
                    {reminderMode === "weekly" && (
                      <div className="ml-6 flex flex-wrap gap-3">
                        {WEEK_DAYS.map((day) => (
                          <div key={day} className="flex items-center gap-1.5">
                            <Checkbox checked={selectedWeekDays.includes(day)} onCheckedChange={() => toggleWeekDay(day)} />
                            <Label className="text-sm capitalize">{day}</Label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="monthly_days" id="monthly_days" /><Label htmlFor="monthly_days">Días específicos del mes</Label>
                    </div>
                    {reminderMode === "monthly_days" && (
                      <div className="ml-6 flex flex-wrap gap-3">
                        {MONTH_DAYS.map((day) => (
                          <div key={day} className="flex items-center gap-1.5">
                            <Checkbox checked={selectedMonthDays.includes(day)} onCheckedChange={() => toggleMonthDay(day)} />
                            <Label className="text-sm">Día {day}</Label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="w-full">
              {saveMut.isPending ? <Loader2 className="animate-spin h-4 w-4 mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Guardar Configuración
            </Button>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
