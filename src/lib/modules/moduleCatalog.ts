/**
 * Catalog of the modules a school can have enabled (see docs/desc/19-modulos.md).
 * "registration" is free and always active; the rest are sold per school and
 * stored in the `school_modules` table.
 */
export const SELLABLE_MODULE_KEYS = [
  "messaging",
  "payments",
  "grades",
  "ministry_forms",
  "attendance",
  "virtual_classroom",
] as const;

export type SellableModuleKey = (typeof SELLABLE_MODULE_KEYS)[number];
export type ModuleKey = "registration" | SellableModuleKey;

export interface ModuleInfo {
  key: SellableModuleKey;
  name: string;
  tagline: string;
  benefits: string[];
}

export const MODULE_CATALOG: Record<SellableModuleKey, ModuleInfo> = {
  messaging: {
    key: "messaging",
    name: "Mensajes Masivos",
    tagline: "Comunícate con todas tus familias y docentes en segundos.",
    benefits: [
      "Envía comunicados a todas las familias o a todos los docentes con un clic",
      "Usa plantillas con el logo y la identidad de tu colegio",
      "Consulta el historial de cada envío",
    ],
  },
  payments: {
    key: "payments",
    name: "Pagos",
    tagline: "Controla los cobros de tu colegio sin hojas de cálculo.",
    benefits: [
      "Registro de pagos en Bs y USD con la tasa BCV del día",
      "Estados de cuenta, morosos y recordatorios automáticos",
      "Facturas, reportes de ingresos y nómina del personal",
    ],
  },
  grades: {
    key: "grades",
    name: "Notas, Boletas y Sábana",
    tagline: "Del cuaderno de notas a la boleta impresa, sin errores.",
    benefits: [
      "Los docentes cargan las notas de cada momento desde su cuenta",
      "Boletas listas para imprimir con el formato de tu colegio",
      "Sábana de notas por sección en un clic y notas en línea para los representantes",
    ],
  },
  ministry_forms: {
    key: "ministry_forms",
    name: "Planillajes del Ministerio",
    tagline: "Las planillas oficiales del MPPE, generadas automáticamente.",
    benefits: [
      "Resumen Final de bachillerato (31059 / 31060) y de primaria (RR-DEA-06-04)",
      "Se arman solas con las notas y los datos de tus estudiantes",
      "Ahorra días de trabajo al cierre del año escolar",
    ],
  },
  attendance: {
    key: "attendance",
    name: "Control de Asistencias",
    tagline: "Sabe quién llegó, al instante.",
    benefits: [
      "Marcaje con el QR del carnet desde cualquier teléfono",
      "Los representantes reciben un aviso por correo cuando llega su hijo",
      "Dashboard con estadísticas de asistencia por sección",
    ],
  },
  virtual_classroom: {
    key: "virtual_classroom",
    name: "Aula Virtual",
    tagline: "Tu colegio, también en línea.",
    benefits: [
      "Los docentes publican actividades y materiales por área",
      "Los representantes siguen las tareas de sus hijos",
      "Supervisa todas las aulas desde una sola pantalla",
    ],
  },
};

export function isSellableModuleKey(value: unknown): value is SellableModuleKey {
  return typeof value === "string" && (SELLABLE_MODULE_KEYS as readonly string[]).includes(value);
}
