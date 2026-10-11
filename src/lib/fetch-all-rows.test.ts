import { describe, expect, it, vi } from "vitest";
import { fetchAllRows } from "./fetch-all-rows";

function pagedSource(total: number) {
  const all = Array.from({ length: total }, (_, i) => i);
  return vi.fn(async (from: number, to: number) => ({ data: all.slice(from, to + 1), error: null }));
}

describe("fetchAllRows", () => {
  it("junta todas las páginas", async () => {
    const fetchPage = pagedSource(25);
    expect(await fetchAllRows(fetchPage, 10)).toHaveLength(25);
    expect(fetchPage.mock.calls).toEqual([[0, 9], [10, 19], [20, 29]]);
  });

  it("pide una página más cuando la última viene completa", async () => {
    const fetchPage = pagedSource(20);
    expect(await fetchAllRows(fetchPage, 10)).toHaveLength(20);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it("sin filas devuelve una lista vacía", async () => {
    expect(await fetchAllRows(async () => ({ data: null, error: null }), 10)).toEqual([]);
  });

  it("propaga el error de una página", async () => {
    await expect(fetchAllRows(async () => ({ data: null, error: { message: "sin permiso" } })))
      .rejects.toThrow("sin permiso");
  });
});
