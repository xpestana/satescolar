/**
 * Catalog of the emails each school can edit in "Templates de Correo": the ONE source of default
 * subject/body, variables (snippets) and sample data. Used by the Edge Functions (sending and test
 * emails) and by the editor (defaults, "Restaurar", snippets and preview).
 */

export type EmailTemplateType =
  | "welcome-family"
  | "welcome-teacher"
  | "welcome-staff"
  | "delinquency"
  | "payment-reminder";

export interface TemplateVariable {
  key: string;
  label: string;
  /** Inserted as HTML (already built and escaped by the sender), not escaped again. */
  html?: boolean;
}

export interface EmailTemplateDefinition {
  type: EmailTemplateType;
  label: string;
  description: string;
  /** false = the school can edit it but nothing sends it yet ("Próximamente"). */
  sendsAutomatically: boolean;
  subject: string;
  body: string;
  variables: TemplateVariable[];
  sample: Record<string, string>;
}

export const DEFAULT_PRIMARY_COLOR = "#1e78c8";
export const DEFAULT_TEXT_COLOR = "#ffffff";
export const LOGIN_URL = "https://app.satescolar.com/login";

const loginButton =
  `<p style="text-align:center;"><a href="{{url_plataforma}}" style="display:inline-block;padding:12px 28px;background-color:{{primary_color}};color:#ffffff;font-weight:bold;text-decoration:none;border-radius:8px;">Ingresar a la Plataforma</a></p>
<p style="font-size:13px;color:#9ca3af;text-align:center;">Le recomendamos cambiar su contraseña una vez ingrese al sistema.</p>`;

const credentials = `<p>Sus credenciales de acceso:</p>
<p><strong>Usuario:</strong> {{email_usuario}}<br/><strong>Contraseña:</strong> {{contrasena}}</p>`;

const welcomeVariables = (who: string): TemplateVariable[] => [
  { key: "nombre_colegio", label: "Nombre del colegio" },
  { key: "email_usuario", label: `Email del ${who}` },
  { key: "contrasena", label: "Contraseña generada" },
  { key: "url_plataforma", label: "Link de acceso" },
];

const debtVariables = (totalLabel: string): TemplateVariable[] => [
  { key: "nombre_colegio", label: "Nombre del colegio" },
  { key: "nombre_estudiante", label: "Nombre del estudiante" },
  { key: "grado_seccion", label: "Grado y sección" },
  { key: "conceptos_pendientes", label: "Lista de conceptos", html: true },
  { key: "total_adeudado", label: totalLabel },
  { key: "telefono_colegio", label: "Teléfono del colegio" },
  { key: "email_colegio", label: "Email del colegio" },
];

const sampleSchool = { nombre_colegio: "Colegio Demo SAT", url_plataforma: LOGIN_URL };
const sampleDebt = {
  ...sampleSchool,
  nombre_estudiante: "Carlos Rodríguez",
  grado_seccion: "5to Grado - Sección A",
  telefono_colegio: "0412-0000000",
  email_colegio: "contacto@colegiodemo.edu.ve",
};

export const EMAIL_TEMPLATES: Record<EmailTemplateType, EmailTemplateDefinition> = {
  "welcome-family": {
    type: "welcome-family",
    label: "Bienvenida Representante",
    description: "Se envía cuando se registra una nueva familia o desde el botón de reenvío en la lista de familias.",
    sendsAutomatically: true,
    subject: "Bienvenido/a a {{nombre_colegio}} - SAT Escolar",
    body: `<h2>¡Bienvenido/a!</h2>
<p>Ha sido registrado como <strong>representante</strong> en <strong>{{nombre_colegio}}</strong> a través de la plataforma <strong>SAT Escolar</strong>.</p>
${credentials}
${loginButton}`,
    variables: welcomeVariables("representante"),
    sample: { ...sampleSchool, email_usuario: "maria.perez@demo.com", contrasena: "Demo1234" },
  },
  "welcome-teacher": {
    type: "welcome-teacher",
    label: "Bienvenida Docente",
    description: "Se envía cuando se registra un nuevo docente o desde el botón de reenvío en la lista de docentes.",
    sendsAutomatically: true,
    subject: "Bienvenido/a a {{nombre_colegio}} - SAT Escolar",
    body: `<h2>¡Bienvenido/a!</h2>
<p>Ha sido registrado como <strong>docente</strong> en <strong>{{nombre_colegio}}</strong> a través de la plataforma <strong>SAT Escolar</strong>.</p>
${credentials}
${loginButton}`,
    variables: welcomeVariables("docente"),
    sample: { ...sampleSchool, email_usuario: "pedro.gomez@demo.com", contrasena: "12345678" },
  },
  "welcome-staff": {
    type: "welcome-staff",
    label: "Bienvenida Personal del Colegio",
    description: "Se envía al crear un usuario del colegio (o el dueño) y al restablecer su contraseña.",
    sendsAutomatically: true,
    subject: "Bienvenido/a a {{nombre_colegio}} - SAT Escolar",
    body: `<h2>Hola {{nombre_usuario}},</h2>
<p>Ha sido registrado como <strong>{{rol_usuario}}</strong> en <strong>{{nombre_colegio}}</strong> a través de la plataforma <strong>SAT Escolar</strong>.</p>
${credentials}
${loginButton}`,
    variables: [
      ...welcomeVariables("usuario"),
      { key: "nombre_usuario", label: "Nombre del usuario" },
      { key: "rol_usuario", label: "Rol (administrador / usuario del colegio)" },
    ],
    sample: {
      ...sampleSchool,
      email_usuario: "ana.lopez@demo.com",
      contrasena: "Demo1234",
      nombre_usuario: "Ana López",
      rol_usuario: "usuario del colegio",
    },
  },
  delinquency: {
    type: "delinquency",
    label: "Aviso de Morosidad",
    description:
      "Se envía automáticamente según la configuración de morosidad del colegio (diario, semanal o por días del mes).",
    sendsAutomatically: true,
    subject: "Recordatorio de Pago Pendiente - {{nombre_estudiante}}",
    body: `<h2>Recordatorio de Pago Pendiente</h2>
<p>Estimado(a) representante,</p>
<p>Le informamos que <strong>{{nombre_estudiante}}</strong> ({{grado_seccion}}) presenta un saldo pendiente en <strong>{{nombre_colegio}}</strong>.</p>
<h3>Conceptos pendientes:</h3>
{{conceptos_pendientes}}
<p style="font-size:18px;color:#c0392b;"><strong>Total pendiente: {{total_adeudado}}</strong></p>
<p>Le invitamos a regularizar su situación. Si ya realizó el pago, háganos llegar el comprobante.</p>
<p>Contáctenos:<br/>Teléfono: {{telefono_colegio}}<br/>Email: {{email_colegio}}</p>
<p>Atentamente,<br/><strong>{{nombre_colegio}}</strong></p>`,
    variables: debtVariables("Total adeudado"),
    sample: {
      ...sampleDebt,
      conceptos_pendientes:
        "<ul><li>Mensualidad Enero 2025: <strong>150,00 VES</strong></li><li>Mensualidad Febrero 2025: <strong>150,00 VES</strong></li><li>Inscripción Anual: <strong>200,00 VES</strong></li></ul>",
      total_adeudado: "500,00 VES",
    },
  },
  "payment-reminder": {
    type: "payment-reminder",
    label: "Recordatorio de Cuotas",
    description: "Aviso de cuotas próximas a vencer. Puede dejarlo listo; el envío automático aún no está disponible.",
    sendsAutomatically: false,
    subject: "Recordatorio de Cuota - {{nombre_estudiante}}",
    body: `<h2>Recordatorio de Cuota</h2>
<p>Estimado(a) representante,</p>
<p>Le recordamos que <strong>{{nombre_estudiante}}</strong> ({{grado_seccion}}) tiene cuotas próximas a vencer en <strong>{{nombre_colegio}}</strong>.</p>
<h3>Detalle:</h3>
{{conceptos_pendientes}}
<p><strong>Total: {{total_adeudado}}</strong></p>
<p>Para consultas:<br/>Teléfono: {{telefono_colegio}}<br/>Email: {{email_colegio}}</p>
<p>Atentamente,<br/><strong>{{nombre_colegio}}</strong></p>`,
    variables: debtVariables("Monto pendiente"),
    sample: {
      ...sampleDebt,
      conceptos_pendientes: "<ul><li>Mensualidad Marzo 2025: <strong>150,00 VES</strong></li></ul>",
      total_adeudado: "150,00 VES",
    },
  },
};

export const EMAIL_TEMPLATE_TYPES = Object.keys(EMAIL_TEMPLATES) as EmailTemplateType[];

export function isEmailTemplateType(value: unknown): value is EmailTemplateType {
  return typeof value === "string" && value in EMAIL_TEMPLATES;
}
