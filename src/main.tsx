import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Desregistrar cualquier service worker viejo (PWA) y limpiar cachés
// para evitar que se sirva una versión desactualizada de la app.
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister().catch(() => {});
    });
  }).catch(() => {});

  if ("caches" in window) {
    caches.keys().then((keys) => {
      keys.forEach((key) => {
        caches.delete(key).catch(() => {});
      });
    }).catch(() => {});
  }
}

const root = document.getElementById("root")!;
createRoot(root).render(<App />);
