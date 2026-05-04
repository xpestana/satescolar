import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Desregistrar cualquier Service Worker antiguo (legado de la PWA anterior).
// Los archivos públicos /sw.js y /service-worker.js son kill-switches que se
// auto-desregistran. Aquí no registramos ningún SW nuevo.
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => regs.forEach((r) => r.unregister().catch(() => {})))
    .catch(() => {});
}

const root = document.getElementById("root")!;
createRoot(root).render(<App />);
