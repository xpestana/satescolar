import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Limpieza agresiva de Service Workers / caches antiguos (PWA legacy).
// Evita que la vista previa quede congelada en una versión vieja.
if (typeof window !== "undefined") {
  const RELOAD_FLAG = "__sw_cleanup_reloaded__";

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then(async (registrations) => {
        if (registrations.length === 0) return;
        await Promise.all(
          registrations.map((r) => r.unregister().catch(() => false))
        );
        if ("caches" in window) {
          const keys = await caches.keys().catch(() => [] as string[]);
          await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
        }
        // Forzamos UNA recarga dura para soltar el bundle cacheado por el SW.
        if (!sessionStorage.getItem(RELOAD_FLAG)) {
          sessionStorage.setItem(RELOAD_FLAG, "1");
          const url = new URL(window.location.href);
          url.searchParams.set("sw-cleanup", Date.now().toString());
          window.location.replace(url.toString());
        }
      })
      .catch(() => {});
  } else if ("caches" in window) {
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k).catch(() => false))))
      .catch(() => {});
  }
}

const root = document.getElementById("root")!;
createRoot(root).render(<App />);
