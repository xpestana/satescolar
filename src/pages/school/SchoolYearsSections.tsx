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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { UserPlus, Info, X, Edit, Check } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface SchoolYear {
  id: string;
  school_id: string;
  year_range: string;
  is_active: boolean;
  created_at: string;
}

type GradeLevel = 
  | "pre_maternal" | "maternal"
  | "i_nivel" | "ii_nivel" | "iii_nivel"
  | "1_grado" | "2_grado" | "3_grado" | "4_grado" | "5_grado" | "6_grado"
  | "1_ano" | "2_ano" | "3_ano" | "4_ano" | "5_ano"
  | "6_ano"
  // Legacy values (kept for backward compatibility)
  | "inicial" | "primaria" | "media_general" | "media_tecnica";

interface Section {
  id: string;
  school_id: string;
  grade_level: GradeLevel;
  name: string;
}

interface GradeCategory {
  category: string;
  levels: { value: GradeLevel; label: string }[];
}

const GRADE_CATEGORIES: GradeCategory[] = [
  {
    category: "Pre-Maternal / Maternal",
    levels: [
      { value: "pre_maternal", label: "Pre-Maternal" },
      { value: "maternal", label: "Maternal" },
    ],
  },
  {
    category: "Inicial",
    levels: [
      { value: "i_nivel", label: "I Nivel" },
      { value: "ii_nivel", label: "II Nivel" },
      { value: "iii_nivel", label: "III Nivel" },
    ],
  },
  {
    category: "Primaria",
    levels: [
      { value: "1_grado", label: "1er Grado" },
      { value: "2_grado", label: "2do Grado" },
      { value: "3_grado", label: "3er Grado" },
      { value: "4_grado", label: "4to Grado" },
      { value: "5_grado", label: "5to Grado" },
      { value: "6_grado", label: "6to Grado" },
    ],
  },
  {
    category: "Media General",
    levels: [
      { value: "1_ano", label: "1er Año" },
      { value: "2_ano", label: "2do Año" },
      { value: "3_ano", label: "3er Año" },
      { value: "4_ano", label: "4to Año" },
      { value: "5_ano", label: "5to Año" },
    ],
  },
  {
    category: "Media Técnica",
    levels: [
      { value: "6_ano", label: "6to Año" },
    ],
  },
];

const ALL_GRADE_LEVELS = GRADE_CATEGORIES.flatMap(c => c.levels);

// Categories that use direct buttons (one per level)
const DIRECT_CATEGORIES = ["Pre-Maternal / Maternal"];

export default function SchoolYearsSections() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isYearModalOpen, setIsYearModalOpen] = useState(false);
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<GradeLevel | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<GradeCategory | null>(null);
  const [yearRange, setYearRange] = useState("");
  const [userSchoolId, setUserSchoolId] = useState<string | null>(null);
  
  
  // Section modal state
  const [newSectionName, setNewSectionName] = useState("");
  const [sectionsToCreate, setSectionsToCreate] = useState<string[]>([]);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionName, setEditingSectionName] = useState("");
  
  // School year editing state
  const [editingYearId, setEditingYearId] = useState<string | null>(null);
  const [editingYearRange, setEditingYearRange] = useState("");

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
      return data as Section[];
    },
    enabled: !!userSchoolId,
  });

  // Get sections for current grade
  const currentGradeSections = allSections.filter(s => s.grade_level === selectedGrade);

  // Create school year mutation
  const createYearMutation = useMutation({
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
          : "No se pudo crear el año escolar.",
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

  // Create sections mutation
  const createSectionsMutation = useMutation({
    mutationFn: async (names: string[]) => {
      if (!userSchoolId || !selectedGrade) throw new Error("No school or grade selected");
      
      const sectionsToInsert = names.map(name => ({
        school_id: userSchoolId,
        grade_level: selectedGrade,
        name: name.trim().toUpperCase(),
      }));
      
      const { error } = await supabase
        .from("sections")
        .insert(sectionsToInsert);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sections"] });
      setSectionsToCreate([]);
      toast({
        title: "Secciones creadas",
        description: "Las secciones se han creado correctamente.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message.includes("duplicate")
          ? "Una o más secciones ya existen."
          : "No se pudieron crear las secciones.",
      });
    },
  });

  // Update section mutation
  const updateSectionMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from("sections")
        .update({ name: name.trim().toUpperCase() })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sections"] });
      setEditingSectionId(null);
      setEditingSectionName("");
      toast({
        title: "Sección actualizada",
        description: "La sección se ha actualizado correctamente.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message.includes("duplicate")
          ? "Ya existe una sección con ese nombre."
          : "No se pudo actualizar la sección.",
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

  const openSectionModalDirect = (grade: GradeLevel) => {
    setSelectedGrade(grade);
    setSelectedCategory(null);
    setSectionsToCreate([]);
    setNewSectionName("");
    setEditingSectionId(null);
    setEditingSectionName("");
    setIsSectionModalOpen(true);
  };

  const openSectionModalCategory = (cat: GradeCategory) => {
    setSelectedCategory(cat);
    setSelectedGrade(cat.levels[0]?.value || null);
    setSectionsToCreate([]);
    setNewSectionName("");
    setEditingSectionId(null);
    setEditingSectionName("");
    setIsSectionModalOpen(true);
  };

  const closeSectionModal = () => {
    setIsSectionModalOpen(false);
    setSelectedGrade(null);
    setSelectedCategory(null);
    setSectionsToCreate([]);
    setNewSectionName("");
    setEditingSectionId(null);
    setEditingSectionName("");
  };


  const addSectionToCreate = () => {
    if (!newSectionName.trim()) return;
    
    const normalized = newSectionName.trim().toUpperCase();
    
    // Validate: must be a single letter A-Z
    if (!/^[A-Z]$/.test(normalized)) {
      toast({
        variant: "destructive",
        title: "Formato inválido",
        description: "La sección debe ser una sola letra (A-Z).",
      });
      return;
    }
    
    if (sectionsToCreate.includes(normalized)) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Ya agregaste esta sección.",
      });
      return;
    }
    if (currentGradeSections.some(s => s.name === normalized)) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Esta sección ya existe.",
      });
      return;
    }
    
    setSectionsToCreate([...sectionsToCreate, normalized]);
    setNewSectionName("");
  };

  const removeSectionToCreate = (name: string) => {
    setSectionsToCreate(sectionsToCreate.filter(s => s !== name));
  };

  const handleSaveSections = () => {
    if (sectionsToCreate.length > 0) {
      createSectionsMutation.mutate(sectionsToCreate);
    }
  };

  const startEditingSection = (section: Section) => {
    setEditingSectionId(section.id);
    setEditingSectionName(section.name);
  };

  const cancelEditingSection = () => {
    setEditingSectionId(null);
    setEditingSectionName("");
  };

  const saveEditingSection = () => {
    if (!editingSectionId || !editingSectionName.trim()) return;
    updateSectionMutation.mutate({ id: editingSectionId, name: editingSectionName });
  };

  const getGradeLabel = (grade: GradeLevel) => {
    return ALL_GRADE_LEVELS.find(g => g.value === grade)?.label || grade;
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
                        onClick={() => openSectionModalDirect(grade.value)}
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
                    onClick={() => openSectionModalCategory(cat)}
                  >
                    Agregar Secciones en {cat.category}
                  </Button>
                  {categorySections.length > 0 && (
                    <div className="flex flex-wrap gap-1 px-2">
                      {categorySections.map(s => (
                        <Badge key={s.id} variant="secondary" className="text-xs" title={getGradeLabel(s.grade_level)}>
                          {getGradeLabel(s.grade_level)} - {s.name}
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

      {/* Sections Modal */}
      <Dialog open={isSectionModalOpen} onOpenChange={(open) => !open && closeSectionModal()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="bg-primary -m-6 mb-4 p-6 rounded-t-lg">
            <DialogTitle className="text-white text-xl">
              {editingSectionId ? "Modificar sección" : selectedCategory ? `Agregar Secciones en ${selectedCategory.category}` : "Agregar sección"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            {/* Grade selector for categories, static label for direct */}
            {selectedCategory ? (
              <div className="flex items-center gap-4">
                <Label className="font-medium w-20">Nivel:</Label>
                <Select
                  value={selectedGrade || ""}
                  onValueChange={(val) => {
                    setSelectedGrade(val as GradeLevel);
                    setSectionsToCreate([]);
                    setEditingSectionId(null);
                    setEditingSectionName("");
                  }}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedCategory.levels.map(l => (
                      <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <Label className="font-medium w-20">Grado:</Label>
                <span className="text-muted-foreground">
                  {selectedGrade && getGradeLabel(selectedGrade)}
                </span>
              </div>
            )}
            
            {editingSectionId ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Label className="font-medium w-20">Sección:</Label>
                  <Input
                    value={editingSectionName}
                    onChange={(e) => {
                      const value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
                      setEditingSectionName(value);
                    }}
                    maxLength={1}
                    className="h-9 text-center uppercase w-16"
                    autoFocus
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={cancelEditingSection}>
                    Cancelar
                  </Button>
                  <Button 
                    type="button"
                    onClick={saveEditingSection}
                    disabled={updateSectionMutation.isPending || !editingSectionName.trim()}
                  >
                    {updateSectionMutation.isPending ? "Guardando..." : "Guardar"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Label className="font-medium w-20">Sección:</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Ej: A"
                      value={newSectionName}
                      onChange={(e) => {
                        const value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
                        setNewSectionName(value);
                      }}
                      maxLength={1}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSectionToCreate())}
                      className="h-9 text-center uppercase w-16"
                      autoFocus
                    />
                    <Button 
                      type="button" size="sm" 
                      onClick={addSectionToCreate}
                      disabled={!newSectionName.trim()}
                      className="h-9"
                    >
                      +
                    </Button>
                  </div>
                </div>
                
                {sectionsToCreate.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Secciones a crear:</Label>
                    <div className="flex flex-wrap gap-1">
                      {sectionsToCreate.map(name => (
                        <Badge key={name} variant="default" className="gap-1">
                          {name}
                          <button type="button" onClick={() => removeSectionToCreate(name)} className="ml-1 hover:text-destructive">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {currentGradeSections.length > 0 && (
                  <div className="space-y-2 pt-2 border-t">
                    <Label className="text-sm text-muted-foreground">
                      Secciones existentes (clic para editar):
                    </Label>
                    <div className="flex flex-wrap gap-1">
                      {currentGradeSections.map(s => (
                        <Badge 
                          key={s.id} variant="secondary"
                          className="cursor-pointer hover:bg-secondary/80"
                          onClick={() => startEditingSection(s)}
                        >
                          {s.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {!editingSectionId && (
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={closeSectionModal}>
                Cancelar
              </Button>
              {sectionsToCreate.length > 0 && (
                <Button
                  type="button"
                  onClick={handleSaveSections}
                  disabled={createSectionsMutation.isPending}
                >
                  {createSectionsMutation.isPending ? "Guardando..." : "Guardar secciones"}
                </Button>
              )}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

    </DashboardLayout>
  );
}
