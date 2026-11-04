import { describe, expect, it } from "vitest";
import { buildBeneficiaryFormSchema, NO_ISLR_CONCEPT, toBeneficiaryPayload, type BeneficiaryFormValues } from "./beneficiaryFormSchema";

const empty: BeneficiaryFormValues = {
  category: "worker",
  regime: "payroll",
  teacherMode: "payroll_only",
  teacherId: "",
  fullName: "",
  documentType: "V",
  documentNumber: "",
  taxId: "",
  personType: "",
  fiscalAddress: "",
  email: "",
  phone: "",
  notes: "",
  ariRate: "",
  ariValidFrom: "",
  vatMode: "standard",
  vatExclusionReason: "",
  islrConceptId: "",
};

const off = { vatEnabled: false, islrEnabled: false, hasAriRate: false };
const on = { vatEnabled: true, islrEnabled: true, hasAriRate: false };

const errorsOf = (values: BeneficiaryFormValues, ctx = off) => {
  const result = buildBeneficiaryFormSchema(ctx).safeParse(values);
  return result.success ? [] : result.error.issues.map((i) => String(i.path[0]));
};

const legalSupplier: BeneficiaryFormValues = {
  ...empty,
  category: "supplier",
  regime: "invoice",
  fullName: "Servicios CA",
  personType: "legal_domiciled",
  taxId: "J123456789",
  fiscalAddress: "Caracas",
  email: "pagos@example.com",
  islrConceptId: "c1",
};

describe("beneficiary form validation", () => {
  it("only needs name and document for staff when withholdings are off", () => {
    expect(errorsOf(empty)).toEqual(["fullName", "documentNumber"]);
    expect(errorsOf({ ...empty, fullName: "Ana", documentNumber: "12345678" })).toEqual([]);
  });

  it("requires RIF and AR-I for staff when ISLR is on", () => {
    const staff = { ...empty, fullName: "Ana", documentNumber: "12345678" };
    expect(errorsOf(staff, on)).toEqual(["taxId", "ariRate"]);
    expect(errorsOf({ ...staff, taxId: "V-12345678-9", ariRate: "2", ariValidFrom: "2026-11-01" }, on)).toEqual([]);
  });

  it("accepts a saved AR-I without asking for it again", () => {
    const staff = { ...empty, fullName: "Ana", documentNumber: "12345678", taxId: "V-12345678-9" };
    expect(errorsOf(staff, { ...on, hasAriRate: true })).toEqual([]);
  });

  it("requires a start date and a valid range when an AR-I is typed", () => {
    const staff = { ...empty, fullName: "Ana", documentNumber: "12345678", taxId: "V-12345678-9" };
    expect(errorsOf({ ...staff, ariRate: "2" }, on)).toEqual(["ariValidFrom"]);
    expect(errorsOf({ ...staff, ariRate: "120", ariValidFrom: "2026-11-01" }, on)).toEqual(["ariRate"]);
  });

  it("requires a supplier's fiscal data even with withholdings off", () => {
    const blank = { ...empty, category: "supplier" as const, regime: "invoice" as const };
    expect(errorsOf(blank)).toEqual(
      expect.arrayContaining(["fullName", "taxId", "personType", "fiscalAddress", "email"])
    );
    expect(errorsOf(legalSupplier)).toEqual([]);
  });

  it("asks a legal person for no identity card but a natural one for it", () => {
    expect(errorsOf(legalSupplier)).not.toContain("documentNumber");
    expect(errorsOf({ ...legalSupplier, personType: "natural_resident" })).toContain("documentNumber");
  });

  it("requires the ISLR concept when ISLR is on, accepting 'no aplica'", () => {
    expect(errorsOf({ ...legalSupplier, islrConceptId: "" }, on)).toEqual(["islrConceptId"]);
    expect(errorsOf({ ...legalSupplier, islrConceptId: NO_ISLR_CONCEPT }, on)).toEqual([]);
  });

  it("requires a reason to exclude from IVA withholding", () => {
    expect(errorsOf({ ...legalSupplier, vatMode: "excluded" })).toEqual(["vatExclusionReason"]);
  });

  it("rejects badly formatted data", () => {
    expect(errorsOf({ ...legalSupplier, taxId: "123" })).toEqual(["taxId"]);
    expect(errorsOf({ ...legalSupplier, email: "no-es-correo" })).toEqual(["email"]);
    expect(errorsOf({ ...empty, fullName: "Ana", documentNumber: "12A" })).toEqual(["documentNumber"]);
  });

  it("asks to pick a teacher when linking, not when registering only in payroll", () => {
    const teacher = { ...empty, category: "teacher" as const, fullName: "Ana", documentNumber: "12345678" };
    expect(errorsOf({ ...teacher, teacherMode: "linked" })).toEqual(["teacherId"]);
    expect(errorsOf(teacher)).toEqual([]);
  });
});

describe("toBeneficiaryPayload", () => {
  it("normalizes a supplier and fixes its regime", () => {
    const payload = toBeneficiaryPayload({ ...legalSupplier, regime: "payroll" }, off);
    expect(payload).toMatchObject({
      payment_regime: "invoice",
      tax_id: "J-12345678-9",
      document_id: null,
      default_islr_concept_id: "c1",
    });
  });

  it("stores no concept for 'no aplica'", () => {
    expect(toBeneficiaryPayload({ ...legalSupplier, islrConceptId: NO_ISLR_CONCEPT }, on).default_islr_concept_id).toBeNull();
  });

  it("uses the same document format as the Teachers area", () => {
    const payload = toBeneficiaryPayload({ ...empty, fullName: "Ana", documentType: "E", documentNumber: "8123456" }, off);
    expect(payload.document_id).toBe("E-8123456");
    expect(payload.person_type).toBe("natural_resident");
    expect(payload.fiscal_address).toBeNull();
  });

  it("keeps a teacher unlinked when registered only in payroll", () => {
    const base = { ...empty, category: "teacher" as const, fullName: "Ana", documentNumber: "1234567", teacherId: "t1" };
    expect(toBeneficiaryPayload(base, off).teacher_id).toBeNull();
    expect(toBeneficiaryPayload({ ...base, teacherMode: "linked" }, off).teacher_id).toBe("t1");
  });

  it("clears the exclusion reason unless excluded", () => {
    expect(toBeneficiaryPayload({ ...legalSupplier, vatExclusionReason: "x" }, off).vat_exclusion_reason).toBeNull();
  });
});
