import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Info,
  MessageSquare,
  BookOpen,
  Calendar,
  Users,
  Settings,
  FileText,
  PenLine,
  ClipboardList,
  Bell,
  Layers,
  LayoutGrid,
  GraduationCap,
  ChevronRight,
} from "lucide-react";

interface TutorialStep {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function TutorialCard({ steps, columns = 3 }: { steps: TutorialStep[]; columns?: number }) {
  const gridClass =
    columns === 4
      ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
      : columns === 2
        ? "grid-cols-1 md:grid-cols-2"
        : "grid-cols-1 md:grid-cols-3";

  return (
    <Card className="mt-2 border-primary/20">
      <CardContent className="pt-6">
        <div className={`grid ${gridClass} gap-5`}>
          {steps.map((step, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                {i + 1}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm mb-1 flex items-center gap-1.5">
                  {step.icon}
                  {step.title}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/** Tutorial for the ClassroomList page (overview of the virtual classroom system) */
export function ClassroomListTutorial() {
  const [open, setOpen] = useState(true);

  const steps: TutorialStep[] = [
    {
      icon: <LayoutGrid className="h-4 w-4 text-primary" />,
      title: "Mis Aulas",
      description:
        "Aquí verás todas las materias que tienes asignadas, organizadas por año escolar. Haz clic en cualquier tarjeta para entrar al aula.",
    },
    {
      icon: <Settings className="h-4 w-4 text-primary" />,
      title: "Personalizar",
      description:
        "Dentro de cada aula puedes cambiar el color, la portada, agregar descripción y un mensaje de bienvenida para tus estudiantes.",
    },
    {
      icon: <BookOpen className="h-4 w-4 text-primary" />,
      title: "Crear Actividades",
      description:
        'En la pestaña "Trabajo" puedes crear tareas, evaluaciones y material. Organízalos por temas para mantener el orden.',
    },
    {
      icon: <GraduationCap className="h-4 w-4 text-primary" />,
      title: "Evaluar y Calificar",
      description:
        "Revisa las entregas de tus estudiantes, asigna calificaciones y deja retroalimentación directamente desde cada actividad.",
    },
  ];

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-6">
      <Alert className="border-primary/30 bg-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription className="flex items-center justify-between w-full">
          <span className="font-medium text-sm">
            Guía rápida: ¿Cómo usar el Aula Virtual?
          </span>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="ml-2">
              {open ? "Ocultar" : "Ver guía"}
            </Button>
          </CollapsibleTrigger>
        </AlertDescription>
      </Alert>
      <CollapsibleContent>
        <TutorialCard steps={steps} columns={4} />
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Tutorial for the ClassroomDetail page (tab-by-tab guide) */
export function ClassroomDetailTutorial() {
  const [open, setOpen] = useState(true);

  const steps: TutorialStep[] = [
    {
      icon: <MessageSquare className="h-4 w-4 text-primary" />,
      title: "Muro",
      description:
        "Publica anuncios, comparte materiales y comunícate con tus estudiantes. Puedes anclar publicaciones importantes y adjuntar archivos.",
    },
    {
      icon: <Layers className="h-4 w-4 text-primary" />,
      title: "Trabajo → Temas",
      description:
        'Crea temas (ej: "Unidad 1", "Parcial 2") para organizar tus actividades. Los temas mantienen el contenido ordenado.',
    },
    {
      icon: <PenLine className="h-4 w-4 text-primary" />,
      title: "Trabajo → Actividades",
      description:
        'Usa el botón "+ Crear" para agregar tareas, evaluaciones, material de apoyo o preguntas. Configura fechas de entrega y puntuación máxima.',
    },
    {
      icon: <ClipboardList className="h-4 w-4 text-primary" />,
      title: "Revisar Entregas",
      description:
        "Haz clic en una actividad para ver quién entregó, calificar con nota y rúbrica, y dejar comentarios individuales.",
    },
    {
      icon: <Calendar className="h-4 w-4 text-primary" />,
      title: "Calendario",
      description:
        "Visualiza todas las fechas de entrega y eventos de tu aula en formato calendario. Las actividades creadas aparecen automáticamente.",
    },
    {
      icon: <Users className="h-4 w-4 text-primary" />,
      title: "Personas",
      description:
        "Consulta la lista de estudiantes inscritos en esta sección. Puedes ver el progreso individual de cada uno.",
    },
    {
      icon: <Bell className="h-4 w-4 text-primary" />,
      title: "Notificaciones",
      description:
        "El sistema envía notificaciones automáticas cuando hay nuevas entregas o comentarios. Revisa la campana en la esquina superior.",
    },
    {
      icon: <Settings className="h-4 w-4 text-primary" />,
      title: "Configurar Aula",
      description:
        'Usa el botón "Configurar" para cambiar color, portada, reglas del aula y controlar si los estudiantes pueden publicar o comentar.',
    },
  ];

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-6">
      <Alert className="border-primary/30 bg-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription className="flex items-center justify-between w-full">
          <span className="font-medium text-sm">
            Guía: Funcionalidades del Aula Virtual
          </span>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="ml-2">
              {open ? "Ocultar" : "Ver guía"}
            </Button>
          </CollapsibleTrigger>
        </AlertDescription>
      </Alert>
      <CollapsibleContent>
        <TutorialCard steps={steps} columns={4} />
      </CollapsibleContent>
    </Collapsible>
  );
}
