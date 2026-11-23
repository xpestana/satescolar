import { useEffect, useState } from "react";
import { Loader2, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useClientBillingSettings } from "@/hooks/clients/useClientBillingSettings";

const DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

/** Platform-wide billing settings: reminder days, payment details and WhatsApp shown in the emails. */
export function BillingSettingsDialog() {
  const { settings, save } = useClientBillingSettings();
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState<number[]>([15]);
  const [instructions, setInstructions] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (!open || !settings) return;
    setDays(settings.reminder_days);
    setInstructions(settings.payment_instructions ?? "");
    setPhone(settings.contact_phone ?? "");
  }, [open, settings]);

  const toggleDay = (day: number) =>
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)));

  const handleSave = async () => {
    try {
      await save.mutateAsync({
        reminder_days: days,
        payment_instructions: instructions.trim() || null,
        contact_phone: phone.trim() || null,
      });
      toast.success("Ajustes de cobro guardados");
      setOpen(false);
    } catch (error) {
      console.error("Error saving billing settings:", error);
      toast.error("No se pudieron guardar los ajustes");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="shadow-sm">
          <Settings2 className="mr-2 h-4 w-4" />
          Ajustes de cobro
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajustes de cobro</DialogTitle>
          <DialogDescription>Se aplican a todos los clientes reales con recordatorios activos.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Días del mes en que se envía el recordatorio</Label>
            <div className="grid grid-cols-7 gap-1.5">
              {DAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={cn(
                    "rounded-md border py-1.5 text-sm transition-colors",
                    days.includes(day) ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                  )}
                  aria-pressed={days.includes(day)}
                >
                  {day}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {days.length === 0
                ? "Sin días seleccionados: no se enviarán recordatorios automáticos."
                : `Se envía a las 9:00 a. m. (hora de Venezuela) los días ${days.join(", ")} a quienes tengan meses pendientes.`}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="billing-instructions">Datos para el pago</Label>
            <Textarea
              id="billing-instructions"
              rows={5}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder={"Pago móvil: Banco ..., 0414-..., C.I./RIF ...\nTransferencia: ...\nZelle: ..."}
            />
            <p className="text-xs text-muted-foreground">Aparece en el correo de recordatorio.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="billing-phone">WhatsApp para enviar comprobantes</Label>
            <Input id="billing-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+58 414 0000000" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
