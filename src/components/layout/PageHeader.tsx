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
// Se utiliza como fallback cuando una página no envía `description`.
const DESCRIPTIONS: Record<string, string> = {
  // Registros
  "Docentes": "Gestiona tu equipo educativo, asigna materias y mantén toda la información de tus profesores en un solo lugar.",
  "Mis Materias": "Accede rápidamente a todas tus materias asignadas y comienza a planificar clases en segundos.",
  "Registro de Notas": "Califica con precisión y agilidad. Tus estudiantes y representantes verán los resultados al instante.",
  "Mi Carnet": "Tu identificación digital institucional, siempre disponible y lista para descargar.",
  "Mis Estudiantes": "Mantente al día con el progreso académico de tus representados desde un único panel.",
  "Mis Representantes": "Administra los datos familiares y mantén la comunicación con el colegio fluida y centralizada.",
  "Estudiantes": "Visualiza, organiza y actualiza la información de cada estudiante con total facilidad.",
  "Familias": "Gestiona los núcleos familiares y mantén actualizada la información de contacto de cada hogar.",
  "Inscripciones": "Centraliza el proceso de inscripción y haz seguimiento del estatus de cada estudiante en tiempo real.",
  "Búsqueda Avanzada": "Encuentra cualquier dato del colegio en segundos con filtros inteligentes y precisos.",

  // Administrativo
  "Dashboard de Pagos": "Visualiza la salud financiera del colegio con métricas claras y reportes en tiempo real.",
  "Registro de Pagos": "Procesa pagos rápidamente y entrega comprobantes profesionales sin complicaciones.",
  "Configuración de Pagos": "Define conceptos, planes y reglas que se adaptan al modelo financiero de tu institución.",
  "Configuración de Morosidad": "Automatiza el seguimiento de cuentas vencidas y mantén la cobranza siempre al día.",
  "Estudiantes Morosos": "Detecta a tiempo los casos morosos y actúa con información financiera precisa.",
  "Estado de Cuenta": "Muestra de forma transparente el estado financiero de cada familia, pago a pago.",

  // Académico
  "Materias": "Diseña tu malla curricular y mantén ordenadas todas las áreas de conocimiento del colegio.",
  "Asignación de Materias": "Asigna materias a docentes y secciones de manera ágil y sin errores.",
  "Configuraciones": "Centraliza la configuración académica de tu institución en un panel intuitivo.",
  "Ajustes de Evaluación": "Configura escalas, períodos y criterios de evaluación según el nivel educativo.",
  "Sábana de Notas": "Visualiza el rendimiento global de cada sección y genera reportes oficiales en un clic.",
  "Consulta de Notas": "Consulta rápidamente las calificaciones de cualquier estudiante o sección.",
  "Supervisión de Aulas Virtuales": "Monitorea la actividad académica de tus aulas en tiempo real.",

  // Asistencia
  "Escáner QR": "Registra la asistencia diaria al instante con la tecnología de escaneo QR.",
  "Asistencia": "Lleva un control preciso de la asistencia y comparte reportes con representantes automáticamente.",

  // Configuración
  "Configuraciones - Formularios": "Personaliza los formularios del colegio para capturar exactamente la información que necesitas.",
  "Constructor de Planillas": "Diseña planillas y certificados oficiales con un editor visual potente y flexible.",
  "Usuarios y Permisos": "Crea usuarios escolares y otorga permisos granulares para que cada quien acceda solo a lo necesario.",
  "Nuevo Usuario Escolar": "Suma a tu equipo y define exactamente lo que cada usuario podrá ver y hacer.",
  "Editar Usuario": "Actualiza accesos, perfiles y permisos de tus usuarios escolares en cualquier momento.",
  "Nuevo Perfil de Permiso": "Diseña perfiles de acceso a la medida de cada rol dentro del colegio.",
  "Editar Perfil": "Ajusta los permisos del perfil para reflejar las responsabilidades reales de tu equipo.",
  "Configuración de Inscripción": "Define qué campos verá cada familia durante el proceso de inscripción.",
  "Utilidades": "Herramientas adicionales para potenciar la gestión diaria de tu institución.",
  "Carnets": "Genera carnets institucionales profesionales para todo tu colegio en pocos pasos.",

  // Admin general
  "Colegios": "Administra todas las instituciones de la plataforma desde un único panel centralizado.",
  "Crear Colegio": "Da de alta un nuevo colegio y déjalo listo para operar en minutos.",
  "Editar Colegio": "Actualiza la información institucional y los datos clave del colegio.",
  "Usuarios": "Gestiona todos los usuarios de la plataforma de forma segura y centralizada.",
  "Administradores del Sistema": "Controla quién tiene acceso administrativo total a la plataforma.",
  "Enviar Email": "Comunícate masivamente con familias, docentes o personal con plantillas profesionales.",

  // Aula virtual
  "Aula Virtual": "Espacio digital donde docentes, estudiantes y familias se conectan con el aprendizaje.",

  // Periodos
  "Períodos y Secciones": "Organiza años escolares, niveles y secciones para mantener tu colegio operando con orden.",
};

function getDescription(title: string, custom?: string) {
  if (custom) return custom;
  // Coincidencia parcial por si el título incluye sufijos dinámicos
  const exact = DESCRIPTIONS[title];
  if (exact) return exact;
  const partial = Object.keys(DESCRIPTIONS).find((k) => title.includes(k));
  return partial ? DESCRIPTIONS[partial] : undefined;
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
