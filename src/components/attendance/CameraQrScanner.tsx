import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, CameraOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CameraQrScannerProps {
  onScan: (decodedText: string) => void;
  disabled?: boolean;
}

export function CameraQrScanner({ onScan, disabled }: CameraQrScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastScanRef = useRef<string>("");
  const scanCooldownRef = useRef(false);

  const startScanning = async () => {
    setError(null);
    try {
      const scanner = new Html5Qrcode("camera-qr-reader");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        (decodedText) => {
          if (scanCooldownRef.current) return;
          if (decodedText === lastScanRef.current) return;
          lastScanRef.current = decodedText;
          scanCooldownRef.current = true;
          onScan(decodedText);
          // Cooldown to prevent rapid duplicate scans
          setTimeout(() => {
            scanCooldownRef.current = false;
            lastScanRef.current = "";
          }, 5000);
        },
        () => { /* ignore scan failures */ }
      );

      setIsScanning(true);
    } catch (err: any) {
      console.error("Camera error:", err);
      if (err?.toString?.().includes("NotAllowedError")) {
        setError("Permiso de cámara denegado. Habilítelo en la configuración del navegador.");
      } else if (err?.toString?.().includes("NotFoundError")) {
        setError("No se encontró una cámara en este dispositivo.");
      } else {
        setError("No se pudo iniciar la cámara. Intente de nuevo.");
      }
    }
  };

  const stopScanning = async () => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
      }
      scannerRef.current?.clear();
    } catch { /* ignore */ }
    scannerRef.current = null;
    setIsScanning(false);
  };

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  return (
    <div className="space-y-3">
      <div
        id="camera-qr-reader"
        ref={containerRef}
        className={`w-full rounded-lg overflow-hidden bg-muted ${isScanning ? "min-h-[300px]" : "min-h-0"}`}
      />

      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}

      <Button
        type="button"
        variant={isScanning ? "destructive" : "default"}
        className="w-full"
        onClick={isScanning ? stopScanning : startScanning}
        disabled={disabled}
      >
        {isScanning ? (
          <>
            <CameraOff className="h-4 w-4 mr-2" />
            Detener Cámara
          </>
        ) : (
          <>
            <Camera className="h-4 w-4 mr-2" />
            Escanear con Cámara
          </>
        )}
      </Button>
    </div>
  );
}