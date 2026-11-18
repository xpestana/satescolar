import { describe, expect, it } from "vitest";
import { PROFILE_PHOTO_FIELD, findMissingRequiredFields } from "./enrollment-completeness";

describe("findMissingRequiredFields", () => {
  const required = [PROFILE_PHOTO_FIELD, "primer_nombre", "documento"];

  it("counts the profile photo as filled when the person has a photo_url", () => {
    const formData = { primer_nombre: "Sofía", documento: "34567812" };
    expect(findMissingRequiredFields(required, formData, "https://cdn/x.png")).toEqual([]);
  });

  it("reports the profile photo when photo_url is empty, even if form_data has no such key", () => {
    const formData = { primer_nombre: "Sofía", documento: "34567812" };
    expect(findMissingRequiredFields(required, formData, null)).toEqual([PROFILE_PHOTO_FIELD]);
    expect(findMissingRequiredFields(required, formData, "  ")).toEqual([PROFILE_PHOTO_FIELD]);
  });

  it("reports blank or absent form_data values", () => {
    const formData = { primer_nombre: "  ", documento: null };
    expect(findMissingRequiredFields(required, formData, "x.png")).toEqual(["primer_nombre", "documento"]);
    expect(findMissingRequiredFields(required, null, "x.png")).toEqual(["primer_nombre", "documento"]);
  });

  it("keeps non-string values such as numbers or false as filled", () => {
    expect(findMissingRequiredFields(["edad", "acepta"], { edad: 0, acepta: false }, null)).toEqual([]);
  });
});
