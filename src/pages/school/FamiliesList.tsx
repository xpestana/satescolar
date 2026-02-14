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
import { Eye, Users, UserPlus, Info } from "lucide-react";
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

      // Fetch emails for each family
      const familiesWithEmails: FamilyWithEmail[] = [];
      for (const family of data || []) {
        const { data: emailData } = await supabase.functions.invoke("get-user-emails", {
          body: { userIds: [family.user_id] },
        });
        
        familiesWithEmails.push({
          ...family,
          email: emailData?.emails?.[family.user_id] || "Sin correo",
        });
      }

      return { families: familiesWithEmails, count: count || 0 };
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
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo actualizar el estado de la familia",
      });
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
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleViewFamily(family.id)}
                        title="Ver familia"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
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
    </DashboardLayout>
  );
}
