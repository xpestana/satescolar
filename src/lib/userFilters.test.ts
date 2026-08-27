import { describe, expect, it } from "vitest";
import {
  EMPTY_USER_FILTERS,
  countActiveFilters,
  countByRole,
  filterUsers,
  getActivityBucket,
  matchesSearch,
  normalizeText,
  type FilterableUser,
  type UserFilters,
} from "./userFilters";

const NOW = new Date("2026-08-27T12:00:00Z").getTime();
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(NOW - n * DAY).toISOString();

const user = (over: Partial<FilterableUser> = {}): FilterableUser => ({
  full_name: "María Pérez",
  email: "maria@colegio.com",
  school_id: "school-1",
  school_name: "Colegio Martin Luther King",
  role: "school",
  is_suspended: false,
  login_count: 5,
  last_login_at: daysAgo(2),
  ...over,
});

const withFilters = (over: Partial<UserFilters>): UserFilters => ({ ...EMPTY_USER_FILTERS, ...over });

describe("normalizeText", () => {
  it("quita acentos y pasa a minúsculas", () => {
    expect(normalizeText("María PÉREZ")).toBe("maria perez");
    expect(normalizeText("José Ángel")).toBe("jose angel");
  });

  it("no rompe con cadena vacía", () => {
    expect(normalizeText("")).toBe("");
  });
});

describe("matchesSearch", () => {
  it("encuentra sin acentos en ambos sentidos", () => {
    expect(matchesSearch(user(), "maria")).toBe(true);
    expect(matchesSearch(user({ full_name: "Maria Perez" }), "María")).toBe(true);
  });

  it("exige todos los términos, en cualquier orden", () => {
    expect(matchesSearch(user(), "maria luther")).toBe(true);
    expect(matchesSearch(user(), "luther maria")).toBe(true);
    expect(matchesSearch(user(), "maria inexistente")).toBe(false);
  });

  it("busca también por email, colegio y rol", () => {
    expect(matchesSearch(user(), "colegio.com")).toBe(true);
    expect(matchesSearch(user(), "martin")).toBe(true);
    expect(matchesSearch(user({ role: "teacher" }), "docente")).toBe(true);
  });

  it("búsqueda vacía o solo espacios no filtra nada", () => {
    expect(matchesSearch(user(), "")).toBe(true);
    expect(matchesSearch(user(), "   ")).toBe(true);
  });

  it("tolera colegio nulo", () => {
    expect(matchesSearch(user({ school_name: null }), "maria")).toBe(true);
  });
});

describe("getActivityBucket", () => {
  it("nunca ingresó cuando no hay fecha o el contador está en cero", () => {
    expect(getActivityBucket(user({ last_login_at: null, login_count: 0 }), NOW)).toBe("never");
    expect(getActivityBucket(user({ last_login_at: daysAgo(1), login_count: 0 }), NOW)).toBe("never");
  });

  it("reciente hasta 30 días, incluido el borde", () => {
    expect(getActivityBucket(user({ last_login_at: daysAgo(0) }), NOW)).toBe("recent");
    expect(getActivityBucket(user({ last_login_at: daysAgo(30) }), NOW)).toBe("recent");
    expect(getActivityBucket(user({ last_login_at: daysAgo(31) }), NOW)).toBe("moderate");
  });

  it("inactivo pasados los 90 días, no en el borde", () => {
    expect(getActivityBucket(user({ last_login_at: daysAgo(90) }), NOW)).toBe("moderate");
    expect(getActivityBucket(user({ last_login_at: daysAgo(91) }), NOW)).toBe("dormant");
  });

  it("fecha inválida cuenta como que nunca ingresó", () => {
    expect(getActivityBucket(user({ last_login_at: "no-es-fecha" }), NOW)).toBe("never");
  });
});

describe("filterUsers", () => {
  const users = [
    user({ full_name: "Ana Colegio", role: "school", school_id: "s1", school_name: "Colegio Uno" }),
    user({ full_name: "Beto Docente", role: "teacher", school_id: "s1", school_name: "Colegio Uno" }),
    user({ full_name: "Carla Representante", role: "representative", school_id: "s2", school_name: "Colegio Dos" }),
    user({ full_name: "Dario Suspendido", role: "teacher", is_suspended: true, school_id: "s2", school_name: "Colegio Dos" }),
    user({ full_name: "Elena Sin Colegio", role: "representative", school_id: null, school_name: null }),
    user({ full_name: "Fabio Nunca", role: "school", login_count: 0, last_login_at: null }),
    user({ full_name: "Gabi Vieja", role: "school", last_login_at: daysAgo(200) }),
  ];

  it("sin filtros devuelve todo", () => {
    expect(filterUsers(users, EMPTY_USER_FILTERS, NOW)).toHaveLength(users.length);
  });

  it("filtra por rol", () => {
    const teachers = filterUsers(users, withFilters({ role: "teacher" }), NOW);
    expect(teachers.map((u) => u.full_name)).toEqual(["Beto Docente", "Dario Suspendido"]);
  });

  it("filtra por colegio y por 'sin institución'", () => {
    expect(filterUsers(users, withFilters({ school: "s1" }), NOW)).toHaveLength(2);
    const none = filterUsers(users, withFilters({ school: "none" }), NOW);
    expect(none.map((u) => u.full_name)).toEqual(["Elena Sin Colegio"]);
  });

  it("filtra por estado", () => {
    expect(filterUsers(users, withFilters({ status: "suspended" }), NOW).map((u) => u.full_name))
      .toEqual(["Dario Suspendido"]);
    expect(filterUsers(users, withFilters({ status: "active" }), NOW)).toHaveLength(users.length - 1);
  });

  it("filtra por actividad", () => {
    expect(filterUsers(users, withFilters({ activity: "never" }), NOW).map((u) => u.full_name))
      .toEqual(["Fabio Nunca"]);
    expect(filterUsers(users, withFilters({ activity: "dormant" }), NOW).map((u) => u.full_name))
      .toEqual(["Gabi Vieja"]);
  });

  it("combina filtros con la búsqueda", () => {
    const result = filterUsers(users, withFilters({ role: "teacher", search: "beto" }), NOW);
    expect(result.map((u) => u.full_name)).toEqual(["Beto Docente"]);
  });

  it("una combinación sin coincidencias devuelve lista vacía", () => {
    expect(filterUsers(users, withFilters({ role: "school", school: "s2" }), NOW)).toEqual([]);
  });

  it("lista vacía no rompe", () => {
    expect(filterUsers([], withFilters({ role: "school" }), NOW)).toEqual([]);
  });
});

describe("countActiveFilters", () => {
  it("cuenta cero sin filtros", () => {
    expect(countActiveFilters(EMPTY_USER_FILTERS)).toBe(0);
  });

  it("ignora una búsqueda de solo espacios", () => {
    expect(countActiveFilters(withFilters({ search: "   " }))).toBe(0);
  });

  it("suma cada filtro activo", () => {
    expect(countActiveFilters(withFilters({ search: "ana", role: "teacher", status: "suspended" }))).toBe(3);
  });
});

describe("countByRole", () => {
  it("cuenta por rol y el total", () => {
    const counts = countByRole([
      user({ role: "school" }),
      user({ role: "teacher" }),
      user({ role: "teacher" }),
    ]);
    expect(counts).toEqual({ all: 3, school: 1, teacher: 2, representative: 0 });
  });

  it("lista vacía devuelve todo en cero", () => {
    expect(countByRole([])).toEqual({ all: 0, school: 0, teacher: 0, representative: 0 });
  });
});
