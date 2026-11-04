import { describe, expect, it } from "vitest";
import { buildDocumentId, isValidDocumentNumber, normalizeTaxId, parseDocumentId } from "./taxId";

describe("normalizeTaxId", () => {
  it("accepts the common ways of typing a RIF", () => {
    expect(normalizeTaxId("J-12345678-9")).toBe("J-12345678-9");
    expect(normalizeTaxId("j123456789")).toBe("J-12345678-9");
    expect(normalizeTaxId(" V-12345678 9 ")).toBe("V-12345678-9");
  });

  it("rejects invalid values", () => {
    expect(normalizeTaxId("X-12345678-9")).toBeNull();
    expect(normalizeTaxId("J-1234-9")).toBeNull();
    expect(normalizeTaxId("")).toBeNull();
    expect(normalizeTaxId(null)).toBeNull();
  });
});

describe("document helpers", () => {
  it("builds the same format as the Teachers area", () => {
    expect(buildDocumentId("V", " 12345678 ")).toBe("V-12345678");
    expect(buildDocumentId("V", "  ")).toBeNull();
  });

  it("parses stored documents, including legacy ones without a prefix", () => {
    expect(parseDocumentId("E-8123456")).toEqual({ type: "E", number: "8123456" });
    expect(parseDocumentId("12345678")).toEqual({ type: "V", number: "12345678" });
    expect(parseDocumentId(null)).toEqual({ type: "V", number: "" });
  });

  it("validates by type", () => {
    expect(isValidDocumentNumber("V", "12345678")).toBe(true);
    expect(isValidDocumentNumber("V", "12A45")).toBe(false);
    expect(isValidDocumentNumber("P", "AB12345")).toBe(true);
    expect(isValidDocumentNumber("P", "AB")).toBe(false);
  });
});
