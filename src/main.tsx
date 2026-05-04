import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// ---------------------------------------------------------------------------
// PWA / Service Worker cleanup
// ---------------------------------------------------------------------------
// En entornos de PREVIEW de Lovable (o dentro de iframes) eliminamos
// agresivamente cualquier Service Worker y caché del navegador para evitar que
// la vista quede congelada en una versión vieja del bundle.
// En producción NO tocamos nada (por si en el futuro se quiere PWA real).
// ---------------------------------------------------------------------------
if (typeof window !== "undefined") {
  const host = window.location.hostname;
  const isPreviewHost =
    host.includes("lovableproject.com") ||
    host.includes("lovable.app") ||
    host === "localhost" ||
    host === "127.0.0.1";

  let isInIframe = false;
  try {
    isInIframe = window.self !== window.top;
  } catch {
    isInIframe = true;
  }

  if (isPreviewHost || isInIframe) {
    const RELOAD_FLAG = "__sw_cleanup_reloaded__";

    (async () => {
      let didUnregister = false;

      // 1) Desregistrar TODOS los service workers
      if ("serviceWorker" in navigator) {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          if (regs.length > 0) {
            await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
            didUnregister = true;
          }
        } catch {
          /* ignore */
        }
      }

      // 2) Borrar TODAS las cachés del navegador (Cache Storage)
      if ("caches" in window) {
        try {
          const keys = await caches.keys();
          if (keys.length > 0) {
            await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
            didUnregister = true;
          }
        } catch {
          /* ignore */
        }
      }

      // 3) Una sola recarga dura para soltar el bundle cacheado
      if (didUnregister && !sessionStorage.getItem(RELOAD_FLAG)) {
        sessionStorage.setItem(RELOAD_FLAG, "1");
        const url = new URL(window.location.href);
        url.searchParams.set("sw-cleanup", Date.now().toString());
        window.location.replace(url.toString());
      }
    })();
  }
}

const root = document.getElementById("root")!;
createRoot(root).render(<App />);
