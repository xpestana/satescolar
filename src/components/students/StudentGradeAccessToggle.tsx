import { useState } from "react";
import { Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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

/**
 * Blocks / unblocks the representative's access to the grades and boleta of one student.
 *
 * Presentational on purpose: the caller owns the data (see `useStudentGradeBlock`) so a list can
 * resolve every student with a single query instead of one per row. Rendered from the family
 * sheet, from Búsqueda Avanzada and from the visibility tab of Notas y Boletas.
 */

interface StudentGradeAccessToggleProps {
  studentName: string;
  isBlocked: boolean;
  onToggle: (blocked: boolean) => void;
  disabled?: boolean;
  variant?: "icon" | "switch";
}

const BLOCK_TITLE = "Bloquear notas y boletas";
const UNBLOCK_TITLE = "Permitir notas y boletas";

export default function StudentGradeAccessToggle({
  studentName,
  isBlocked,
  onToggle,
  disabled = false,
  variant = "icon",
}: StudentGradeAccessToggleProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const request = (nextBlocked: boolean) => {
    // Only blocking needs a confirmation; restoring access is harmless.
    if (nextBlocked) setConfirmOpen(true);
    else onToggle(false);
  };

  const label = isBlocked ? UNBLOCK_TITLE : BLOCK_TITLE;

  return (
    <>
      {variant === "switch" ? (
        <div className="flex items-center gap-2">
          <Switch
            checked={!isBlocked}
            disabled={disabled}
            onCheckedChange={(checked) => request(!checked)}
            aria-label={label}
          />
          <span className="text-xs text-muted-foreground">
            {isBlocked ? "Bloqueado" : "Permitido"}
          </span>
        </div>
      ) : (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`h-8 w-8 ${isBlocked ? "text-destructive" : ""}`}
                disabled={disabled}
                onClick={() => request(!isBlocked)}
                aria-label={label}
              >
                {isBlocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Bloquear el acceso de {studentName}?</AlertDialogTitle>
            <AlertDialogDescription>
              El representante dejará de ver las notas y no podrá descargar la boleta de este
              estudiante, en todos los años escolares y momentos, hasta que usted lo desbloquee.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onToggle(true);
                setConfirmOpen(false);
              }}
            >
              Bloquear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
