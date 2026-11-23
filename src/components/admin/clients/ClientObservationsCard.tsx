import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface ClientObservationsCardProps {
  value: string | null;
  isSaving: boolean;
  onSave: (observations: string | null) => void;
}

/** Free notes about the school: how it pays, who to talk to, agreements, particularities. */
export function ClientObservationsCard({ value, isSaving, onSave }: ClientObservationsCardProps) {
  const [text, setText] = useState("");
  useEffect(() => setText(value ?? ""), [value]);
  const dirty = text !== (value ?? "");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Observaciones</CardTitle>
        <CardDescription>Particularidades del colegio: acuerdos, forma de pago, a quién cobrarle, etc.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          rows={7}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"Ej.: Paga por pago móvil los primeros días del mes.\nEl cobro se le hace al administrador, no a la directora.\nTiene oferta Colegio Fundador."}
        />
        <div className="flex justify-end">
          <Button onClick={() => onSave(text.trim() || null)} disabled={!dirty || isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Guardar observaciones
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
