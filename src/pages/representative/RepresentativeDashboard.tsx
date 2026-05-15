import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, GraduationCap, AlertCircle, School, BookOpen, Key, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useRepresentativeFamily } from "@/hooks/useRepresentativeFamily";
import { toast } from "sonner";

export default function RepresentativeDashboard() {
  const navigate = useNavigate();
  const { familyId, familyName, school } = useRepresentativeFamily();

  const { data: representatives = [] } = useQuery({
    queryKey: ["representatives", familyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("representatives")
        .select("*")
        .eq("family_id", familyId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!familyId,
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students", familyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("family_id", familyId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!familyId,
  });

  const { data: accessCodes = [] } = useQuery({
    queryKey: ["classroom-access-codes-dashboard", familyId],
    queryFn: async () => {
      const studentIds = students.map((s) => s.id);
      if (!studentIds.length) return [];
      const { data } = await supabase
        .from("classroom_access_codes")
        .select("student_id, access_code, is_active")
        .in("student_id", studentIds)
        .eq("is_active", true);
      return data || [];
    },
    enabled: !!familyId && students.length > 0,
  });

  const { data: pendingBalances = [] } = useQuery({
    queryKey: ["rep-pending-balances", familyId],
    queryFn: async () => {
      const studentIds = students.map((s) => s.id);
      if (!studentIds.length) return [];
      const { data } = await supabase
        .from("student_concept_balances")
        .select("student_id, balance")
        .in("student_id", studentIds)
        .gt("balance", 0);
      return data || [];
    },
    enabled: !!familyId && students.length > 0,
  });

  const getAccessCode = (studentId: string) => accessCodes.find((c) => c.student_id === studentId);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Código copiado al portapapeles");
  };

  const getRepName = (rep: any) => {
    const fd = (rep.form_data as Record<string, any>) || {};
    return `${fd.primer_nombre || ""} ${fd.segundo_nombre || ""} ${fd.primer_apellido || ""} ${fd.segundo_apellido || ""}`.replace(/\s+/g, " ").trim() || "Sin nombre";
  };

  const getStudentName = (s: any) => {
    const fd = (s.form_data as Record<string, any>) || {};
    return `${fd.primer_nombre || ""} ${fd.segundo_nombre || ""} ${fd.primer_apellido || ""} ${fd.segundo_apellido || ""}`.replace(/\s+/g, " ").trim() || "Sin nombre";
  };

  const getRepType = (rep: any) => {
    const fd = (rep.form_data as Record<string, any>) || {};
    return fd.parentesco || "Representante";
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active": return "Activo";
      case "suspended": return "Suspendido";
      case "graduated": return "Graduado";
      case "completed": return "Completado";
      default: return status;
    }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title={`Familia ${familyName}`}
        breadcrumbs={[{ label: "Dashboard" }]}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{representatives.length}</p>
              <p className="text-sm text-muted-foreground">Representantes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <GraduationCap className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{students.length}</p>
              <p className="text-sm text-muted-foreground">Estudiantes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <School className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">0</p>
              <p className="text-sm text-muted-foreground">Inscritos en plantel</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alert */}
      <Alert className="border-orange-200 bg-orange-50 mb-6">
        <AlertCircle className="h-4 w-4 text-orange-500" />
        <AlertDescription className="text-orange-700">
          Es importante mantener los datos de su familia actualizados para una mejor comunicación con la institución.
        </AlertDescription>
      </Alert>

      {/* Representatives Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-lg font-semibold cursor-pointer hover:text-primary transition-colors"
            onClick={() => navigate("/representative/representantes")}
          >
            Representantes →
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {representatives.map((rep) => (
            <Card key={rep.id}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={rep.photo_url || ""} />
                    <AvatarFallback className="bg-primary/10 text-primary text-lg">
                      {getRepName(rep).charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{getRepName(rep)}</p>
                    <p className="text-sm text-muted-foreground">{getRepType(rep)}</p>
                    <Badge variant="secondary" className="mt-1">{rep.document_id || "Sin doc."}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Students Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-lg font-semibold cursor-pointer hover:text-primary transition-colors"
            onClick={() => navigate("/representative/estudiantes")}
          >
            Estudiantes →
          </h2>
        </div>
        {students.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              No hay estudiantes registrados
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {students.map((student) => (
              <Card key={student.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4 mb-3">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={student.photo_url || ""} />
                      <AvatarFallback className="bg-primary/10 text-primary text-lg">
                        {getStudentName(student).charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{getStudentName(student)}</p>
                      <p className="text-sm text-muted-foreground">{student.document_id || "Sin doc."}</p>
                      <Badge variant={student.status === "active" ? "default" : "secondary"} className="mt-1">
                        {getStatusLabel(student.status)}
                      </Badge>
                    </div>
                  </div>
                  {getAccessCode(student.id) && (
                    <div className="flex items-center gap-2 mb-3 p-2 bg-muted/50 rounded-md">
                      <Key className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs text-muted-foreground">Código Aula:</span>
                      <code className="text-xs font-mono font-semibold tracking-wider">{getAccessCode(student.id)!.access_code}</code>
                      <Button size="icon" variant="ghost" className="h-5 w-5 ml-auto" onClick={() => copyCode(getAccessCode(student.id)!.access_code)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate(`/representative/aula-virtual/${student.id}`)}
                  >
                    <BookOpen className="h-4 w-4 mr-2" />
                    Aula Virtual
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
