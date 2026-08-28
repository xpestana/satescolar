import { describe, it, expect } from "vitest";
import {
  personSurname,
  resolveFamilySurname,
  familySurname,
  buildPrimaryRepMap,
} from "./familyDisplayName";

describe("personSurname", () => {
  it("junta primer y segundo apellido", () => {
    expect(personSurname({ primer_apellido: "Pérez", segundo_apellido: "Gómez" })).toBe("Pérez Gómez");
  });

  it("soporta claves alternas", () => {
    expect(personSurname({ last_name: "Smith" })).toBe("Smith");
    expect(personSurname({ apellido: "Ruiz" })).toBe("Ruiz");
  });

  it("devuelve cadena vacía sin datos", () => {
    expect(personSurname(null)).toBe("");
    expect(personSurname({})).toBe("");
  });
});

describe("resolveFamilySurname", () => {
  const rep = { primer_apellido: "Rep", segundo_apellido: "Uno" };
  const student = { primer_apellido: "Est", segundo_apellido: "Dos" };

  it("prefiere los apellidos propios de la familia", () => {
    expect(resolveFamilySurname({ father_last_name: "Padre", mother_last_name: "Madre" }, rep, student))
      .toBe("Padre Madre");
  });

  it("cae al representante principal si la familia no tiene apellidos", () => {
    expect(resolveFamilySurname({}, rep, student)).toBe("Rep Uno");
  });

  it("cae al estudiante si no hay representante", () => {
    expect(resolveFamilySurname({}, null, student)).toBe("Est Dos");
  });

  it("devuelve cadena vacía si no hay ninguno", () => {
    expect(resolveFamilySurname({}, null, null)).toBe("");
  });
});

describe("familySurname", () => {
  it("usa 'Sin apellidos' como último recurso", () => {
    expect(familySurname({}, null, null)).toBe("Sin apellidos");
  });
});

describe("buildPrimaryRepMap", () => {
  it("prefiere el representante is_primary", () => {
    const map = buildPrimaryRepMap([
      { family_id: "f1", is_primary: false, form_data: { primer_apellido: "Otro" } },
      { family_id: "f1", is_primary: true, form_data: { primer_apellido: "Principal" } },
    ]);
    expect(map.f1.primer_apellido).toBe("Principal");
  });

  it("cae al primero si ninguno es principal", () => {
    const map = buildPrimaryRepMap([
      { family_id: "f1", is_primary: false, form_data: { primer_apellido: "Primero" } },
      { family_id: "f1", is_primary: false, form_data: { primer_apellido: "Segundo" } },
    ]);
    expect(map.f1.primer_apellido).toBe("Primero");
  });
});
