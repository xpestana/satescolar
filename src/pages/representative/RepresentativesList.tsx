import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { UserPlus, Edit, Trash2, Download, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRepresentativeFamily } from "@/hooks/useRepresentativeFamily";
import { useToast } from "@/hooks/use-toast";
import { downloadCarnet } from "@/lib/export-utils";
import { useState } from "react";

export default function RepresentativesList() {
  const navigate = useNavigate();
  const { familyId, school } = useRepresentativeFamily();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const { data: representatives = [] } = useQuery({
    queryKey: ["representatives", familyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("representatives").select("*").eq("family_id", familyId).order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!familyId,
  });

  const { data: schoolYear } = useQuery({
    queryKey: ["active-school-year", school?.id],
    queryFn: async () => {
      const { data } = await supabase.from("school_years").select("year_range").eq("school_id", school!.id).eq("is_active", true).single();
      return data?.year_range || "2024-2025";
    },
    enabled: !!school?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("representatives").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["representatives", familyId] });
      toast({ title: "Eliminado", description: "Representante eliminado exitosamente" });
      setDeleteTarget(null);
    },
    onError: () => { toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar" }); },
  });

  const getName = (rep: any) => {
    const fd = rep.form_data as Record<string, any> || {};
    return `${fd.primer_nombre || ""} ${fd.segundo_nombre || ""} ${fd.primer_apellido || ""} ${fd.segundo_apellido || ""}`.replace(/\s+/g, " ").trim() || "Sin nombre";
  };

  const getType = (rep: any) => (rep.form_data as Record<string, any>)?.parentesco || "Representante";

  const handleCarnet = async (rep: any) => {
    await downloadCarnet({
      personName: getName(rep),
      documentId: rep.document_id || "Sin documento",
      role: "REPRESENTANTE",
      photoUrl: rep.photo_url || undefined,
      schoolName: school?.name || "Institución",
      schoolLocation: school?.address || "",
      schoolLogoUrl: school?.logo_url || undefined,
      schoolYear: schoolYear || "2024-2025",
    });
  };

  return (
    <DashboardLayout>
      <PageHeader title="Mis Representantes" breadcrumbs={[{ label: "Dashboard", href: "/representative/dashboard" }, { label: "Representantes" }]} />
      <div className="bg-card rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Representantes</h2>
          <Button onClick={() => navigate("/representative/representante/nuevo")}>
            <UserPlus className="h-4 w-4 mr-2" /> Agregar Representante
          </Button>
        </div>
        {representatives.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay representantes registrados</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {representatives.map((rep) => (
              <Card key={rep.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4 mb-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={rep.photo_url || ""} />
                      <AvatarFallback className="bg-primary/10 text-primary text-lg">{getName(rep).charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{getName(rep)}</p>
                      <p className="text-sm text-muted-foreground">{getType(rep)}</p>
                      <Badge variant="secondary" className="mt-1">{rep.document_id || "Sin doc."}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => navigate(`/representative/representante/${rep.id}/editar`)}>
                      <Edit className="h-3 w-3 mr-1" /> Editar
                    </Button>
                    {representatives.length > 1 && (
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => setDeleteTarget({ id: rep.id, name: getName(rep) })}>
                        <Trash2 className="h-3 w-3 mr-1" /> Eliminar
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => handleCarnet(rep)}>
                      <Download className="h-3 w-3 mr-1" /> Carnet
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar representante?</AlertDialogTitle>
            <AlertDialogDescription>Estás a punto de eliminar a <strong>{deleteTarget?.name}</strong>. Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
