import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Edit } from "lucide-react";

interface ViewRecordModalProps {
  open: boolean;
  onClose: () => void;
  record: any;
  formType: "student" | "representative";
  columns: { key: string; label: string; isFormData: boolean }[];
  getTextValue: (record: any, col: any) => string;
}

export function ViewRecordModal({
  open,
  onClose,
  record,
  formType,
  columns,
  getTextValue,
}: ViewRecordModalProps) {
  if (!record) return null;

  const family = record.families as any;
  const familyName = [family?.father_last_name, family?.mother_last_name]
    .filter(Boolean)
    .join(" ") || "Sin definir";

  const handleEdit = () => {
    onClose();
    const familyId = record.family_id;
    if (formType === "student") {
      window.location.href = `/registros/familias/${familyId}/estudiante/${record.id}/editar`;
    } else {
      window.location.href = `/registros/familias/${familyId}/representante/${record.id}/editar`;
    }
  };

  const displayColumns = columns.filter((c) => c.key !== "photo_url" && c.key !== "family_name");

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="bg-primary -m-6 mb-0 p-6 rounded-t-lg">
          <DialogTitle className="text-primary-foreground">
            {formType === "student" ? "Datos del Estudiante" : "Datos del Representante"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Photo + Name */}
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

          {/* Family Info */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
              Datos de Familia
            </h3>
            <div className="grid grid-cols-2 gap-3 p-3 rounded-md bg-muted/50">
              <div>
                <p className="text-xs text-muted-foreground">Familia</p>
                <p className="text-sm font-medium">{familyName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Estado</p>
                <Badge
                  variant={family?.is_suspended ? "destructive" : "outline"}
                  className={family?.is_suspended ? "" : "border-cyan-500 text-cyan-600"}
                >
                  {family?.is_suspended ? "Suspendido" : "Activo"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Record fields */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
              {formType === "student" ? "Datos del Estudiante" : "Datos del Representante"}
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
