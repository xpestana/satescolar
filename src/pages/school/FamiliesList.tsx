import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MetricCard } from "@/components/dashboard/MetricCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/components/ui/data-pagination";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Eye, Users, UserPlus, Info, Trash2, GraduationCap, UserCheck, KeyRound, Search, ChevronDown, X, UsersRound } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useToast } from "@/hooks/use-toast";
import { AddFamilyModal } from "@/components/families/AddFamilyModal";
import { ViewFamilyModal } from "@/components/families/ViewFamilyModal";
import { ChangePasswordModal } from "@/components/families/ChangePasswordModal";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface FamilyWithEmail {
  id: string;
  user_id: string;
  father_last_name: string | null;
  mother_last_name: string | null;
  contact_phone: string | null;
  address: string | null;
  is_suspended: boolean;
  email?: string;
  hasMembers?: boolean;
  representativeNames?: string[];
  studentNames?: string[];
  repsCount: number;
  studentsCount: number;
}

interface SearchFilters {
  name: string;
  email: string;
  status: "all" | "active" | "suspended";
}

const ITEMS_PER_PAGE = 10;

export default function FamiliesList() {
  const { schoolId, isLoading: schoolLoading } = useSchoolId();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const [currentPage, setCurrentPage] = useState(1);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [familyToDelete, setFamilyToDelete] = useState<FamilyWithEmail | null>(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordFamily, setPasswordFamily] = useState<FamilyWithEmail | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({ name: "", email: "", status: "all" });

  // Global counters - independent of search/pagination
  const { data: globalCounts } = useQuery({
    queryKey: ["families-global-counts", schoolId],
    queryFn: async () => {
      if (!schoolId) return { families: 0, representatives: 0, students: 0 };

      // Get all family IDs for this school
      const { data: familySchools } = await supabase
        .from("family_schools")
        .select("family_id")
        .eq("school_id", schoolId);

      const allFamilyIds = (familySchools || []).map((fs) => fs.family_id);
      if (allFamilyIds.length === 0) return { families: 0, representatives: 0, students: 0 };

      // Get families and filter to only those with representative role
      const { data: familiesData } = await supabase
        .from("families")
        .select("id, user_id")
        .in("id", allFamilyIds);

      if (!familiesData || familiesData.length === 0) return { families: 0, representatives: 0, students: 0 };

      const famUserIds = familiesData.map((f) => f.user_id);
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "representative")
        .in("user_id", famUserIds);

      const repUserIds = new Set((rolesData || []).map((r) => r.user_id));
      const familyIds = familiesData.filter((f) => repUserIds.has(f.user_id)).map((f) => f.id);
      if (familyIds.length === 0) return { families: 0, representatives: 0, students: 0 };

      // Count reps and students in parallel (students via student_schools for school isolation)
      const [{ count: repsCount }, { count: studentsCount }] = await Promise.all([
        supabase.from("representatives").select("id", { count: "exact", head: true }).in("family_id", familyIds),
        supabase.from("student_schools").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
      ]);

      return {
        families: familyIds.length,
        representatives: repsCount || 0,
        students: studentsCount || 0,
      };
    },
    enabled: !!schoolId,
  });

  // Fetch families
  const { data: familiesData, isLoading } = useQuery({
    queryKey: ["families", schoolId, currentPage],
    queryFn: async () => {
      if (!schoolId) return { families: [], count: 0 };

      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const { data, error, count } = await supabase
        .from("families")
        .select("id, user_id, father_last_name, mother_last_name, contact_phone, address, is_suspended, family_schools!inner(school_id)", { count: "exact" })
        .eq("family_schools.school_id", schoolId)
        .range(from, to)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return { families: [], count: 0 };

      const userIds = data.map((f) => f.user_id);
      const familyIds = data.map((f) => f.id);

      const [rolesRes, emailsRes, repsRes, studentsRes] = await Promise.all([
        supabase.from("user_roles").select("user_id").eq("role", "representative").in("user_id", userIds),
        supabase.functions.invoke("get-user-emails", { body: { userIds } }),
        supabase.from("representatives").select("family_id, form_data").in("family_id", familyIds),
        supabase.from("students").select("family_id, form_data").in("family_id", familyIds),
      ]);

      const repUserIds = new Set((rolesRes.data || []).map((r) => r.user_id));
      const emails = emailsRes.data?.emails || {};

      const repsByFamily = new Map<string, any[]>();
      for (const r of repsRes.data || []) {
        const list = repsByFamily.get(r.family_id) || [];
        list.push(r);
        repsByFamily.set(r.family_id, list);
      }
      const studentsByFamily = new Map<string, any[]>();
      for (const s of studentsRes.data || []) {
        const list = studentsByFamily.get(s.family_id) || [];
        list.push(s);
        studentsByFamily.set(s.family_id, list);
      }

      const getNameFromFormData = (fd: any) => {
        if (!fd) return "Sin nombre";
        const parts = [fd.primer_nombre, fd.primer_apellido].filter(Boolean);
        return parts.length > 0 ? parts.join(" ") : "Sin nombre";
      };

      const families: FamilyWithEmail[] = data
        .filter((f) => repUserIds.has(f.user_id))
        .map((family) => {
          const reps = repsByFamily.get(family.id) || [];
          const students = studentsByFamily.get(family.id) || [];
          return {
            ...family,
            email: emails[family.user_id] || "Sin correo",
            hasMembers: reps.length > 0 || students.length > 0,
            representativeNames: reps.map((r: any) => getNameFromFormData(r.form_data)),
            studentNames: students.map((s: any) => getNameFromFormData(s.form_data)),
            repsCount: reps.length,
            studentsCount: students.length,
          };
        });

      return { families, count: count || 0 };
    },
    enabled: !!schoolId,
  });

  // Client-side filtering
  const filteredFamilies = useMemo(() => {
    if (!familiesData?.families) return [];
    return familiesData.families.filter((family) => {
      const name = getFamilyName(family).toLowerCase();
      const email = (family.email || "").toLowerCase();

      if (filters.name && !name.includes(filters.name.toLowerCase())) return false;
      if (filters.email && !email.includes(filters.email.toLowerCase())) return false;
      if (filters.status === "active" && family.is_suspended) return false;
      if (filters.status === "suspended" && !family.is_suspended) return false;

      return true;
    });
  }, [familiesData?.families, filters]);

  const hasActiveFilters = filters.name || filters.email || filters.status !== "all";

  const clearFilters = () => {
    setFilters({ name: "", email: "", status: "all" });
  };

  // Suspend/activate family mutation
  const toggleSuspendMutation = useMutation({
    mutationFn: async ({ familyId, suspend }: { familyId: string; suspend: boolean }) => {
      const { error } = await supabase
        .from("families")
        .update({ is_suspended: suspend })
        .eq("id", familyId);
      if (error) throw error;
    },
    onSuccess: (_, { suspend }) => {
      queryClient.invalidateQueries({ queryKey: ["families"] });
      toast({
        title: suspend ? "Familia suspendida" : "Familia activada",
        description: suspend 
          ? "La familia ya no podrá iniciar sesión" 
          : "La familia puede iniciar sesión nuevamente",
      });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el estado de la familia" });
    },
  });

  // Delete family mutation
  const deleteFamilyMutation = useMutation({
    mutationFn: async (familyId: string) => {
      await supabase.from("family_schools").delete().eq("family_id", familyId);
      const { error } = await supabase.from("families").delete().eq("id", familyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["families"] });
      queryClient.invalidateQueries({ queryKey: ["families-global-counts"] });
      toast({ title: "Familia eliminada", description: "La familia ha sido eliminada exitosamente" });
      setDeleteDialogOpen(false);
      setFamilyToDelete(null);
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar la familia" });
    },
  });

  const handleViewFamily = (familyId: string) => {
    setSelectedFamilyId(familyId);
    setViewModalOpen(true);
  };

  const totalPages = Math.ceil((familiesData?.count || 0) / ITEMS_PER_PAGE);

  if (schoolLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Familia"
        breadcrumbs={[
          { label: "Dashboard", href: "/school/dashboard" },
          { label: "Familia" },
        ]}
      />

      {/* Global Counters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <MetricCard
          title="Familias Registradas"
          value={globalCounts?.families ?? "..."}
          icon={<UsersRound className="h-10 w-10" />}
          variant="orange"
        />
        <MetricCard
          title="Representantes Totales"
          value={globalCounts?.representatives ?? "..."}
          icon={<UserCheck className="h-10 w-10" />}
          variant="blue"
        />
        <MetricCard
          title="Estudiantes Totales"
          value={globalCounts?.students ?? "..."}
          icon={<GraduationCap className="h-10 w-10" />}
          variant="green"
        />
      </div>

      <div className="bg-card rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <Button onClick={() => setAddModalOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Agregar Familia
          </Button>
          <h2 className="text-lg font-semibold">Familia</h2>
        </div>

        <Alert className="mb-6 border-primary/20 bg-primary/5">
          <Info className="h-4 w-4 text-primary" />
          <AlertDescription className="text-muted-foreground">
            Vamos a comenzar a agregar las familias que serán parte de la institución.
          </AlertDescription>
        </Alert>

        {/* Advanced Search */}
        <Collapsible open={searchOpen} onOpenChange={setSearchOpen} className="mb-4">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Search className="h-4 w-4" />
                Búsqueda Avanzada
                <ChevronDown className={`h-4 w-4 transition-transform ${searchOpen ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground">
                <X className="h-3 w-3" />
                Limpiar filtros
              </Button>
            )}
          </div>
          <CollapsibleContent className="mt-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg border">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Nombre de familia</label>
                <Input
                  placeholder="Buscar por apellidos..."
                  value={filters.name}
                  onChange={(e) => setFilters((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Correo electrónico</label>
                <Input
                  placeholder="Buscar por email..."
                  value={filters.email}
                  onChange={(e) => setFilters((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Estado</label>
                <Select value={filters.status} onValueChange={(v) => setFilters((f) => ({ ...f, status: v as SearchFilters["status"] }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">Activos</SelectItem>
                    <SelectItem value="suspended">Suspendidos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Cargando familias...</p>
          </div>
        ) : filteredFamilies.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {hasActiveFilters ? "No se encontraron familias con los filtros aplicados" : "No hay familias registradas"}
            </p>
            {!hasActiveFilters && (
              <Button className="mt-4" onClick={() => setAddModalOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Agregar primera familia
              </Button>
            )}
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Acciones</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                   <TableHead>Representantes</TableHead>
                  <TableHead>Estudiantes</TableHead>
                  <TableHead>Miembros</TableHead>
                  <TableHead>Activo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFamilies.map((family) => (
                  <TableRow key={family.id}>
                    <TableCell>
                      <TooltipProvider delayDuration={200}>
                        <div className="flex items-center gap-0.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleViewFamily(family.id)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Ver familia</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/registros/familias/${family.id}/representante/nuevo`)}>
                                <UserCheck className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Agregar Representante</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/registros/familias/${family.id}/estudiante/nuevo`)}>
                                <GraduationCap className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Agregar Estudiante</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setPasswordFamily(family); setPasswordModalOpen(true); }}>
                                <KeyRound className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Cambiar contraseña</TooltipContent>
                          </Tooltip>
                          {!family.hasMembers && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => {
                                    setFamilyToDelete(family);
                                    setDeleteDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Eliminar familia</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {getFamilyName(family)}
                    </TableCell>
                    <TableCell>{family.email}</TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        {family.representativeNames && family.representativeNames.length > 0 ? (
                          family.representativeNames.map((name, i) => (
                            <p key={i} className="text-sm">{name}</p>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        {family.studentNames && family.studentNames.length > 0 ? (
                          family.studentNames.map((name, i) => (
                            <p key={i} className="text-sm">{name}</p>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground whitespace-nowrap">
                        <span className="font-medium text-foreground">{family.repsCount}</span> {family.repsCount === 1 ? "rep." : "reps."} / <span className="font-medium text-foreground">{family.studentsCount}</span> {family.studentsCount === 1 ? "est." : "ests."}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={family.is_suspended ? "destructive" : "default"}
                        className={
                          family.is_suspended
                            ? "bg-destructive text-destructive-foreground"
                            : "bg-emerald-500 text-white hover:bg-emerald-600"
                        }
                      >
                        {family.is_suspended ? "Suspendido" : "Activo"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {hasActiveFilters
                  ? `${filteredFamilies.length} resultado(s) encontrado(s)`
                  : `Mostrando ${((currentPage - 1) * ITEMS_PER_PAGE) + 1} a ${Math.min(currentPage * ITEMS_PER_PAGE, familiesData?.count || 0)} de ${familiesData?.count} familias`
                }
              </p>
              {!hasActiveFilters && totalPages > 1 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  totalItems={familiesData?.count || 0}
                  itemsPerPage={ITEMS_PER_PAGE}
                />
              )}
            </div>
          </>
        )}
      </div>

      <AddFamilyModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        schoolId={schoolId || ""}
      />

      {selectedFamilyId && (
        <ViewFamilyModal
          open={viewModalOpen}
          onClose={() => {
            setViewModalOpen(false);
            setSelectedFamilyId(null);
          }}
          familyId={selectedFamilyId}
          schoolId={schoolId || ""}
          onSuspendToggle={(suspend) => 
            toggleSuspendMutation.mutate({ familyId: selectedFamilyId, suspend })
          }
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar familia?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de eliminar la familia <strong>{familyToDelete ? getFamilyName(familyToDelete) : ""}</strong>. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => familyToDelete && deleteFamilyMutation.mutate(familyToDelete.id)}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {passwordFamily && (
        <ChangePasswordModal
          open={passwordModalOpen}
          onClose={() => { setPasswordModalOpen(false); setPasswordFamily(null); }}
          familyId={passwordFamily.id}
          familyName={getFamilyName(passwordFamily)}
        />
      )}
    </DashboardLayout>
  );
}

function getFamilyName(family: { father_last_name: string | null; mother_last_name: string | null }) {
  if (family.father_last_name || family.mother_last_name) {
    return `${family.father_last_name || ""} ${family.mother_last_name || ""}`.trim();
  }
  return "Sin datos";
}
