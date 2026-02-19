import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Eye, EyeOff, Copy, Save } from "lucide-react";

interface ChangePasswordModalProps {
  open: boolean;
  onClose: () => void;
  familyId: string;
  familyName: string;
}

function generateSimplePassword(): string {
  const words = ["sol", "luna", "casa", "flor", "mar", "rio", "luz", "paz", "ave", "oro", "dia", "oso"];
  const word = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(Math.random() * 900) + 100;
  return `${word}${num}`;
}

export function ChangePasswordModal({ open, onClose, familyId, familyName }: ChangePasswordModalProps) {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleGenerate = () => {
    setPassword(generateSimplePassword());
    setShowPassword(true);
  };

  const handleCopy = async () => {
    if (!password) return;
    await navigator.clipboard.writeText(password);
    toast({ title: "Copiada", description: "Contraseña copiada al portapapeles." });
  };

  const handleSave = async () => {
    if (!password.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Ingresa una contraseña." });
      return;
    }
    if (password.trim().length < 4) {
      toast({ variant: "destructive", title: "Error", description: "Mínimo 4 caracteres." });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-family-password", {
        body: { family_id: familyId, new_password: password.trim() },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Contraseña actualizada", description: `La contraseña de la familia ${familyName} ha sido cambiada.` });
      setPassword("");
      onClose();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message || "No se pudo cambiar la contraseña." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setPassword(""); onClose(); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cambiar Contraseña</DialogTitle>
          <DialogDescription>
            Familia: <strong>{familyName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nueva contraseña</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Escribe o genera una contraseña"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </Button>
              </div>
              <Button type="button" variant="outline" size="icon" onClick={handleCopy} title="Copiar">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Button type="button" variant="secondary" onClick={handleGenerate} className="w-full gap-2">
            <RefreshCw className="h-4 w-4" />
            Generar contraseña sencilla
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { setPassword(""); onClose(); }}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !password.trim()} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
