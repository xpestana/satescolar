import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AbsenceConfirmDialogProps {
  studentName: string;
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function AbsenceConfirmDialog({
  studentName,
  open,
  onConfirm,
  onCancel,
}: AbsenceConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Confirmas la inasistencia?</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Estás seguro de que <strong>{studentName}</strong> no estuvo en clase hoy?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Sí, estuvo ausente
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
