import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

registerSW({ immediate: true });

const root = document.getElementById("root")!;
createRoot(root).render(<App />);
