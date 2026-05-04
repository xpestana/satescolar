// Descripciones persuasivas por título de página.
// Si el título coincide (case-insensitive), se muestra debajo del título en el PageHeader.

const map: Record<string, string> = {
  // Dashboards
  "dashboard": "Visualiza en tiempo real el pulso de tu institución y toma decisiones inteligentes.",
  "dashboard de pagos": "Controla ingresos, morosidad y flujo de caja con datos siempre actualizados.",

  // Inscripciones / matrícula
  "inscripciones": "Gestiona la matrícula de tus estudiantes de forma ágil, organizada y sin papeleo.",
  "consulta de notas": "Accede al historial académico completo de cada estudiante en segundos.",
  "sábana de notas": "Consolida calificaciones por sección y período en un solo reporte profesional.",
  "sabana de notas": "Consolida calificaciones por sección y período en un solo reporte profesional.",

  // Registros
  "familia": "Centraliza la información de cada familia y mantén la comunicación siempre activa.",
  "familias": "Centraliza la información de cada familia y mantén la comunicación siempre activa.",
  "representantes": "Administra los datos de los representantes con seguridad y trazabilidad total.",
  "estudiantes": "El historial completo de cada alumno, siempre disponible y al día.",
  "docentes": "Tu equipo docente organizado, conectado y con acceso inmediato a sus herramientas.",
  "áreas / materias": "Diseña el plan de estudios que tu institución necesita, sin límites.",
  "areas / materias": "Diseña el plan de estudios que tu institución necesita, sin límites.",
  "asignación de materias": "Distribuye carga académica de forma clara, justa y sin conflictos.",
  "asignacion de materias": "Distribuye carga académica de forma clara, justa y sin conflictos.",
  "años escolares y secciones": "Estructura períodos y secciones para una operación impecable todo el año.",
  "anios escolares y secciones": "Estructura períodos y secciones para una operación impecable todo el año.",

  // Pagos
  "configuración de pagos": "Define planes, conceptos y reglas de cobro adaptados a tu colegio.",
  "configuracion de pagos": "Define planes, conceptos y reglas de cobro adaptados a tu colegio.",
  "registro de pagos": "Registra cada transacción al instante y olvídate de las hojas de cálculo.",
  "estado de cuenta": "Visualiza saldos, abonos y deudas de cada familia con total claridad.",
  "morosidad": "Detecta y actúa sobre cuentas vencidas antes de que se conviertan en problema.",
  "estudiantes morosos": "Detecta y actúa sobre cuentas vencidas antes de que se conviertan en problema.",
  "configuración de morosidad": "Automatiza recordatorios y políticas de cobro con criterios inteligentes.",
  "configuracion de morosidad": "Automatiza recordatorios y políticas de cobro con criterios inteligentes.",

  // Asistencia
  "asistencia": "Lleva el control diario con escaneo QR y reportes automáticos para los padres.",
  "escáner de asistencia": "Marca presencia con un solo escaneo y notifica a las familias en tiempo real.",
  "escaner de asistencia": "Marca presencia con un solo escaneo y notifica a las familias en tiempo real.",

  // Aulas / docentes
  "supervisión de aulas": "Acompaña la actividad académica desde una vista unificada y poderosa.",
  "supervision de aulas": "Acompaña la actividad académica desde una vista unificada y poderosa.",
  "mis aulas": "Tu salón virtual conectado: actividades, entregas y estudiantes en un solo lugar.",
  "mis materias": "Planifica, evalúa y entrega notas sin salir de la plataforma.",
  "calificaciones": "Captura notas en segundos con cálculos automáticos y respaldo permanente.",
  "mi carnet": "Tu credencial digital institucional, lista para imprimir o llevar en el móvil.",

  // Configuraciones / utilidades
  "configuraciones - formularios": "Personaliza qué información recolectas para que se adapte a tu colegio.",
  "ajustes de evaluación": "Configura escalas, períodos y criterios bajo los estándares de tu institución.",
  "ajustes de evaluacion": "Configura escalas, períodos y criterios bajo los estándares de tu institución.",
  "utilidades": "Herramientas potentes para automatizar tareas y ganar horas cada semana.",
  "correos electrónicos": "Comunícate con familias y docentes con plantillas profesionales y envíos masivos.",
  "correos electronicos": "Comunícate con familias y docentes con plantillas profesionales y envíos masivos.",
  "configuración de planilla": "Diseña la planilla de inscripción ideal para tu colegio, campo por campo.",
  "configuracion de planilla": "Diseña la planilla de inscripción ideal para tu colegio, campo por campo.",

  // Búsqueda / admin
  "búsqueda avanzada": "Encuentra cualquier registro en segundos con filtros poderosos y precisos.",
  "busqueda avanzada": "Encuentra cualquier registro en segundos con filtros poderosos y precisos.",
  "colegios": "Administra todas las instituciones conectadas desde un panel centralizado.",
  "usuarios": "Gestiona accesos, roles y permisos con seguridad de nivel empresarial.",
  "usuarios administradores": "Define quién tiene control total y mantén tu plataforma segura.",
  "enviar email": "Comunicación directa, masiva y profesional con un par de clics.",
};

export function getPageDescription(title: string): string | undefined {
  return map[title.trim().toLowerCase()];
}
