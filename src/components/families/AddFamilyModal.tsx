import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AddFamilyModalProps {
  open: boolean;
  onClose: () => void;
  schoolId: string;
}

export function AddFamilyModal({ open, onClose, schoolId }: AddFamilyModalProps) {
  const [email, setEmail] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createFamilyMutation = useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await supabase.functions.invoke("create-family", {
        body: { email },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["families"] });
      toast({
        title: "Familia creada",
        description: data.message,
      });
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "No se pudo crear la familia",
      });
    },
  });

  const handleClose = () => {
    setEmail("");
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "El correo electrónico es requerido",
      });
      return;
    }
    createFamilyMutation.mutate(email.trim());
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="bg-primary -m-6 mb-0 p-6 rounded-t-lg">
          <DialogTitle className="text-primary-foreground">Agregar Familia</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              placeholder="Correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={createFamilyMutation.isPending}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={createFamilyMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="ghost"
              disabled={createFamilyMutation.isPending}
              className="text-primary hover:text-primary"
            >
              {createFamilyMutation.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
