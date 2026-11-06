// Validation of the beneficiary form. Mandatory fields come from `getBeneficiaryFieldRules`, so
// the form, this schema and the "datos incompletos" badge can't disagree.

import { z } from "zod";
import type { PayrollCategory } from "../types";
import { getBeneficiaryFieldRules, isLegalPerson } from "./beneficiaryRules";
import { buildDocumentId, isValidDocumentNumber, normalizeTaxId } from "./taxId";
import type { PaymentRegime, PersonType, VatWithholdingMode } from "./types";

/** Value of the ISLR concept selector for suppliers that only sell goods. */
export const NO_ISLR_CONCEPT = "none";

export const beneficiaryFormBaseSchema = z.object({
  category: z.enum(["teacher", "admin", "worker", "supplier", "other"]),
  regime: z.enum(["payroll", "invoice"]),
  teacherMode: z.enum(["linked", "payroll_only"]),
  teacherId: z.string(),
  fullName: z.string(),
  documentType: z.string(),
  documentNumber: z.string(),
  taxId: z.string(),
  personType: z.string(),
  fiscalAddress: z.string(),
  email: z.string(),
  phone: z.string(),
  notes: z.string(),
  jobTitle: z.string().default(""),
  hireDate: z.string().default(""),
  ariRate: z.string(),
  ariValidFrom: z.string(),
  vatMode: z.enum(["standard", "full", "excluded"]),
  vatExclusionReason: z.string(),
  islrConceptId: z.string(),
});

export type BeneficiaryFormValues = z.infer<typeof beneficiaryFormBaseSchema>;

export interface BeneficiaryFormContext {
  vatEnabled: boolean;
  islrEnabled: boolean;
  /** A saved AR-I is enough; a new one is only asked for when it's being changed. */
  hasAriRate: boolean;
}

export function buildBeneficiaryFormSchema(ctx: BeneficiaryFormContext) {
  return beneficiaryFormBaseSchema.superRefine((values, issue) => {
    const fail = (path: keyof BeneficiaryFormValues, message: string) =>
      issue.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

    const rules = getBeneficiaryFieldRules({
      category: values.category,
      regime: values.regime,
      personType: values.personType as PersonType | "",
      vatEnabled: ctx.vatEnabled,
      islrEnabled: ctx.islrEnabled,
    });

    if (!values.fullName.trim()) {
      fail("fullName", isLegalPerson(values.personType) ? "La razón social es obligatoria" : "El nombre es obligatorio");
    }
    if (values.category === "teacher" && values.teacherMode === "linked" && !values.teacherId) {
      fail("teacherId", "Seleccione un docente o elija registrarlo solo en Nómina");
    }

    if (rules.document !== "hidden") {
      const number = values.documentNumber.trim();
      if (!number && rules.document === "required") fail("documentNumber", "El documento es obligatorio");
      else if (number && !isValidDocumentNumber(values.documentType, number)) fail("documentNumber", "Documento no válido");
    }

    const taxId = values.taxId.trim();
    if (rules.taxId === "required" && !taxId) fail("taxId", "El RIF es obligatorio");
    else if (taxId && !normalizeTaxId(taxId)) fail("taxId", "RIF no válido. Ejemplo: J-12345678-9");

    if (rules.personType === "required" && !values.personType) fail("personType", "Seleccione el tipo de persona");
    if (rules.fiscalAddress === "required" && !values.fiscalAddress.trim()) {
      fail("fiscalAddress", "El domicilio fiscal es obligatorio");
    }

    const email = values.email.trim();
    if (rules.email === "required" && !email) fail("email", "El correo es obligatorio");
    else if (email && !z.string().email().safeParse(email).success) fail("email", "Correo no válido");

    const ari = values.ariRate.trim();
    if (rules.ariRate === "required" && !ari && !ctx.hasAriRate) fail("ariRate", "El % de AR-I es obligatorio");
    if (ari) {
      const rate = Number(ari);
      if (!Number.isFinite(rate) || rate < 0 || rate > 100) fail("ariRate", "Debe estar entre 0 y 100");
      if (!values.ariValidFrom) fail("ariValidFrom", "Indique desde qué fecha aplica");
    }

    if (rules.vatMode !== "hidden" && values.vatMode === "excluded" && !values.vatExclusionReason.trim()) {
      fail("vatExclusionReason", "Indique por qué está excluido");
    }
    if (rules.islrConcept === "required" && !values.islrConceptId) {
      fail("islrConceptId", "Seleccione el concepto de ISLR o indique que no aplica");
    }
  });
}

export interface BeneficiaryPayload {
  category: PayrollCategory;
  payment_regime: PaymentRegime;
  teacher_id: string | null;
  full_name: string;
  document_id: string | null;
  tax_id: string | null;
  person_type: PersonType | null;
  fiscal_address: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  /** Staff paid by payroll: shown on the payroll sheet. */
  job_title: string | null;
  hire_date: string | null;
  vat_withholding_mode: VatWithholdingMode;
  vat_exclusion_reason: string | null;
  default_islr_concept_id: string | null;
}

/** What gets saved. Fields hidden for this type are cleared so stale data doesn't linger. */
export function toBeneficiaryPayload(values: BeneficiaryFormValues, ctx: BeneficiaryFormContext): BeneficiaryPayload {
  const regime: PaymentRegime = values.category === "supplier" ? "invoice" : values.regime;
  const rules = getBeneficiaryFieldRules({
    category: values.category,
    regime,
    personType: values.personType as PersonType | "",
    vatEnabled: ctx.vatEnabled,
    islrEnabled: ctx.islrEnabled,
  });
  const text = (value: string) => value.trim() || null;
  const isInvoice = regime === "invoice";
  const vatMode: VatWithholdingMode = isInvoice ? values.vatMode : "standard";

  return {
    category: values.category,
    payment_regime: regime,
    teacher_id: values.category === "teacher" && values.teacherMode === "linked" ? values.teacherId || null : null,
    full_name: values.fullName.trim(),
    document_id: rules.document === "hidden" ? null : buildDocumentId(values.documentType, values.documentNumber),
    tax_id: normalizeTaxId(values.taxId),
    person_type: isInvoice ? ((values.personType as PersonType) || null) : "natural_resident",
    fiscal_address: isInvoice ? text(values.fiscalAddress) : null,
    email: text(values.email),
    phone: text(values.phone),
    notes: text(values.notes),
    job_title: isInvoice ? null : text(values.jobTitle ?? ""),
    hire_date: isInvoice ? null : values.hireDate || null,
    vat_withholding_mode: vatMode,
    vat_exclusion_reason: vatMode === "excluded" ? text(values.vatExclusionReason) : null,
    default_islr_concept_id:
      isInvoice && values.islrConceptId && values.islrConceptId !== NO_ISLR_CONCEPT ? values.islrConceptId : null,
  };
}
