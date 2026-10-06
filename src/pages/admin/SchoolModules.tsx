import { Link, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CheckCircle2, Gift } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { SchoolModuleRow } from "@/components/admin/SchoolModuleRow";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSchoolModulesAdmin, type SchoolModuleUpdate } from "@/hooks/useSchoolModulesAdmin";
import { MODULE_CATALOG, SELLABLE_MODULE_KEYS, type SellableModuleKey } from "@/lib/modules/moduleCatalog";
import { isModuleActive, type SchoolModuleState } from "@/lib/modules/moduleStatus";

export default function SchoolModules() {
  const { id } = useParams<{ id: string }>();
  const { states, schoolName, isLoading, error, saveModules, isSaving } = useSchoolModulesAdmin(id);

  const save = async (updates: SchoolModuleUpdate[], successMessage: string) => {
    try {
      await saveModules(updates);
      toast.success(successMessage);
    } catch (err) {
      console.error("Error saving school modules:", err);
      toast.error("No se pudo guardar el cambio de módulos");
    }
  };

  const handleChange = (moduleKey: SellableModuleKey, next: SchoolModuleState) => {
    const name = MODULE_CATALOG[moduleKey].name;
    const message =
      next.enabled !== (states.get(moduleKey)?.enabled ?? false)
        ? `${name} ${next.enabled ? "activado" : "desactivado"}`
        : `Vencimiento de ${name} actualizado`;
    save([{ moduleKey, enabled: next.enabled, expiresAt: next.expires_at }], message);
  };

  const enableAll = () =>
    save(
      SELLABLE_MODULE_KEYS.filter((key) => !isModuleActive(states.get(key))).map((key) => ({
        moduleKey: key,
        enabled: true,
        expiresAt: null,
      })),
      "Todos los módulos quedaron activos",
    );

  const allActive = SELLABLE_MODULE_KEYS.every((key) => isModuleActive(states.get(key)));
  const ministryWithoutGrades =
    isModuleActive(states.get("ministry_forms")) && !isModuleActive(states.get("grades"));

  return (
    <DashboardLayout>
      <PageHeader
        title={`Módulos${schoolName ? ` · ${schoolName}` : ""}`}
        description="Activa o desactiva las funcionalidades que este colegio tiene contratadas."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Colegios", href: "/admin/colegios" },
          { label: "Módulos" },
        ]}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" asChild>
          <Link to="/admin/colegios">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a colegios
          </Link>
        </Button>
        <Button variant="outline" onClick={enableAll} disabled={isLoading || isSaving || allActive}>
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Activar todos sin vencimiento
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>No se pudieron cargar los módulos del colegio.</AlertDescription>
        </Alert>
      )}

      {ministryWithoutGrades && (
        <Alert className="mb-4 border-amber-300 bg-amber-50 text-amber-900">
          <AlertTriangle className="h-4 w-4 !text-amber-700" />
          <AlertDescription>
            Planillajes del Ministerio está activo sin <strong>Notas, Boletas y Sábana</strong>. El Resumen Final
            se arma con las notas cargadas, así que saldrá vacío si el colegio no las registra.
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex items-center gap-3 border-b p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-700">
            <Gift className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold">Registro</p>
            <p className="text-sm text-muted-foreground">
              Gratis y siempre activo: familias, estudiantes, inscripciones, carnet y ajustes.
            </p>
            <p className="text-xs text-muted-foreground">
              Docentes, Áreas y Asignación de Áreas se habilitan con Notas, Aula Virtual o Control de Asistencias.
            </p>
          </div>
        </div>

        <div className="divide-y">
          {isLoading
            ? SELLABLE_MODULE_KEYS.map((key) => (
                <div key={key} className="p-4">
                  <Skeleton className="h-10 w-full" />
                </div>
              ))
            : SELLABLE_MODULE_KEYS.map((key) => (
                <SchoolModuleRow
                  key={key}
                  info={MODULE_CATALOG[key]}
                  state={states.get(key) ?? null}
                  disabled={isSaving}
                  onChange={(next) => handleChange(key, next)}
                />
              ))}
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        El vencimiento es inclusivo: el módulo funciona hasta el final del día elegido (hora de Venezuela) y luego se
        bloquea solo. Los datos del colegio no se borran al desactivar un módulo.
      </p>
    </DashboardLayout>
  );
}
