import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { UserPlus, Trash2, Info } from "lucide-react";

interface SchoolYear {
  id: string;
  school_id: string;
  year_range: string;
  is_active: boolean;
  created_at: string;
}

export default function SchoolYearsSections() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [yearRange, setYearRange] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [userSchoolId, setUserSchoolId] = useState<string | null>(null);

  // Get user's school_id
  const { data: userRole } = useQuery({
    queryKey: ["user-school-id", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("user_roles")
        .select("school_id")
        .eq("user_id", user.id)
        .single();
      
      if (error) throw error;
      setUserSchoolId(data.school_id);
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch school years
  const { data: schoolYears = [], isLoading } = useQuery({
    queryKey: ["school-years", userSchoolId],
    queryFn: async () => {
      if (!userSchoolId) return [];
      const { data, error } = await supabase
        .from("school_years")
        .select("*")
        .eq("school_id", userSchoolId)
        .order("year_range", { ascending: false });
      
      if (error) throw error;
      return data as SchoolYear[];
    },
    enabled: !!userSchoolId,
  });

  // Create school year mutation
  const createMutation = useMutation({
    mutationFn: async (yearRange: string) => {
      if (!userSchoolId) throw new Error("No school assigned");
      
      const { error } = await supabase
        .from("school_years")
        .insert({
          school_id: userSchoolId,
          year_range: yearRange.trim(),
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school-years"] });
      setIsModalOpen(false);
      setYearRange("");
      toast({
        title: "Año escolar creado",
        description: "El año escolar se ha registrado correctamente.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message.includes("duplicate")
          ? "Este año escolar ya existe."
          : "No se pudo crear el año escolar.",
      });
    },
  });

  // Delete school year mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("school_years")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school-years"] });
      setDeleteId(null);
      toast({
        title: "Año escolar eliminado",
        description: "El año escolar se ha eliminado correctamente.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo eliminar el año escolar.",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate format: YYYY-YYYY or YYYY - YYYY
    const regex = /^\d{4}\s*-\s*\d{4}$/;
    if (!regex.test(yearRange.trim())) {
      toast({
        variant: "destructive",
        title: "Formato inválido",
        description: "El formato debe ser YYYY-YYYY (ej: 2025-2026)",
      });
      return;
    }
    
    // Normalize format
    const normalized = yearRange.replace(/\s/g, "").replace("-", " - ");
    createMutation.mutate(normalized);
  };

  const breadcrumbs = [
    { label: "Dashboard", href: "/school/dashboard" },
    { label: "Configuraciones - Años Escolares y Secciones del Colegio" },
  ];

  const sectionTypes = [
    "Pre-Maternal",
    "Maternal",
    "Inicial",
    "Primaria",
    "Media General",
    "Media Técnica",
  ];

  return (
    <DashboardLayout>
      <PageHeader title="Configuraciones" breadcrumbs={breadcrumbs} />

      {/* School Years Section */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <Button onClick={() => setIsModalOpen(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Agregar Año Escolar
          </Button>
          <CardTitle className="text-lg font-semibold">
            Configuraciones - Años Escolares y Secciones del Colegio
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Info banner */}
          <div className="flex items-start gap-3 mb-6 p-4 bg-muted/50 rounded-lg">
            <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
            <p className="text-sm text-muted-foreground">
              📅 Desde aquí puedes crear los años escolares y organizar las secciones 🏫 que usará el colegio durante todo el uso del sistema.
              Además, podrás cambiar el año escolar actual 📆 siempre que lo necesites, de forma fácil y rápida. 😊
            </p>
          </div>

          {/* Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Año Escolar</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : schoolYears.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">
                    No hay datos disponibles.
                  </TableCell>
                </TableRow>
              ) : (
                schoolYears.map((year) => (
                  <TableRow key={year.id}>
                    <TableCell className="font-medium">{year.year_range}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(year.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Sections Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Secciones del Colegio</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sectionTypes.map((section) => (
              <Button
                key={section}
                variant="outline"
                className="h-auto py-3 justify-center border-primary text-primary hover:bg-primary/10"
              >
                Agregar Sección En {section}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Create Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="bg-primary -m-6 mb-4 p-6 rounded-t-lg">
            <DialogTitle className="text-white text-xl">Nuevo Año Escolar</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Input
                  id="year_range"
                  placeholder="2027 - 2026"
                  value={yearRange}
                  onChange={(e) => setYearRange(e.target.value)}
                  className="text-base"
                />
                <Label htmlFor="year_range" className="text-sm text-muted-foreground">
                  Año escolar - Por favor, ingresa solo el rango de años (por ejemplo: 2026 - 2027)
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsModalOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="ghost"
                className="text-primary hover:text-primary"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar año escolar?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente este año escolar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
