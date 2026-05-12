import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import networkImage from "@/assets/network-tech.png";

interface Breadcrumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  breadcrumbs: Breadcrumb[];
  imageUrl?: string;
  description?: string;
}

// Diccionario de descripciones persuasivas por título.
// Se evalúa en orden y aplica coincidencia parcial (title.includes(key)),
// por eso las claves más específicas deben ir primero.
const DESCRIPTIONS: Array<[string, string]> = [
  // Registros y gestión académica
  ["Agregar Docente", "Suma un nuevo docente a tu equipo y déjalo listo para impartir clases desde el primer día."],
  ["Editar Docente", "Mantén actualizada la ficha profesional de cada docente para una gestión impecable."],
  ["Docentes", "Gestiona tu equipo educativo, asigna materias y mantén toda la información de tus profesores en un solo lugar."],
  ["Mis Áreas Asignadas", "Resumen de las áreas que tienes asignadas este período."],
  ["Mis Áreas", "Accede rápidamente a todas tus áreas asignadas y comienza a planificar clases en segundos."],
  ["Registro de Notas", "Califica con precisión y agilidad. Tus estudiantes y representantes verán los resultados al instante."],
  ["Mi Carnet", "Tu identificación digital institucional, siempre disponible y lista para descargar."],
  ["Mis Estudiantes", "Mantente al día con el progreso académico de tus representados desde un único panel."],
  ["Mis Representantes", "Administra los datos familiares y mantén la comunicación con el colegio fluida y centralizada."],
  ["Familias Registradas", "Total de familias activas en tu institución."],
  ["Representantes Totales", "Cantidad de representantes vinculados a tus familias."],
  ["Estudiantes Totales", "Cantidad total de estudiantes activos en el colegio."],
  ["Estudiantes Inscritos", "Resumen de tu población estudiantil activa."],
  ["Docentes Activos", "Equipo docente actualmente en funciones."],
  ["Docentes Registrados", "Total histórico de docentes registrados en tu institución."],
  ["Áreas Asignadas", "Áreas actualmente asignadas a docentes y secciones."],
  ["Alumnos en el Sistema", "Conteo global de alumnos registrados en la plataforma."],
  ["Editar Familia", "Actualiza los datos del núcleo familiar y mantén la información siempre al día."],
  ["Datos de Familia", "Revisa y actualiza tus datos familiares para mantener una comunicación efectiva con el colegio."],
  ["Familia ", "Bienvenido a tu portal familiar. Toda la información de tus representados, en un solo lugar."],
  ["Familia", "Gestiona los datos del núcleo familiar y mantén la información actualizada."],
  ["Familias", "Gestiona los núcleos familiares y mantén actualizada la información de contacto de cada hogar."],
  ["Agregar Representante", "Registra un nuevo representante y vincúlalo a su familia en pocos pasos."],
  ["Editar Representante", "Actualiza la información del representante para mantener una comunicación efectiva."],
  ["Agregar Estudiante", "Registra un nuevo estudiante y comienza su historia académica con buen pie."],
  ["Editar Estudiante", "Actualiza los datos académicos y personales del estudiante con total seguridad."],
  ["Estudiantes Morosos", "Detecta a tiempo los casos morosos y actúa con información financiera precisa."],
  ["Estudiantes", "Visualiza, organiza y actualiza la información de cada estudiante con total facilidad."],
  ["Inscripciones", "Centraliza el proceso de inscripción y haz seguimiento del estatus de cada estudiante en tiempo real."],
  ["Búsqueda Avanzada", "Encuentra cualquier dato del colegio en segundos con filtros inteligentes y precisos."],

  // Administrativo / pagos
  ["Dashboard de Pagos", "Visualiza la salud financiera del colegio con métricas claras y reportes en tiempo real."],
  ["Registro de Pagos", "Procesa pagos rápidamente y entrega comprobantes profesionales sin complicaciones."],
  ["Configuración de Pagos", "Define conceptos, planes y reglas que se adaptan al modelo financiero de tu institución."],
  ["Configuración de Morosidad", "Automatiza el seguimiento de cuentas vencidas y mantén la cobranza siempre al día."],
  ["Estado de Cuenta", "Muestra de forma transparente el estado financiero de cada familia, pago a pago."],

  // Académico
  ["Áreas", "Diseña tu malla curricular y mantén ordenadas todas las áreas de conocimiento del colegio."],
  ["Asignación de Áreas", "Asigna áreas y materias a docentes y secciones de manera ágil y sin errores."],
  ["Asignación de Áreas (Legacy)", "Asigna áreas a docentes y secciones de manera ágil y sin errores."],
  ["Ajustes de Evaluación", "Configura escalas, períodos y criterios de evaluación según el nivel educativo."],
  ["Ajustes de Notas", "Define la estructura de evaluación y calificaciones para cada nivel del colegio."],
  ["Sábana de Notas", "Visualiza el rendimiento global de cada sección y genera reportes oficiales en un clic."],
  ["Consulta de Notas y Boletas", "Consulta calificaciones, descarga boletas y comparte resultados oficiales en segundos."],
  ["Consulta de Notas", "Consulta rápidamente las calificaciones de cualquier estudiante o sección."],
  ["Supervisión de Aulas Virtuales", "Monitorea la actividad académica de tus aulas en tiempo real."],

  // Asistencia
  ["Escáner QR", "Registra la asistencia diaria al instante con la tecnología de escaneo QR."],
  ["Asistencias", "Lleva un control preciso de la asistencia y comparte reportes con representantes automáticamente."],
  ["Asistencia", "Lleva un control preciso de la asistencia y comparte reportes con representantes automáticamente."],

  // Configuración del colegio
  ["Configuración de Planillas", "Personaliza qué información mostrar en las planillas oficiales de inscripción."],
  ["Configuraciones - Formularios", "Personaliza los formularios del colegio para capturar exactamente la información que necesitas."],
  ["Constructor de Planillas", "Diseña planillas y certificados oficiales con un editor visual potente y flexible."],
  ["Planillas", "Genera planillas y certificados oficiales listos para imprimir o enviar."],
  ["Usuarios y Permisos", "Crea usuarios escolares y otorga permisos granulares para que cada quien acceda solo a lo necesario."],
  ["Nuevo Usuario Escolar", "Suma a tu equipo y define exactamente lo que cada usuario podrá ver y hacer."],
  ["Editar Usuario", "Actualiza accesos, perfiles y permisos de tus usuarios escolares en cualquier momento."],
  ["Nuevo Perfil de Permiso", "Diseña perfiles de acceso a la medida de cada rol dentro del colegio."],
  ["Editar Perfil", "Ajusta los permisos del perfil para reflejar las responsabilidades reales de tu equipo."],
  ["Utilidades", "Herramientas adicionales para potenciar la gestión diaria de tu institución."],
  ["Carnets", "Genera carnets institucionales profesionales para todo tu colegio en pocos pasos."],
  ["Correos Electrónicos", "Envía comunicaciones masivas y mantén informada a toda tu comunidad educativa."],
  ["Configuraciones", "Centraliza la configuración académica y administrativa de tu institución."],

  // Admin general
  ["Crear Colegio", "Da de alta un nuevo colegio y déjalo listo para operar en minutos."],
  ["Editar Colegio", "Actualiza la información institucional y los datos clave del colegio."],
  ["Colegios", "Administra todas las instituciones de la plataforma desde un único panel centralizado."],
  ["Administradores del Sistema", "Controla quién tiene acceso administrativo total a la plataforma."],
  ["Usuarios", "Gestiona todos los usuarios de la plataforma de forma segura y centralizada."],
  ["Eventos", "Resumen de actividad reciente registrada en la plataforma."],
  ["Enviar Email", "Comunícate masivamente con familias, docentes o personal con plantillas profesionales."],
  ["Prueba de subida a S3", "Herramienta interna para validar la subida de archivos al almacenamiento."],
  ["Rol", "Tu rol activo dentro de la plataforma."],

  // Aula virtual
  ["Aula Virtual", "Espacio digital donde docentes, estudiantes y familias se conectan con el aprendizaje."],
];

function lookupDescription(title: string): string | undefined {
  for (const [key, desc] of DESCRIPTIONS) {
    if (title === key || title.includes(key)) return desc;
  }
  return undefined;
}

function getDescription(title: string, custom?: string) {
  if (custom) return custom;
  return lookupDescription(title);
}

export function PageHeader({ title, breadcrumbs, imageUrl, description }: PageHeaderProps) {
  const desc = getDescription(title, description);
  return (
    <div className="relative overflow-hidden rounded-xl bg-primary mb-6">
      <div className="relative z-10 flex items-center justify-between gap-6 px-6 py-5">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-white mb-1">{title}</h1>
          <nav className="flex items-center gap-1.5 text-sm">
            {breadcrumbs.map((crumb, index) => (
              <span key={index} className="flex items-center gap-1.5">
                {index > 0 && <ChevronRight className="h-3.5 w-3.5 text-white/50" />}
                {crumb.href ? (
                  <Link to={crumb.href} className="text-white/80 hover:text-white transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-white/60">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
          {desc && (
            <p className="mt-2 max-w-2xl text-sm text-white/80 leading-relaxed">
              {desc}
            </p>
          )}
        </div>
        <div className="hidden md:block shrink-0">
          <img
            src={imageUrl || networkImage}
            alt=""
            loading="lazy"
            width={96}
            height={96}
            className="h-24 w-24 object-contain drop-shadow-lg"
          />
        </div>
      </div>
      {/* Decorative gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/95 to-primary/80" />
    </div>
  );
}
