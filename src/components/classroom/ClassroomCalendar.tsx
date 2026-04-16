import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, BookOpen, FileText, Flag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ClassroomCalendarProps {
  assignmentId: string;
  schoolId: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: "activity" | "event" | "evaluation";
  color: string;
  meta?: string;
}

const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const DAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export function ClassroomCalendar({ assignmentId, schoolId }: ClassroomCalendarProps) {
  const now = new Date();
  const [month, setMonth] = useMemo(() => [now.getMonth(), now.getFullYear()], []);
  const [currentMonth, setCurrentMonth] = useMemo(() => {
    // We'll use state-like approach via a simple wrapper
    return [month, setMonth] as const;
  }, []);

  // Actually use state
  const { useState } = require("react");
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [viewYear, setViewYear] = useState(now.getFullYear());

  // Fetch activities with due dates
  const { data: activities = [] } = useQuery({
    queryKey: ["calendar-activities", assignmentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("classroom_activities")
        .select("id, title, due_date, activity_type, status")
        .eq("assignment_id", assignmentId)
        .eq("status", "published")
        .not("due_date", "is", null);
      return data || [];
    },
    enabled: !!assignmentId,
  });

  // Fetch classroom events
  const { data: events = [] } = useQuery({
    queryKey: ["calendar-events", assignmentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("classroom_events")
        .select("id, title, event_date, event_type, description")
        .eq("assignment_id", assignmentId);
      return data || [];
    },
    enabled: !!assignmentId,
  });

  // Fetch evaluation plan items
  const { data: evalItems = [] } = useQuery({
    queryKey: ["calendar-eval-items", assignmentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("evaluation_plan_items")
        .select("id, description, momento, percentage")
        .eq("assignment_id", assignmentId);
      return data || [];
    },
    enabled: !!assignmentId,
  });

  // Merge all into calendar events
  const calendarEvents: CalendarEvent[] = useMemo(() => {
    const result: CalendarEvent[] = [];

    activities.forEach((a: any) => {
      if (a.due_date) {
        result.push({
          id: a.id,
          title: a.title,
          date: a.due_date,
          type: "activity",
          color: "hsl(var(--primary))",
          meta: a.activity_type,
        });
      }
    });

    events.forEach((e: any) => {
      result.push({
        id: e.id,
        title: e.title,
        date: e.event_date,
        type: "event",
        color: "hsl(var(--accent))",
        meta: e.event_type,
      });
    });

    return result;
  }, [activities, events]);

  // Calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1);
  const lastDay = new Date(viewYear, viewMonth + 1, 0);
  const startDow = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const getEventsForDay = (day: number) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return calendarEvents.filter((e) => e.date.startsWith(dateStr));
  };

  const navigateMonth = (delta: number) => {
    let newMonth = viewMonth + delta;
    let newYear = viewYear;
    if (newMonth < 0) { newMonth = 11; newYear--; }
    if (newMonth > 11) { newMonth = 0; newYear++; }
    setViewMonth(newMonth);
    setViewYear(newYear);
  };

  const today = new Date();
  const isToday = (day: number) =>
    day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigateMonth(-1)}
          className="p-2 rounded-md hover:bg-muted text-muted-foreground"
        >
          ←
        </button>
        <h3 className="text-lg font-semibold">
          {MONTHS_ES[viewMonth]} {viewYear}
        </h3>
        <button
          onClick={() => navigateMonth(1)}
          className="p-2 rounded-md hover:bg-muted text-muted-foreground"
        >
          →
        </button>
      </div>

      {/* Calendar grid */}
      <div className="border rounded-lg overflow-hidden">
        <div className="grid grid-cols-7 bg-muted/50">
          {DAYS_ES.map((d) => (
            <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            const dayEvents = day ? getEventsForDay(day) : [];
            return (
              <div
                key={idx}
                className={`min-h-[80px] border-t border-r p-1 ${
                  day ? "bg-background" : "bg-muted/20"
                } ${isToday(day || 0) ? "ring-2 ring-inset ring-primary/50" : ""}`}
              >
                {day && (
                  <>
                    <span
                      className={`text-xs font-medium ${
                        isToday(day) ? "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center" : "text-muted-foreground"
                      }`}
                    >
                      {day}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {dayEvents.slice(0, 3).map((evt) => (
                        <div
                          key={evt.id}
                          className="text-[10px] leading-tight px-1 py-0.5 rounded truncate bg-primary/10 text-primary"
                          title={evt.title}
                        >
                          {evt.type === "activity" ? "📝" : "📅"} {evt.title}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <span className="text-[10px] text-muted-foreground px-1">
                          +{dayEvents.length - 3} más
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming list */}
      <div>
        <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
          <CalendarIcon className="h-4 w-4" />
          Próximos eventos y entregas
        </h4>
        {calendarEvents
          .filter((e) => new Date(e.date) >= new Date(today.toDateString()))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          .slice(0, 10)
          .map((evt) => (
            <Card key={evt.id} className="mb-2">
              <CardContent className="py-3 flex items-center gap-3">
                <div className="text-lg">
                  {evt.type === "activity" ? "📝" : evt.type === "evaluation" ? "📊" : "📅"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{evt.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(evt.date).toLocaleDateString("es-VE", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                    {evt.meta && ` • ${evt.meta}`}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {evt.type === "activity" ? "Tarea" : evt.type === "evaluation" ? "Evaluación" : "Evento"}
                </Badge>
              </CardContent>
            </Card>
          ))}
        {calendarEvents.filter((e) => new Date(e.date) >= new Date(today.toDateString())).length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No hay eventos próximos.</p>
        )}
      </div>

      {/* Evaluation plan summary */}
      {evalItems.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
            <Flag className="h-4 w-4" />
            Plan de Evaluación
          </h4>
          <div className="border rounded-lg divide-y">
            {[1, 2, 3].map((momento) => {
              const items = evalItems.filter((e: any) => e.momento === momento);
              if (items.length === 0) return null;
              const totalPct = items.reduce((s: number, e: any) => s + (e.percentage || 0), 0);
              return (
                <div key={momento} className="p-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">
                    Momento {momento} — {totalPct}%
                  </p>
                  <div className="space-y-1">
                    {items.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between text-sm">
                        <span>{item.description}</span>
                        <Badge variant="secondary" className="text-xs">{item.percentage || 0}%</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
