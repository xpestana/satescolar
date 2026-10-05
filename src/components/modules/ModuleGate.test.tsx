import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ModuleGate } from "./ModuleGate";

const auth = { userRole: "school" as string };
const modules = {
  isLoading: false,
  active: true,
  expiresAt: null as string | null,
};

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
vi.mock("@/hooks/useSchoolData", () => ({ useSchoolData: () => ({ school: { name: "Colegio Prueba" } }) }));
vi.mock("@/hooks/useSchoolModules", () => ({
  useSchoolModules: () => ({
    isLoading: modules.isLoading,
    isActive: () => modules.active,
    getState: () => ({ enabled: true, expires_at: modules.expiresAt }),
    getStatus: () => (modules.active ? "active" : modules.expiresAt ? "expired" : "disabled"),
  }),
}));

function renderGate() {
  return render(
    <MemoryRouter initialEntries={["/pagos"]}>
      <Routes>
        <Route path="/pagos" element={<ModuleGate module="payments"><p>Contenido real</p></ModuleGate>} />
        <Route path="/teacher/dashboard" element={<p>Inicio docente</p>} />
        <Route path="/representative/dashboard" element={<p>Inicio representante</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  auth.userRole = "school";
  modules.isLoading = false;
  modules.active = true;
  modules.expiresAt = null;
});

describe("ModuleGate", () => {
  it("renders the content when the module is active", () => {
    renderGate();
    expect(screen.getByText("Contenido real")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /whatsapp/i })).not.toBeInTheDocument();
  });

  it("shows the sales overlay over an inert preview for school staff", () => {
    modules.active = false;
    renderGate();
    const preview = screen.getByText("Contenido real").parentElement!;
    expect(preview).toHaveAttribute("inert");
    expect(preview).toHaveAttribute("aria-hidden", "true");
    const cta = screen.getByRole("link", { name: /whatsapp/i });
    expect(cta.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/584120743558\?text=/);
    expect(decodeURIComponent(cta.getAttribute("href")!)).toContain("*Colegio Prueba*");
    expect(screen.getByText(/siguiente nivel con Pagos/)).toBeInTheDocument();
  });

  it("invites to renew when the module expired", () => {
    modules.active = false;
    modules.expiresAt = "2026-09-30T12:00:00Z";
    renderGate();
    expect(screen.getByText(/Tu módulo Pagos venció/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /renovar/i })).toBeInTheDocument();
  });

  it("redirects teachers and representatives to their dashboard", () => {
    modules.active = false;
    auth.userRole = "teacher";
    const { unmount } = renderGate();
    expect(screen.getByText("Inicio docente")).toBeInTheDocument();
    unmount();

    auth.userRole = "representative";
    renderGate();
    expect(screen.getByText("Inicio representante")).toBeInTheDocument();
  });

  it("waits for the modules to load before deciding", () => {
    modules.active = false;
    modules.isLoading = true;
    renderGate();
    expect(screen.queryByText("Contenido real")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /whatsapp/i })).not.toBeInTheDocument();
  });
});
