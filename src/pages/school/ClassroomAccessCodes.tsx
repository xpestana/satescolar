import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Key, RefreshCw, Search, Shield, History, Copy, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { toast } from "sonner";
import { formatGradeLevel } from "@/lib/utils";

export default function ClassroomAccessCodes() {
  const { schoolId } = useSchoolId();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [regenerateTarget, setRegenerateTarget] = useState<{ id: string; name: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Active school year
  const { data: activeYear } = useQuery({
    queryKey: ["active-year-codes", schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from("school_years")
        .select("id, year_range")
        .eq("school_id", schoolId!)
        .eq("is_active", true)
        .single();
      return data;
    },
    enabled: !!schoolId,
  });

  // Access codes with student info
  const { data: codes = [], isLoading } = useQuery({
    queryKey: ["access-codes", schoolId, activeYear?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("classroom_access_codes")
        .select(`
          id, access_code, is_active, failed_attempts, locked_until, created_at, updated_at,
          student:student_id(id, document_id, form_data, photo_url)
        `)
        .eq("school_id", schoolId!)
        .eq("school_year_id", activeYear!.id)
        .order("created_at", { ascending: false });
      return (data as any[]) || [];
    },
    enabled: !!schoolId && !!activeYear?.id,
  });

  // Access log
  const { data: logs = [] } = useQuery({
    queryKey: ["access-log", schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from("classroom_access_log")
        .select(`
          id, access_type, created_at, ip_address,
          student:student_id(id, document_id, form_data)
        `)
        .eq("school_id", schoolId!)
        .order("created_at", { ascending: false })
        .limit(100);
      return (data as any[]) || [];
    },
    enabled: !!schoolId,
  });

  // Generate codes for all enrolled students who don't have one yet
  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!schoolId || !activeYear?.id) throw new Error("Missing school/year");

      // Get enrolled students
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("student_id")
        .eq("school_id", schoolId)
        .eq("school_year_id", activeYear.id);

      if (!enrollments?.length) throw new Error("No hay estudiantes inscritos");

      // Get existing codes
      const { data: existing } = await supabase
        .from("classroom_access_codes")
        .select("student_id")
        .eq("school_id", schoolId)
        .eq("school_year_id", activeYear.id);

      const existingIds = new Set((existing || []).map((e) => e.student_id));
      const newStudents = enrollments.filter((e) => !existingIds.has(e.student_id));

      if (newStudents.length === 0) {
        toast.info("Todos los estudiantes ya tienen código de acceso");
        return 0;
      }

      // Insert new codes (auto-generated via default)
      const { error } = await supabase.from("classroom_access_codes").insert(
        newStudents.map((e) => ({
          student_id: e.student_id,
          school_id: schoolId,
          school_year_id: activeYear.id,
        }))
      );

      if (error) throw error;
      return newStudents.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["access-codes"] });
      if (count && count > 0) toast.success(`${count} código(s) generados exitosamente`);
    },
    onError: (err: any) => toast.error(err.message || "Error al generar códigos"),
  });

  // Regenerate a single code
  const regenerateMutation = useMutation({
    mutationFn: async (codeId: string) => {
      const newCode = crypto.randomUUID().slice(0, 8).toUpperCase();
      const { error } = await supabase
        .from("classroom_access_codes")
        .update({ access_code: newCode, failed_attempts: 0, locked_until: null })
        .eq("id", codeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-codes"] });
      setRegenerateTarget(null);
      toast.success("Código regenerado exitosamente");
    },
  });

  const getStudentName = (student: any) => {
    if (!student?.form_data) return "Sin nombre";
    const fd = student.form_data as Record<string, any>;
    return `${fd.primer_nombre || ""} ${fd.primer_apellido || ""}`.trim() || "Sin nombre";
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Código copiado");
  };

  const filtered = codes.filter((c: any) => {
    if (!search) return true;
    const name = getStudentName(c.student).toLowerCase();
    const doc = c.student?.document_id?.toLowerCase() || "";
    const s = search.toLowerCase();
    return name.includes(s) || doc.includes(s) || c.access_code.toLowerCase().includes(s);
  });

  return (
    <DashboardLayout>
      <PageHeader
        title="Códigos de Acceso — Aula Virtual"
        breadcrumbs={[{ label: "Dashboard", href: "/school/dashboard" }, { label: "Códigos de Acceso" }]}
      />

      <Tabs defaultValue="codes">
        <TabsList>
          <TabsTrigger value="codes">
            <Key className="h-4 w-4 mr-1" />
            Códigos
          </TabsTrigger>
          <TabsTrigger value="log">
            <History className="h-4 w-4 mr-1" />
            Bitácora
          </TabsTrigger>
        </TabsList>

        <TabsContent value="codes" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Códigos de Acceso — {activeYear?.year_range || ""}
                </CardTitle>
                <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
                  <Key className="h-4 w-4 mr-2" />
                  {generateMutation.isPending ? "Generando..." : "Generar Códigos Faltantes"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre, documento o código..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Badge variant="secondary">{filtered.length} código(s)</Badge>
              </div>

              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Cargando...</div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay códigos de acceso. Presione "Generar Códigos Faltantes" para crear los códigos de los estudiantes inscritos.
                </div>
              ) : (
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Estudiante</TableHead>
                        <TableHead>Documento</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead className="text-center">Estado</TableHead>
                        <TableHead className="text-center">Intentos</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((c: any) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{getStudentName(c.student)}</TableCell>
                          <TableCell>{c.student?.document_id || "—"}</TableCell>
                          <TableCell>
                            <code className="bg-muted px-2 py-1 rounded text-sm font-mono">{c.access_code}</code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 ml-1"
                              onClick={() => copyCode(c.access_code, c.id)}
                            >
                              {copiedId === c.id ? <CheckCircle2 className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                            </Button>
                          </TableCell>
                          <TableCell className="text-center">
                            {c.is_active ? (
                              <Badge className="bg-green-100 text-green-700">Activo</Badge>
                            ) : (
                              <Badge variant="destructive">Inactivo</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {c.failed_attempts > 0 ? (
                              <Badge variant="outline" className="text-orange-600">{c.failed_attempts}</Badge>
                            ) : (
                              "0"
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setRegenerateTarget({ id: c.id, name: getStudentName(c.student) })}
                            >
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Regenerar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="log" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5" />
                Bitácora de Accesos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No hay registros de acceso aún.</div>
              ) : (
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Estudiante</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>IP</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log: any) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            {new Date(log.created_at).toLocaleDateString("es-VE", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </TableCell>
                          <TableCell>{getStudentName(log.student)}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{log.access_type === "code_verified" ? "Código verificado" : log.access_type}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{log.ip_address || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Regenerate confirmation dialog */}
      <Dialog open={!!regenerateTarget} onOpenChange={(o) => !o && setRegenerateTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerar Código de Acceso</DialogTitle>
            <DialogDescription>
              ¿Está seguro de regenerar el código de acceso de <strong>{regenerateTarget?.name}</strong>? El código anterior dejará de funcionar inmediatamente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegenerateTarget(null)}>Cancelar</Button>
            <Button
              onClick={() => regenerateTarget && regenerateMutation.mutate(regenerateTarget.id)}
              disabled={regenerateMutation.isPending}
            >
              {regenerateMutation.isPending ? "Regenerando..." : "Regenerar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
