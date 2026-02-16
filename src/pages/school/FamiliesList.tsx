import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Eye, Users, UserPlus, Info, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useToast } from "@/hooks/use-toast";
import { AddFamilyModal } from "@/components/families/AddFamilyModal";
import { ViewFamilyModal } from "@/components/families/ViewFamilyModal";
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
}

const ITEMS_PER_PAGE = 10;

export default function FamiliesList() {
  const { schoolId, isLoading: schoolLoading } = useSchoolId();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [currentPage, setCurrentPage] = useState(1);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [familyToDelete, setFamilyToDelete] = useState<FamilyWithEmail | null>(null);

  // Fetch families
  const { data: familiesData, isLoading } = useQuery({
    queryKey: ["families", schoolId, currentPage],
    queryFn: async () => {
      if (!schoolId) return { families: [], count: 0 };

      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const { data, error, count } = await supabase
        .from("families")
        .select("*, family_schools!inner(school_id)", { count: "exact" })
        .eq("family_schools.school_id", schoolId)
        .range(from, to)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Filter families to only show those with representative role
      const userIds = (data || []).map((f) => f.user_id);
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      const repUserIds = new Set(
        (rolesData || []).filter((r) => r.role === "representative").map((r) => r.user_id)
      );
      const repFamilies = (data || []).filter((f) => repUserIds.has(f.user_id));

      const familiesWithEmails: FamilyWithEmail[] = [];
      for (const family of repFamilies) {
        // Fetch email
        const { data: emailData } = await supabase.functions.invoke("get-user-emails", {
          body: { userIds: [family.user_id] },
        });

        // Check if family has representatives or students
        const [{ count: repsCount }, { count: studentsCount }] = await Promise.all([
          supabase.from("representatives").select("id", { count: "exact", head: true }).eq("family_id", family.id),
          supabase.from("students").select("id", { count: "exact", head: true }).eq("family_id", family.id),
        ]);

        familiesWithEmails.push({
          ...family,
          email: emailData?.emails?.[family.user_id] || "Sin correo",
          hasMembers: (repsCount || 0) > 0 || (studentsCount || 0) > 0,
        });
      }

      return { families: familiesWithEmails, count: familiesWithEmails.length };
    },
    enabled: !!schoolId,
  });

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
      // Delete family_schools link first
      await supabase.from("family_schools").delete().eq("family_id", familyId);
      // Delete the family
      const { error } = await supabase.from("families").delete().eq("id", familyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["families"] });
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

  const getFamilyName = (family: FamilyWithEmail) => {
    if (family.father_last_name || family.mother_last_name) {
      return `${family.father_last_name || ""} ${family.mother_last_name || ""}`.trim();
    }
    return "Sin datos";
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

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Cargando familias...</p>
          </div>
        ) : familiesData?.families.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay familias registradas</p>
            <Button className="mt-4" onClick={() => setAddModalOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Agregar primera familia
            </Button>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Acciones</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Activo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {familiesData?.families.map((family) => (
                  <TableRow key={family.id}>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewFamily(family.id)}
                          title="Ver familia"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {!family.hasMembers && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              setFamilyToDelete(family);
                              setDeleteDialogOpen(true);
                            }}
                            title="Eliminar familia"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate">
                      {getFamilyName(family)}
                    </TableCell>
                    <TableCell>{family.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant={family.is_suspended ? "destructive" : "default"}
                        className={
                          family.is_suspended
                            ? "bg-destructive text-destructive-foreground"
                            : "bg-emerald-500 text-white hover:bg-emerald-600"
                        }
                      >
                        {family.is_suspended ? "Suspendido" : "Usuario Activo en sistema"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a{" "}
                {Math.min(currentPage * ITEMS_PER_PAGE, familiesData?.count || 0)} de{" "}
                {familiesData?.count} familias
              </p>
              {totalPages > 1 && (
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
    </DashboardLayout>
  );
}
