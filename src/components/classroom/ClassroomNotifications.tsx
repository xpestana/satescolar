import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, BookOpen, CheckCircle2, FileText, MessageSquare, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface ClassroomNotificationsProps {
  schoolId: string;
}

const ICON_MAP: Record<string, any> = {
  new_activity: FileText,
  submission_graded: CheckCircle2,
  new_comment: MessageSquare,
  due_reminder: Bell,
  new_post: BookOpen,
};

const TYPE_LABELS: Record<string, string> = {
  new_activity: "Nueva actividad",
  submission_graded: "Calificación",
  new_comment: "Comentario",
  due_reminder: "Recordatorio",
  new_post: "Publicación",
};

export function ClassroomNotifications({ schoolId }: ClassroomNotificationsProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["classroom-notifications", user?.id, schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from("classroom_notifications")
        .select("*")
        .eq("recipient_id", user!.id)
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!user?.id && !!schoolId,
  });

  const markReadMutation = useMutation({
    mutationFn: async (notifId: string) => {
      await supabase
        .from("classroom_notifications")
        .update({ is_read: true })
        .eq("id", notifId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classroom-notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await supabase
        .from("classroom_notifications")
        .update({ is_read: true })
        .eq("recipient_id", user!.id)
        .eq("school_id", schoolId)
        .eq("is_read", false);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classroom-notifications"] });
    },
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Ahora";
    if (diffMins < 60) return `Hace ${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Hace ${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return d.toLocaleDateString("es-VE", { day: "numeric", month: "short" });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notificaciones
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-xs">{unreadCount}</Badge>
            )}
          </CardTitle>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
            >
              <Check className="h-4 w-4 mr-1" />
              Marcar todas
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Cargando...</p>
        ) : notifications.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No hay notificaciones</p>
          </div>
        ) : (
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {notifications.map((notif) => {
              const Icon = ICON_MAP[notif.notification_type] || Bell;
              return (
                <div
                  key={notif.id}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    notif.is_read ? "bg-background" : "bg-primary/5"
                  } hover:bg-muted/50`}
                  onClick={() => !notif.is_read && markReadMutation.mutate(notif.id)}
                >
                  <div className={`mt-0.5 ${notif.is_read ? "text-muted-foreground" : "text-primary"}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${notif.is_read ? "text-muted-foreground" : "font-medium"}`}>
                      {notif.title}
                    </p>
                    {notif.message && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{notif.message}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">{formatTime(notif.created_at)}</span>
                      <Badge variant="outline" className="text-[10px] px-1 py-0">
                        {TYPE_LABELS[notif.notification_type] || notif.notification_type}
                      </Badge>
                    </div>
                  </div>
                  {!notif.is_read && (
                    <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
