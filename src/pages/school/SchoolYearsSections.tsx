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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { UserPlus, Info, X, Edit, Check } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { SectionsModal, type SectionsModalTarget } from "@/components/sections/SectionsModal";
import {
  DIRECT_CATEGORIES,
  GRADE_CATEGORIES,
  categoryGradeLabel,
  type GradeLevel,
  type SchoolSection,
} from "@/components/sections/sectionCategories";
import { sectionDisplayName } from "@/lib/gradeLevels";

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
  const [isYearModalOpen, setIsYearModalOpen] = useState(false);
  const [sectionsModalTarget, setSectionsModalTarget] = useState<SectionsModalTarget | null>(null);
  const [yearRange, setYearRange] = useState("");

  // School year editing state
  const [editingYearId, setEditingYearId] = useState<string | null>(null);
  const [editingYearRange, setEditingYearRange] = useState("");

  // Colegio del usuario. Antes había aquí una consulta propia con la misma clave
  // ["user-school-id"] que useSchoolId (montado siempre por el layout) pero con otra forma de
  // datos, y el id solo se guardaba si SU queryFn corría: si React Query reusaba la consulta del
  // layout, el id quedaba en null y crear el año fallaba con "No se pudo crear el año escolar".
  const { schoolId, isLoading: schoolIdLoading } = useSchoolId();
  const userSchoolId = schoolId ?? null;

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

  // Fetch all sections
  const { data: allSections = [] } = useQuery({
    queryKey: ["sections", userSchoolId],
    queryFn: async () => {
      if (!userSchoolId) return [];
      const { data, error } = await supabase
        .from("sections")
        .select("*")
        .eq("school_id", userSchoolId)
        .order("name", { ascending: true });
      
      if (error) throw error;
      return data as SchoolSection[];
    },
    enabled: !!userSchoolId,
  });

  // Create school year mutation
  const createYearMutation = useMutation({
    mutationFn: async (yearRange: string) => {
      if (!userSchoolId) {
        throw new Error(
          schoolIdLoading
            ? "Todavía se está cargando el colegio. Intente de nuevo en unos segundos."
            : "No se encontró el colegio de su usuario. Recargue la página e intente de nuevo."
        );
      }

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
      setIsYearModalOpen(false);
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
          : `No se pudo crear el año escolar: ${error.message}`,
      });
    },
  });

  // Update school year mutation
  const updateYearMutation = useMutation({
    mutationFn: async ({ id, yearRange }: { id: string; yearRange: string }) => {
      const { error } = await supabase
        .from("school_years")
        .update({ year_range: yearRange })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school-years"] });
      setEditingYearId(null);
      setEditingYearRange("");
      toast({
        title: "Año escolar actualizado",
        description: "El año escolar se ha actualizado correctamente.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message.includes("duplicate")
          ? "Este año escolar ya existe."
          : "No se pudo actualizar el año escolar.",
      });
    },
  });

  // Toggle active school year mutation
  const toggleActiveYearMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      if (!userSchoolId) throw new Error("No school assigned");
      
      if (isActive) {
        // First, deactivate all other years for this school
        const { error: deactivateError } = await supabase
          .from("school_years")
          .update({ is_active: false })
          .eq("school_id", userSchoolId);
        
        if (deactivateError) throw deactivateError;
      }
      
      // Then, set the selected year's active status
      const { error } = await supabase
        .from("school_years")
        .update({ is_active: isActive })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["school-years"] });
      toast({
        title: variables.isActive ? "Año escolar activado" : "Año escolar desactivado",
        description: variables.isActive 
          ? "Este año escolar es ahora el activo." 
          : "El año escolar ha sido desactivado.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo cambiar el estado del año escolar.",
      });
    },
  });

  // Delete section removed - sections cannot be deleted

  const handleYearSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const regex = /^\d{4}\s*-\s*\d{4}$/;
    if (!regex.test(yearRange.trim())) {
      toast({
        variant: "destructive",
        title: "Formato inválido",
        description: "El formato debe ser YYYY-YYYY (ej: 2025-2026)",
      });
      return;
    }
    
    const normalized = yearRange.replace(/\s/g, "").replace("-", " - ");
    createYearMutation.mutate(normalized);
  };

  const getSectionsForGrade = (grade: GradeLevel) => {
    return allSections.filter(s => s.grade_level === grade);
  };

  const breadcrumbs = [
    { label: "Dashboard", href: "/school/dashboard" },
    { label: "Configuraciones - Años Escolares y Secciones del Colegio" },
  ];

  return (
    <DashboardLayout>
      <PageHeader title="Configuraciones" breadcrumbs={breadcrumbs} />

      {/* School Years Section */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <Button onClick={() => setIsYearModalOpen(true)} className="gap-2">
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
                <TableHead className="text-center">Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : schoolYears.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    No hay datos disponibles.
                  </TableCell>
                </TableRow>
              ) : (
                schoolYears.map((year) => (
                  <TableRow key={year.id}>
                    <TableCell className="font-medium">
                      {editingYearId === year.id ? (
                        <Input
                          value={editingYearRange}
                          onChange={(e) => setEditingYearRange(e.target.value)}
                          placeholder="Ej: 2025-2026"
                          className="w-40"
                        />
                      ) : (
                        year.year_range
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Switch
                          checked={year.is_active}
                          onCheckedChange={(checked) => 
                            toggleActiveYearMutation.mutate({ id: year.id, isActive: checked })
                          }
                          disabled={toggleActiveYearMutation.isPending}
                        />
                        <Badge variant={year.is_active ? "default" : "secondary"}>
                          {year.is_active ? "Activo" : "Inactivo"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {editingYearId === year.id ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const regex = /^\d{4}\s*-\s*\d{4}$/;
                              if (!regex.test(editingYearRange.trim())) {
                                toast({
                                  variant: "destructive",
                                  title: "Formato inválido",
                                  description: "El formato debe ser YYYY-YYYY (ej: 2025-2026)",
                                });
                                return;
                              }
                              const normalized = editingYearRange.replace(/\s/g, "").replace("-", " - ");
                              updateYearMutation.mutate({ id: year.id, yearRange: normalized });
                            }}
                            disabled={updateYearMutation.isPending}
                          >
                            <Check className="h-4 w-4 text-primary" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingYearId(null);
                              setEditingYearRange("");
                            }}
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingYearId(year.id);
                            setEditingYearRange(year.year_range);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {GRADE_CATEGORIES.map((cat) => {
              const isDirect = DIRECT_CATEGORIES.includes(cat.category);
              
              if (isDirect) {
                return cat.levels.map((grade) => {
                  const sections = getSectionsForGrade(grade.value);
                  return (
                    <div key={grade.value} className="space-y-2">
                      <Button
                        variant="outline"
                        className="w-full h-auto py-3 justify-center border-primary text-primary hover:bg-primary/10"
                        onClick={() => setSectionsModalTarget({ kind: "grade", grade: grade.value })}
                      >
                        Agregar Sección En {grade.label}
                      </Button>
                      {sections.length > 0 && (
                        <div className="flex flex-wrap gap-1 px-2">
                          {sections.map(s => (
                            <Badge key={s.id} variant="secondary" className="text-xs">
                              {s.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                });
              }

              const categorySections = cat.levels.flatMap(l => getSectionsForGrade(l.value));
              return (
                <div key={cat.category} className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full h-auto py-3 justify-center border-primary text-primary hover:bg-primary/10"
                    onClick={() => setSectionsModalTarget({ kind: "category", category: cat })}
                  >
                    Agregar Secciones en {cat.category}
                  </Button>
                  {categorySections.length > 0 && (
                    <div className="flex flex-wrap gap-1 px-2">
                      {categorySections.map(s => (
                        <Badge key={s.id} variant="secondary" className="text-xs" title={categoryGradeLabel(s.grade_level)}>
                          {categoryGradeLabel(s.grade_level)} - {sectionDisplayName(s)}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Create Year Modal */}
      <Dialog open={isYearModalOpen} onOpenChange={setIsYearModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="bg-primary -m-6 mb-4 p-6 rounded-t-lg">
            <DialogTitle className="text-white text-xl">Nuevo Año Escolar</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleYearSubmit}>
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
                onClick={() => setIsYearModalOpen(false)}
                disabled={createYearMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="ghost"
                className="text-primary hover:text-primary"
                disabled={createYearMutation.isPending}
              >
                {createYearMutation.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <SectionsModal
        target={sectionsModalTarget}
        onClose={() => setSectionsModalTarget(null)}
        schoolId={userSchoolId}
        sections={allSections}
      />
    </DashboardLayout>
  );
}
