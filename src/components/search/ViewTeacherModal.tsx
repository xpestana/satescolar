import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Edit } from "lucide-react";

interface ViewTeacherModalProps {
  open: boolean;
  onClose: () => void;
  record: any;
  columns: { key: string; label: string; isFormData: boolean }[];
  getTextValue: (record: any, col: any) => string;
}

export function ViewTeacherModal({
  open,
  onClose,
  record,
  columns,
  getTextValue,
}: ViewTeacherModalProps) {
  if (!record) return null;

  const handleEdit = () => {
    onClose();
    window.location.href = `/registros/docentes/${record.id}/editar`;
  };

  const displayColumns = columns.filter((c) => c.key !== "photo_url");

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="bg-primary -m-6 mb-0 p-6 rounded-t-lg">
          <DialogTitle className="text-primary-foreground">
            Datos del Docente
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={record.photo_url || ""} />
              <AvatarFallback className="text-lg">
                {(record.document_id || "?").charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-lg font-semibold">
                {getTextValue(record, { key: "primer_nombre", label: "", isFormData: true })}{" "}
                {getTextValue(record, { key: "primer_apellido", label: "", isFormData: true })}
              </p>
              <p className="text-sm text-muted-foreground">
                {record.document_id || "Sin documento"}
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
              Datos del Docente
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {displayColumns.map((col) => {
                const value = getTextValue(record, col);
                return (
                  <div key={col.key} className="p-2 rounded bg-muted/30">
                    <p className="text-xs text-muted-foreground">{col.label}</p>
                    <p className="text-sm">{value || "—"}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
          <Button onClick={handleEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Editar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
