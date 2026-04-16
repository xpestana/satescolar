import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Lock, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface AccessCodeGateProps {
  studentId: string;
  schoolId: string;
  onVerified: () => void;
}

export function AccessCodeGate({ studentId, schoolId, onVerified }: AccessCodeGateProps) {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  const MAX_ATTEMPTS = 5;

  const handleVerify = async () => {
    if (!code.trim()) return;
    if (attempts >= MAX_ATTEMPTS) {
      setError("Demasiados intentos fallidos. Por favor intente más tarde.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Look up the access code for this student + active school year
      const { data: activeYear } = await supabase
        .from("school_years")
        .select("id")
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .single();

      if (!activeYear) {
        setError("No se encontró un año escolar activo.");
        setLoading(false);
        return;
      }

      const { data: accessCode } = await supabase
        .from("classroom_access_codes")
        .select("id, access_code, is_active, locked_until, failed_attempts")
        .eq("student_id", studentId)
        .eq("school_year_id", activeYear.id)
        .eq("school_id", schoolId)
        .maybeSingle();

      if (!accessCode) {
        setError("No se encontró un código de acceso para este estudiante. Contacte a la institución.");
        setLoading(false);
        return;
      }

      if (!accessCode.is_active) {
        setError("El código de acceso ha sido desactivado. Contacte a la institución.");
        setLoading(false);
        return;
      }

      // Check lock
      if (accessCode.locked_until && new Date(accessCode.locked_until) > new Date()) {
        const mins = Math.ceil((new Date(accessCode.locked_until).getTime() - Date.now()) / 60000);
        setError(`Acceso bloqueado temporalmente. Intente en ${mins} minuto(s).`);
        setLoading(false);
        return;
      }

      // Verify code
      if (accessCode.access_code !== code.trim()) {
        const newAttempts = (accessCode.failed_attempts || 0) + 1;
        const lockUntil = newAttempts >= MAX_ATTEMPTS ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;

        await supabase
          .from("classroom_access_codes")
          .update({
            failed_attempts: newAttempts,
            locked_until: lockUntil,
          })
          .eq("id", accessCode.id);

        setAttempts((prev) => prev + 1);
        const remaining = MAX_ATTEMPTS - newAttempts;
        setError(
          remaining > 0
            ? `Código incorrecto. ${remaining} intento(s) restantes.`
            : "Demasiados intentos fallidos. Acceso bloqueado por 15 minutos."
        );
        setLoading(false);
        return;
      }

      // Success — reset failed attempts
      await supabase
        .from("classroom_access_codes")
        .update({ failed_attempts: 0, locked_until: null })
        .eq("id", accessCode.id);

      // Log access
      if (user?.id) {
        await supabase.from("classroom_access_log").insert({
          user_id: user.id,
          student_id: studentId,
          school_id: schoolId,
          access_type: "code_verified",
        });
      }

      toast.success("Acceso verificado correctamente");
      onVerified();
    } catch (err) {
      console.error("Access code verification error:", err);
      setError("Error al verificar el código. Intente de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>Verificación de Acceso</CardTitle>
          <CardDescription>
            Ingrese el código de acceso proporcionado por la institución para ver el aula virtual de su representado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Código de acceso</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Ingrese el código"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                className="pl-10 font-mono tracking-wider"
                disabled={loading || attempts >= MAX_ATTEMPTS}
                maxLength={36}
              />
            </div>
          </div>

          <Button
            className="w-full"
            onClick={handleVerify}
            disabled={loading || !code.trim() || attempts >= MAX_ATTEMPTS}
          >
            {loading ? "Verificando..." : "Verificar Acceso"}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            El código de acceso es único por estudiante y año escolar. Si no lo tiene, solicítelo a la administración del colegio.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
