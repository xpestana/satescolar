import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "sat-install-prompt-dismissed-at";
const DISMISS_DAYS = 7;

export const InstallAppPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      // Respeta el "no mostrar por 7 días"
      const dismissedAt = localStorage.getItem(DISMISS_KEY);
      if (dismissedAt) {
        const days = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
        if (days < DISMISS_DAYS) return;
      }
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setOpen(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => {
      setDeferredPrompt(null);
      setOpen(false);
      localStorage.removeItem(DISMISS_KEY);
    });

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setOpen(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setOpen(false);
  };

  if (!deferredPrompt) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleDismiss()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Download className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Instalar SAT Escolar</DialogTitle>
          <DialogDescription className="text-center">
            Instala la aplicación en tu dispositivo para acceder más rápido,
            con un ícono propio y sin la barra del navegador.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center gap-2">
          <Button variant="outline" onClick={handleDismiss}>
            <X className="mr-2 h-4 w-4" />
            Ahora no
          </Button>
          <Button onClick={handleInstall}>
            <Download className="mr-2 h-4 w-4" />
            Instalar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
