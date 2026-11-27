import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

/**
 * Regresión: el layout monta useSchoolId, que guarda en ["user-school-id", uid] el id del colegio
 * (un texto). La página tenía su propia consulta con la misma clave y solo tomaba el id si SU
 * queryFn corría; al reusar la caché del layout quedaba en null y crear el año fallaba.
 */

const inserts: Array<{ table: string; payload: unknown }> = [];

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1" }, userRole: "school", loading: false, context: { roleSchoolId: "sc1", schoolId: "sc1" } }),
}));
vi.mock("@/components/layout/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/layout/PageHeader", () => ({ PageHeader: () => null }));
vi.mock("@/integrations/supabase/client", () => {
  const chain = (table: string) => {
    let single = false;
    const c: Record<string | symbol, unknown> = new Proxy({}, {
      get(_t, prop) {
        if (prop === "then") {
          const data = table === "user_roles" ? (single ? { school_id: "sc1" } : [{ school_id: "sc1" }]) : single ? null : [];
          return (res: (v: unknown) => void) => res({ data, error: null });
        }
        if (prop === "single" || prop === "maybeSingle") single = true;
        if (prop === "insert") return (payload: unknown) => { inserts.push({ table, payload }); return c; };
        return () => c;
      },
    });
    return c;
  };
  return { supabase: { from: (t: string) => chain(t) } };
});

import SchoolYearsSections from "./SchoolYearsSections";

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});

describe("SchoolYearsSections", () => {
  it("crea el año escolar aunque el id del colegio ya esté en caché (cargado por el layout)", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    // Lo que deja useSchoolId del layout antes de entrar a la página.
    client.setQueryData(["user-school-id", "u1"], "sc1");

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <SchoolYearsSections />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Agregar Año Escolar/i }));
    fireEvent.change(document.getElementById("year_range") as HTMLInputElement, { target: { value: "2026-2027" } });
    fireEvent.click(screen.getByRole("button", { name: /^Guardar$/ }));

    await waitFor(() =>
      expect(inserts).toContainEqual({
        table: "school_years",
        payload: { school_id: "sc1", year_range: "2026 - 2027" },
      }),
    );
  });
});
