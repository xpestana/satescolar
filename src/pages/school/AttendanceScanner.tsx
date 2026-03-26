import { useState, useRef, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CheckCircle, XCircle, Clock, QrCode, Loader2, Camera, Keyboard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CameraQrScanner } from "@/components/attendance/CameraQrScanner";
import { useIsMobile } from "@/hooks/use-mobile";

type ScanStatus = "idle" | "loading" | "success" | "duplicate" | "error";

interface ScanResult {
  personName: string;
  documentId?: string;
  role: string;
  date: string;
  time: string;
  status: ScanStatus;
  message?: string;
}

export default function AttendanceScanner() {
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<string>(isMobile ? "camera" : "reader");

  useEffect(() => {
    if (activeTab === "reader") {
      inputRef.current?.focus();
    }
  }, [activeTab]);

  // Re-focus after showing result
  useEffect(() => {
    if (status !== "idle" && status !== "loading") {
      timeoutRef.current = setTimeout(() => {
        setStatus("idle");
        setResult(null);
        setInputValue("");
        inputRef.current?.focus();
      }, 5000);
    }
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [status]);

  const extractToken = (input: string): string | null => {
    // Extract token from URL like /attendance/scan/{token}
    const urlMatch = input.match(/\/attendance\/scan\/([a-f0-9-]{36})/i);
    if (urlMatch) return urlMatch[1];
    // Or if it's just a UUID token
    const uuidMatch = input.match(/^[a-f0-9-]{36}$/i);
    if (uuidMatch) return uuidMatch[0];
    // Try to extract UUID from any string
    const anyUuid = input.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
    if (anyUuid) return anyUuid[1];
    return null;
  };

  const handleScan = useCallback(async (value: string) => {
    const token = extractToken(value.trim());
    if (!token) {
      setStatus("error");
      setResult({ personName: "", role: "", date: "", time: "", status: "error", message: "QR inválido" });
      return;
    }

    setStatus("loading");

    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/record-attendance`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        }
      );
      const json = await res.json();

      if (json.status === "success") {
        setStatus("success");
        setResult({ ...json, status: "success" });
      } else if (json.status === "duplicate") {
        setStatus("duplicate");
        setResult({ ...json, status: "duplicate" });
      } else {
        setStatus("error");
        setResult({ personName: "", role: "", date: "", time: "", status: "error", message: json.error || "Error" });
      }
    } catch {
      setStatus("error");
      setResult({ personName: "", role: "", date: "", time: "", status: "error", message: "Error de conexión" });
    }
  }, []);

  const handleCameraScan = useCallback((decodedText: string) => {
    handleScan(decodedText);
  }, [handleScan]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim()) {
      handleScan(inputValue);
    }
  };

  const roleBadgeColor = (role: string) => {
    switch (role) {
      case "Docente": return "bg-blue-500";
      case "Estudiante": return "bg-green-500";
      case "Representante": return "bg-purple-500";
      default: return "bg-muted";
    }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Escáner QR"
        breadcrumbs={[{ label: "Utilidades" }, { label: "Escáner QR" }]}
      />

      <div className="max-w-lg mx-auto space-y-4">
        {/* Result Card - Always on top */}
        {status === "loading" && (
          <Card className="border-primary/30">
            <CardContent className="p-6 flex flex-col items-center gap-3">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <p className="text-muted-foreground">Procesando...</p>
            </CardContent>
          </Card>
        )}

        {status === "success" && result && (
          <Card className="border-green-300 bg-green-50">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-10 w-10 text-green-500 flex-shrink-0" />
                <div>
                  <h3 className="text-base font-bold text-green-700">Asistencia Registrada</h3>
                  <p className="text-sm text-green-600">Registro exitoso</p>
                </div>
              </div>
              <div className="bg-white rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Nombre</span>
                  <strong>{result.personName}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Rol</span>
                  <Badge className={`${roleBadgeColor(result.role)} text-white`}>{result.role}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Hora</span>
                  <span>{result.time}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {status === "duplicate" && result && (
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-3">
                <Clock className="h-10 w-10 text-amber-500 flex-shrink-0" />
                <div>
                  <h3 className="text-base font-bold text-amber-700">Ya Registrado</h3>
                  <p className="text-sm text-amber-600">Asistencia ya registrada</p>
                </div>
              </div>
              <div className="bg-white rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Nombre</span>
                  <strong>{result.personName}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Rol</span>
                  <Badge className={`${roleBadgeColor(result.role)} text-white`}>{result.role}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {status === "error" && result && (
          <Card className="border-red-300 bg-red-50">
            <CardContent className="p-5 flex items-center gap-3">
              <XCircle className="h-10 w-10 text-red-500 flex-shrink-0" />
              <div>
                <h3 className="text-base font-bold text-red-700">Error</h3>
                <p className="text-sm text-red-600">{result.message || "QR inválido o usuario no encontrado"}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Scanner Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <QrCode className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Control de Acceso</h3>
                <p className="text-sm text-muted-foreground">Escanee un carnet QR para registrar asistencia</p>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full mb-4">
                <TabsTrigger value="camera" className="flex-1 gap-2">
                  <Camera className="h-4 w-4" />
                  Cámara
                </TabsTrigger>
                <TabsTrigger value="reader" className="flex-1 gap-2">
                  <Keyboard className="h-4 w-4" />
                  Lector Físico
                </TabsTrigger>
              </TabsList>

              <TabsContent value="camera">
                <CameraQrScanner
                  onScan={handleCameraScan}
                  disabled={status === "loading"}
                />
              </TabsContent>

              <TabsContent value="reader">
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Esperando lectura de QR..."
                  className="text-center text-lg h-14"
                  disabled={status === "loading"}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Conecte un lector QR USB y escanee el carnet
                </p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
