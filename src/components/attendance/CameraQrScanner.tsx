import { useEffect, useRef, useState, useCallback } from "react";
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
  const scanCooldownRef = useRef(false);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const startScanning = useCallback(async () => {
    setError(null);
    try {
      const scanner = new Html5Qrcode("camera-qr-reader");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 15,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            // Use 80% of the viewfinder for better detection
            const size = Math.min(viewfinderWidth, viewfinderHeight) * 0.8;
            return { width: Math.floor(size), height: Math.floor(size) };
          },
          aspectRatio: 1,
          disableFlip: false,
        },
        (decodedText) => {
          if (scanCooldownRef.current) return;
          scanCooldownRef.current = true;

          // Vibrate on mobile for feedback
          if (navigator.vibrate) {
            navigator.vibrate(200);
          }

          onScanRef.current(decodedText);

          // Cooldown: allow next scan after 6 seconds
          setTimeout(() => {
            scanCooldownRef.current = false;
          }, 6000);
        },
        () => { /* ignore scan failures */ }
      );

      setIsScanning(true);
    } catch (err: any) {
      console.error("Camera error:", err);
      const errStr = err?.toString?.() || "";
      if (errStr.includes("NotAllowedError")) {
        setError("Permiso de cámara denegado. Habilítelo en la configuración del navegador.");
      } else if (errStr.includes("NotFoundError")) {
        setError("No se encontró una cámara en este dispositivo.");
      } else {
        setError("No se pudo iniciar la cámara. Intente de nuevo.");
      }
    }
  }, []);

  const stopScanning = useCallback(async () => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
      }
      scannerRef.current?.clear();
    } catch { /* ignore */ }
    scannerRef.current = null;
    setIsScanning(false);
  }, []);

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, [stopScanning]);

  return (
    <div className="space-y-3">
      <div
        id="camera-qr-reader"
        className={`w-full rounded-lg overflow-hidden bg-muted ${isScanning ? "min-h-[350px]" : "min-h-0"}`}
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
