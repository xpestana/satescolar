import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DeleteRepresentativeDialogProps {
  open: boolean;
  onClose: () => void;
  representativeId: string;
  representativeName: string;
  familyId: string;
}

export function DeleteRepresentativeDialog({
  open,
  onClose,
  representativeId,
  representativeName,
  familyId,
}: DeleteRepresentativeDialogProps) {
  const [confirmName, setConfirmName] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("representatives")
        .delete()
        .eq("id", representativeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["representatives", familyId] });
      toast({
        title: "Representante eliminado",
        description: "El representante ha sido eliminado correctamente",
      });
      handleClose();
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo eliminar el representante",
      });
    },
  });

  const handleClose = () => {
    setConfirmName("");
    onClose();
  };

  const handleDelete = () => {
    if (confirmName.toLowerCase() !== representativeName.toLowerCase()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "El nombre ingresado no coincide con el representante",
      });
      return;
    }
    deleteMutation.mutate();
  };

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar representante?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción no se puede deshacer. Se eliminará permanentemente el representante
            <strong> {representativeName}</strong> de la familia.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-4">
          <Label htmlFor="confirmName">
            Para confirmar, escriba el nombre del representante:
          </Label>
          <Input
            id="confirmName"
            placeholder={representativeName}
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
          />
        </div>

        <AlertDialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteMutation.isPending || confirmName.toLowerCase() !== representativeName.toLowerCase()}
          >
            {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
