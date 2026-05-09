import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Pencil, Trash2, Eye } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Pagination } from "@/components/ui/data-pagination";
import { SchoolDetailsModal } from "@/components/admin/SchoolDetailsModal";
import { supabase } from "@/integrations/supabase/client";
import { TableSkeleton } from "@/components/ui/loading-skeletons";
import { toast } from "sonner";

const ITEMS_PER_PAGE = 10;

interface School {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  rif: string;
  logo_url?: string | null;
  dea_code?: string;
  statistical_code?: string;
  fax?: string | null;
  url?: string | null;
  institution_type?: string;
}

export default function SchoolsList() {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  const fetchSchools = async () => {
    try {
      const { data, error } = await supabase
        .from("schools")
        .select("id, name, address, phone, email, rif, logo_url, dea_code, statistical_code, fax, url, institution_type")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSchools(data || []);
    } catch (error) {
      console.error("Error fetching schools:", error);
      toast.error("Error al cargar los colegios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchools();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("schools").delete().eq("id", id);
      if (error) throw error;
      
      setSchools(schools.filter((school) => school.id !== id));
      toast.success("Colegio eliminado correctamente");
    } catch (error) {
      console.error("Error deleting school:", error);
      toast.error("Error al eliminar el colegio");
    }
  };

  const filteredSchools = schools.filter(
    (school) =>
      school.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      school.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      school.rif.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredSchools.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedSchools = filteredSchools.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <DashboardLayout>
      <PageHeader
        title="Colegios"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Colegios" },
        ]}
      />

      <div className="bg-card rounded-xl shadow-sm border">
        {/* Toolbar */}
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <Link to="/admin/colegios/crear">
              <Button className="shadow-sm">
                <Plus className="h-4 w-4 mr-2" />
                Agregar Colegio
              </Button>
            </Link>
            <Button
              variant="outline"
              className="shadow-sm"
              onClick={async () => {
                toast.info("Migrando archivos a S3... esto puede tardar.");
                const { data, error } = await supabase.functions.invoke("s3-migrate-existing");
                if (error) {
                  toast.error("Error en la migración: " + error.message);
                  return;
                }
                const s = data?.stats || {};
                toast.success(`Migración completa — Subidos: ${s.uploaded ?? 0} · Saltados: ${s.skipped ?? 0} · Errores: ${s.errors ?? 0}`);
                if (s.errorDetails?.length) console.error("Errores:", s.errorDetails);
              }}
            >
              Migrar archivos a S3
            </Button>
          </div>

          <div className="flex items-center gap-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar colegios..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-72 bg-muted/50 border-0 focus-visible:bg-background focus-visible:ring-1"
              />
            </div>
            <span className="text-sm text-muted-foreground hidden lg:block">
              Lista de Colegios Registrados
            </span>
          </div>
        </div>

        {/* Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Dirección</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>RIF</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableSkeleton rows={6} columns={6} />
            ) : paginatedSchools.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {searchTerm
                    ? "No se encontraron colegios con ese criterio de búsqueda"
                    : "No hay colegios registrados. ¡Crea el primero!"}
                </TableCell>
              </TableRow>
            ) : (
              paginatedSchools.map((school) => (
                <TableRow key={school.id}>
                  <TableCell className="font-medium">{school.name}</TableCell>
                  <TableCell className="max-w-xs truncate">{school.address}</TableCell>
                  <TableCell>{school.phone}</TableCell>
                  <TableCell>{school.email}</TableCell>
                  <TableCell>{school.rif}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        title="Ver detalles"
                        onClick={() => {
                          setSelectedSchool(school);
                          setDetailsModalOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Link to={`/admin/colegios/${school.id}/editar`}>
                        <Button variant="ghost" size="icon" title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </Link>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" title="Eliminar">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar colegio?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción no se puede deshacer. Se eliminará permanentemente
                              el colegio "{school.name}" y todos sus datos asociados.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(school.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={filteredSchools.length}
          itemsPerPage={ITEMS_PER_PAGE}
        />
      </div>

      <SchoolDetailsModal
        school={selectedSchool}
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
      />
    </DashboardLayout>
  );
}
