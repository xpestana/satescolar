import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Edit, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { DeleteRepresentativeDialog } from "./DeleteRepresentativeDialog";

interface ViewFamilyModalProps {
  open: boolean;
  onClose: () => void;
  familyId: string;
  schoolId: string;
  onSuspendToggle: (suspend: boolean) => void;
}

export function ViewFamilyModal({
  open,
  onClose,
  familyId,
  schoolId,
  onSuspendToggle,
}: ViewFamilyModalProps) {
  const navigate = useNavigate();
  const [deleteRepId, setDeleteRepId] = useState<string | null>(null);
  const [deleteRepName, setDeleteRepName] = useState<string>("");

  // Fetch family details
  const { data: family, isLoading: familyLoading } = useQuery({
    queryKey: ["family", familyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("families")
        .select("*")
        .eq("id", familyId)
        .single();

      if (error) throw error;

      // Fetch email
      const { data: emailData } = await supabase.functions.invoke("get-user-emails", {
        body: { userIds: [data.user_id] },
      });

      return {
        ...data,
        email: emailData?.emails?.[data.user_id] || "Sin correo",
      };
    },
    enabled: !!familyId && open,
  });

  // Fetch students
  const { data: students } = useQuery({
    queryKey: ["students", familyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("family_id", familyId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!familyId && open,
  });

  // Fetch representatives
  const { data: representatives } = useQuery({
    queryKey: ["representatives", familyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("representatives")
        .select("*")
        .eq("family_id", familyId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!familyId && open,
  });

  const getFamilyName = () => {
    if (family?.father_last_name || family?.mother_last_name) {
      return `${family.father_last_name || ""} ${family.mother_last_name || ""}`.trim();
    }
    return "Por definir";
  };

  const getStudentName = (student: any) => {
    const formData = student.form_data || {};
    const firstName = formData.first_name || formData.nombre || "";
    const lastName = formData.last_name || formData.apellido || "";
    return `${firstName} ${lastName}`.trim() || "Sin nombre";
  };

  const getRepresentativeName = (rep: any) => {
    const formData = rep.form_data || {};
    const firstName = formData.first_name || formData.nombre || "";
    const lastName = formData.last_name || formData.apellido || "";
    return `${firstName} ${lastName}`.trim() || "Sin nombre";
  };

  const getStudentStatusLabel = (status: string) => {
    switch (status) {
      case "active":
        return "Activo";
      case "suspended":
        return "Suspendido";
      case "graduated":
        return "Egresado";
      case "completed":
        return "Culminado";
      default:
        return "Sin inscribir en año escolar actual";
    }
  };

  const handleEditFamily = () => {
    onClose();
    navigate(`/registros/familias/${familyId}/editar`);
  };

  const handleAddStudent = () => {
    onClose();
    navigate(`/registros/familias/${familyId}/estudiante/nuevo`);
  };

  const handleEditStudent = (studentId: string) => {
    onClose();
    navigate(`/registros/familias/${familyId}/estudiante/${studentId}/editar`);
  };

  const handleAddRepresentative = () => {
    onClose();
    navigate(`/registros/familias/${familyId}/representante/nuevo`);
  };

  const handleEditRepresentative = (repId: string) => {
    onClose();
    navigate(`/registros/familias/${familyId}/representante/${repId}/editar`);
  };

  const handleDeleteRepresentative = (repId: string, name: string) => {
    setDeleteRepId(repId);
    setDeleteRepName(name);
  };

  if (familyLoading) {
    return (
      <Dialog open={open} onOpenChange={() => onClose()}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Cargando...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={() => onClose()}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="bg-primary -m-6 mb-0 p-6 rounded-t-lg">
            <DialogTitle className="text-primary-foreground">Ver Familia</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 pt-4">
            {/* Family Info */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Familia:</p>
                <p className="font-medium">{getFamilyName()}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Email:</p>
                <p>{family?.email}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status:</p>
                <Badge
                  variant={family?.is_suspended ? "destructive" : "outline"}
                  className={
                    family?.is_suspended
                      ? ""
                      : "border-cyan-500 text-cyan-600"
                  }
                >
                  {family?.is_suspended ? "Suspendido" : "Activo"}
                </Badge>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleEditFamily}>
                <Edit className="h-4 w-4 mr-2" />
                Editar Familia
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Teléfono:</p>
                <p>{family?.contact_phone || "Sin datos"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Dirección:</p>
                <p>{family?.address || "Sin datos"}</p>
              </div>
            </div>

            {/* Students Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Estudiantes:</h3>
                <Button onClick={handleAddStudent}>
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Estudiante
                </Button>
              </div>

              {!students || students.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay estudiantes registrados</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell>{getStudentName(student)}</TableCell>
                        <TableCell>{student.document_id || "Sin documento"}</TableCell>
                        <TableCell>{getStudentStatusLabel(student.status)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditStudent(student.id)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Representatives Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Representantes:</h3>
                <Button onClick={handleAddRepresentative}>
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Representante
                </Button>
              </div>

              {!representatives || representatives.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay representantes registrados</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Correo</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {representatives.map((rep) => (
                      <TableRow key={rep.id}>
                        <TableCell>{getRepresentativeName(rep)}</TableCell>
                        <TableCell>{rep.document_id || "Sin documento"}</TableCell>
                        <TableCell>{rep.phone || "Sin teléfono"}</TableCell>
                        <TableCell>{rep.email || "Sin correo"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditRepresentative(rep.id)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDeleteRepresentative(rep.id, getRepresentativeName(rep))}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={onClose} className="text-destructive">
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteRepresentativeDialog
        open={!!deleteRepId}
        onClose={() => {
          setDeleteRepId(null);
          setDeleteRepName("");
        }}
        representativeId={deleteRepId || ""}
        representativeName={deleteRepName}
        familyId={familyId}
      />
    </>
  );
}
