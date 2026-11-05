import type { ReactNode } from "react";
import type { PayrollGuideContent } from "@/components/payroll/PayrollGuide";

// Instructions of each payroll screen. They depend on what this school has turned on, so a school
// that doesn't withhold taxes never reads about withholdings.

export interface GuideOptions {
  vatEnabled: boolean;
  islrEnabled: boolean;
}

const B = ({ children }: { children: ReactNode }) => <strong className="font-medium text-foreground">{children}</strong>;

const when = (condition: boolean, ...items: ReactNode[]): ReactNode[] => (condition ? items : []);

const taxNames = ({ vatEnabled, islrEnabled }: GuideOptions) =>
  vatEnabled && islrEnabled ? "IVA e ISLR" : vatEnabled ? "IVA" : "ISLR";

export function overviewGuide(options: GuideOptions): PayrollGuideContent {
  const withholds = options.vatEnabled || options.islrEnabled;
  return {
    id: "overview",
    title: "¿Cómo trabajar con Nómina?",
    steps: [
      <><B>Configuración:</B> crea los conceptos de pago y el período que vas a pagar.</>,
      <><B>Beneficiarios:</B> registra al personal y a los proveedores con sus datos.</>,
      <><B>Registro:</B> registra cada pago, apruébalo y márcalo como pagado.</>,
      ...when(withholds, <><B>Retenciones:</B> descarga los comprobantes, prepara la declaración y lleva el control de lo declarado y enterado.</>),
      <><B>En esta pantalla</B> ves los totales y exportas la nómina a Excel.</>,
    ],
    notes: [
      withholds
        ? <>Este colegio retiene {taxNames(options)}. Puedes ver y cambiar los porcentajes en Configuración, pestaña Retenciones.</>
        : <>Este colegio no tiene retenciones activas. Si es agente de retención, se activan en Configuración, pestaña Retenciones.</>,
    ],
  };
}

export function beneficiariesGuide(options: GuideOptions): PayrollGuideContent {
  const withholds = options.vatEnabled || options.islrEnabled;
  return {
    id: "beneficiaries",
    title: "¿Cómo registrar a un beneficiario?",
    steps: [
      <>Pulsa <B>Nuevo beneficiario</B> y elige la <B>Categoría</B>.</>,
      <>En <B>Cómo se le paga</B>, elige <B>Nómina</B> para quien cobra sueldo o <B>Factura u honorarios</B> para quien te factura. Un proveedor siempre va por factura.</>,
      <>Completa los campos marcados con *. El formulario pide solo lo que corresponde a cada tipo.</>,
      ...when(options.islrEnabled, <>Al personal por nómina, indica su RIF y su <B>% AR-I</B> con la fecha desde la que aplica.</>),
      <>
        Al proveedor, indica su RIF, domicilio fiscal y correo.
        {withholds && " Salen en su comprobante, y a ese correo se le envía."}
        {options.islrEnabled && <> Indica también su <B>concepto de ISLR habitual</B>.</>}
      </>,
      <>Con <B>Métodos</B>, guarda la cuenta o el medio donde le pagas.</>,
    ],
    notes: [
      <><B>Docentes:</B> puedes vincular uno ya registrado o registrarlo solo en Nómina, sin darle acceso al sistema. Si luego lo agregas en Docentes con la misma cédula, quedan vinculados.</>,
      <>
        <B>Datos incompletos:</B> pasa el cursor sobre la etiqueta para ver qué falta.
        {withholds && " Hasta completarlo no podrás registrarle pagos."}
      </>,
    ],
  };
}

export function staffGuide(options: GuideOptions): PayrollGuideContent {
  const withholds = options.vatEnabled || options.islrEnabled;
  return {
    id: "staff",
    title: "¿Cómo pagar al personal?",
    steps: [
      <>Elige el <B>período</B> en el selector de arriba.</>,
      <>Pulsa <B>Registrar</B> junto a cada persona y agrega sus asignaciones y deducciones.</>,
      ...when(options.islrEnabled, <>La retención de <B>AR-I</B> se agrega sola, según el porcentaje de su ficha.</>),
      <>Revisa el neto y pulsa <B>Registrar pago</B>. Queda en <B>Borrador</B>.</>,
      <>Pulsa <B>Aprobar</B> y, cuando hayas hecho la transferencia, <B>Pagar</B>.</>,
    ],
    notes: [
      <><B>Pagar</B> deja constancia en el sistema y envía el recibo si la persona tiene correo. No mueve dinero: la transferencia la haces en tu banco.</>,
      <>Puedes anular un pago con el ícono rojo, indicando el motivo, mientras no esté pagado.</>,
      ...when(withholds, <>Si aparece <B>Complete en Beneficiarios</B>, a esa persona le falta un dato obligatorio y no se le puede registrar el pago.</>),
    ],
  };
}

export function supplierGuide(options: GuideOptions): PayrollGuideContent {
  const withholds = options.vatEnabled || options.islrEnabled;
  return {
    id: "suppliers",
    title: "¿Cómo registrar una factura?",
    steps: [
      <>Pulsa <B>Registrar factura</B> y elige al proveedor. Si no existe, créalo con <B>Nuevo proveedor</B>.</>,
      <>Copia los datos de la factura: número, N° de control, fecha, base imponible, monto exento y alícuota. El IVA se calcula solo; corrígelo si la factura dice otro monto.</>,
      ...when(options.islrEnabled, <>Elige el <B>concepto de ISLR</B>. Si solo vende bienes, elige <B>No aplica</B>.</>),
      <>Si una transferencia cubre varias facturas, añádelas con <B>Agregar factura</B>.</>,
      ...when(withholds, <>Revisa la retención calculada y el <B>Neto a pagar</B>.</>),
      <>Pulsa <B>Registrar pago</B>. Queda en <B>Borrador</B>.</>,
      <>Pulsa <B>Aprobar</B> y, cuando hayas hecho la transferencia, <B>Pagar</B>.{withholds && " Al pagar se asigna el número de cada comprobante."}</>,
    ],
    notes: [
      ...when(options.vatEnabled, <>Marca <B>Caja chica</B>, <B>IVA no discriminado</B> o <B>Factura con incumplimientos</B> solo si aplica, porque cambian el cálculo.</>),
      ...when(withholds, <>Para usar otro porcentaje en una factura, marca <B>Cambiar %</B>. El motivo es obligatorio y queda registrado.</>),
      ...when(withholds, <>Si un porcentaje cambió antes de pagar, el sistema te pedirá <B>Recalcular</B>. El pago vuelve a borrador y hay que aprobarlo otra vez.</>),
      withholds
        ? <>Un pago ya pagado se puede anular mientras sus retenciones no estén declaradas. Su número de comprobante no se reutiliza.</>
        : <>Puedes anular un pago con el ícono rojo, indicando el motivo.</>,
    ],
  };
}

export function conceptsGuide(options: { islrEnabled: boolean }): PayrollGuideContent {
  return {
    id: "concepts",
    title: "¿Para qué sirven los conceptos?",
    steps: [
      <>Crea cada concepto con su nombre y tipo: <B>Asignación</B> suma al pago y <B>Deducción</B> lo resta.</>,
      <>Si suele ser el mismo monto, escríbelo en <B>Monto por defecto</B>.</>,
      <>Los usarás al registrar los pagos del personal.</>,
    ],
    notes: when(options.islrEnabled, <>Solo las asignaciones con <B>Base del AR-I</B> encendido entran en el cálculo de esa retención.</>),
  };
}

export function periodsGuide(): PayrollGuideContent {
  return {
    id: "periods",
    title: "¿Para qué sirven los períodos?",
    steps: [
      <>Crea un período por cada nómina, con su nombre, tipo (<B>Mensual</B> o <B>Quincenal</B>) y fechas.</>,
      <>Al registrar los pagos, elige el período al que pertenecen.</>,
    ],
    notes: [<>El período organiza la nómina. Las retenciones se agrupan por la fecha de pago, no por este período.</>],
  };
}

export function withholdingsConfigGuide(configured: boolean): PayrollGuideContent {
  return {
    id: "withholdings-config",
    title: "¿Cómo configurar las retenciones?",
    steps: [
      ...when(!configured, <>Pulsa <B>Configurar retenciones</B> para cargar los valores iniciales. Seguirán apagadas.</>),
      <>Revisa con el contador los <B>Parámetros generales</B> y la <B>Tabla de retención de ISLR</B>. Los valores iniciales son solo un punto de partida.</>,
      <>Para cambiar un parámetro, escribe el valor nuevo, indica desde qué fecha aplica y pulsa <B>Guardar nueva versión</B>.</>,
      <>En la tabla de ISLR, pulsa un porcentaje para cambiarlo y escribe el <B>Código SENIAT</B> de cada concepto.</>,
      <>Cuando todo esté revisado, pulsa <B>Marcar como validada por el contador</B>.</>,
      <>En <B>Numeración de comprobantes</B>, escribe el próximo número para continuar la secuencia del colegio.</>,
      <>En <B>Activación</B>, enciende solo lo que le aplique a este colegio. IVA e ISLR se activan por separado.</>,
    ],
    notes: [
      <>Estos valores son solo de este colegio. Si el SENIAT cambia la unidad tributaria o un porcentaje, hay que actualizarlo aquí.</>,
      <>Los pagos ya registrados conservan los valores con los que se calcularon.</>,
    ],
  };
}

export function withholdingsPeriodGuide(taxType: "vat" | "islr"): PayrollGuideContent {
  const isVat = taxType === "vat";
  return {
    id: `withholdings-${taxType}`,
    title: `¿Cómo gestionar las retenciones de ${isVat ? "IVA" : "ISLR"}?`,
    steps: [
      <>Elige {isVat ? "la " : "el "}<B>{isVat ? "quincena" : "mes"}</B>. Cada retención cuenta según su fecha de pago.</>,
      <>Revisa el <B>Total a enterar</B> y la lista.</>,
      <>Descarga cada comprobante con la flecha o envíalo al proveedor con el sobre.</>,
      <>Descarga el <B>Excel de la declaración</B> y presenta la declaración en el portal del SENIAT.</>,
      <>Selecciona las retenciones, pulsa <B>Marcar declaradas</B> y escribe el N° de declaración.</>,
      <>Cuando hagas el pago, selecciónalas de nuevo, pulsa <B>Marcar enteradas</B> y escribe la referencia.</>,
    ],
    notes: [
      <>Una retención declarada ya no se puede anular. Revisa bien antes de marcarla.</>,
      ...when(!isVat, <>Las retenciones de sueldos no llevan comprobante aquí: salen en la pestaña <B>Comprobante anual</B>.</>),
    ],
  };
}

export function annualCertificatesGuide(): PayrollGuideContent {
  return {
    id: "withholdings-annual",
    title: "¿Cómo sacar el comprobante anual?",
    steps: [
      <>Elige el <B>año</B>.</>,
      <>Revisa el monto sujeto y el ISLR retenido de cada trabajador.</>,
      <>Descarga su comprobante con la flecha y entrégaselo.</>,
    ],
    notes: [<>Solo aparecen los trabajadores con retenciones de sueldo en ese año.</>],
  };
}
