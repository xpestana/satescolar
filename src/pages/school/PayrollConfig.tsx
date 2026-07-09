import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardSkeleton } from "@/components/ui/loading-skeletons";
import { Tags, CalendarRange } from "lucide-react";
import { useSchoolId } from "@/hooks/useSchoolId";
import { PayrollConceptsTab } from "@/components/payroll/PayrollConceptsTab";
import { PayrollPeriodsTab } from "@/components/payroll/PayrollPeriodsTab";

export default function PayrollConfig() {
  const { schoolId, isLoading } = useSchoolId();

  if (isLoading || !schoolId) return <DashboardLayout><DashboardSkeleton /></DashboardLayout>;

  return (
    <DashboardLayout>
      <PageHeader
        title="Configuración de Nómina"
        breadcrumbs={[{ label: "Administrativo", href: "/pagos" }, { label: "Nómina", href: "/pagos/nomina" }, { label: "Configuración" }]}
        description="Define los conceptos de pago y los períodos de nómina que se usarán al registrar pagos."
      />
      <Tabs defaultValue="concepts" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="concepts" className="gap-2"><Tags className="h-4 w-4" />Conceptos</TabsTrigger>
          <TabsTrigger value="periods" className="gap-2"><CalendarRange className="h-4 w-4" />Períodos</TabsTrigger>
        </TabsList>
        <TabsContent value="concepts"><PayrollConceptsTab schoolId={schoolId} /></TabsContent>
        <TabsContent value="periods"><PayrollPeriodsTab schoolId={schoolId} /></TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
