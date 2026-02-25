import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/data-pagination";
import {
  History,
  CheckCircle,
  XCircle,
  ChevronRight,
  Users,
  Clock,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface EmailHistoryRecord {
  id: string;
  recipients: { email: string; name: string; type: string }[];
  subject: string;
  body_html: string;
  status: string;
  error_message: string | null;
  recipient_count: number;
  created_at: string;
}

const PAGE_SIZE = 10;

export function EmailHistory() {
  const { schoolId } = useSchoolId();
  const [page, setPage] = useState(1);
  const [selectedEmail, setSelectedEmail] = useState<EmailHistoryRecord | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["email-history", schoolId, page],
    queryFn: async () => {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error, count } = await supabase
        .from("email_history")
        .select("*", { count: "exact" })
        .eq("school_id", schoolId!)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      return { records: (data || []) as unknown as EmailHistoryRecord[], total: count || 0 };
    },
    enabled: !!schoolId,
  });

  const records = data?.records || [];
  const totalCount = data?.total || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  if (isLoading && records.length === 0) {
    return (
      <Card className="border shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <History className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold text-lg">Historial de Correos</h3>
          </div>
          <p className="text-sm text-muted-foreground">Cargando historial...</p>
        </CardContent>
      </Card>
    );
  }

  if (records.length === 0 && page === 1) {
    return (
      <Card className="border shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <History className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold text-lg">Historial de Correos</h3>
          </div>
          <p className="text-sm text-muted-foreground">Aún no se han enviado correos electrónicos.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <History className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold text-lg">Historial de Correos</h3>
            <Badge variant="secondary" className="ml-auto">{totalCount} correo(s)</Badge>
          </div>

          <div className="space-y-2">
            {records.map((record) => (
              <button
                key={record.id}
                onClick={() => setSelectedEmail(record)}
                className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
              >
                {record.status === "success" ? (
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{record.subject}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {record.recipient_count} destinatario(s)
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(record.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </button>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-4">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                totalItems={totalCount}
                itemsPerPage={PAGE_SIZE}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog open={!!selectedEmail} onOpenChange={() => setSelectedEmail(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedEmail?.status === "success" ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
              Detalle del Correo
            </DialogTitle>
          </DialogHeader>

          {selectedEmail && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Estado</p>
                <Badge variant={selectedEmail.status === "success" ? "default" : "destructive"}>
                  {selectedEmail.status === "success" ? "Enviado exitosamente" : "Error al enviar"}
                </Badge>
                {selectedEmail.error_message && (
                  <p className="text-sm text-destructive mt-1">{selectedEmail.error_message}</p>
                )}
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Fecha</p>
                <p className="text-sm">
                  {format(new Date(selectedEmail.created_at), "EEEE dd 'de' MMMM yyyy, HH:mm", { locale: es })}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Asunto</p>
                <p className="text-sm font-medium">{selectedEmail.subject}</p>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Destinatarios ({selectedEmail.recipient_count})
                </p>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {(selectedEmail.recipients as any[]).map((r: any, i: number) => (
                    <span
                      key={i}
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs border bg-muted/50"
                    >
                      {r.name !== r.email ? `${r.name} (${r.email})` : r.email}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Vista previa</p>
                <div className="border rounded-lg overflow-hidden">
                  <iframe
                    srcDoc={selectedEmail.body_html}
                    title="Email preview"
                    className="w-full border-0"
                    style={{ height: "400px", background: "#f0f2f5" }}
                    sandbox=""
                  />
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
