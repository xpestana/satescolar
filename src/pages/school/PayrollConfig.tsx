import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardSkeleton } from "@/components/ui/loading-skeletons";
import { Tags, CalendarRange, Percent, Landmark } from "lucide-react";
import { useSchoolId } from "@/hooks/useSchoolId";
import { PayrollConceptsTab } from "@/components/payroll/PayrollConceptsTab";
import { PayrollPeriodsTab } from "@/components/payroll/PayrollPeriodsTab";
import { PayrollWithholdingsConfigTab } from "@/components/payroll/PayrollWithholdingsConfigTab";
import { PayrollContributionsConfigTab } from "@/components/payroll/PayrollContributionsConfigTab";

export default function PayrollConfig() {
  const { schoolId, isLoading } = useSchoolId();

  if (isLoading || !schoolId) return <DashboardLayout><DashboardSkeleton /></DashboardLayout>;

  return (
    <DashboardLayout>
      <PageHeader
        title="Configuración de Nómina"
        breadcrumbs={[{ label: "Nómina", href: "/pagos/nomina" }, { label: "Configuración" }]}
        description="Define los conceptos de pago, los períodos de nómina, las retenciones y los parafiscales que se usarán al registrar pagos."
      />
      <Tabs defaultValue="concepts" className="w-full">
        <TabsList className="mb-4 h-auto flex-wrap">
          <TabsTrigger value="concepts" className="gap-2"><Tags className="h-4 w-4" />Conceptos</TabsTrigger>
          <TabsTrigger value="periods" className="gap-2"><CalendarRange className="h-4 w-4" />Períodos</TabsTrigger>
          <TabsTrigger value="withholdings" className="gap-2"><Percent className="h-4 w-4" />Retenciones</TabsTrigger>
          <TabsTrigger value="contributions" className="gap-2"><Landmark className="h-4 w-4" />Parafiscales</TabsTrigger>
        </TabsList>
        <TabsContent value="concepts"><PayrollConceptsTab schoolId={schoolId} /></TabsContent>
        <TabsContent value="periods"><PayrollPeriodsTab schoolId={schoolId} /></TabsContent>
        <TabsContent value="withholdings"><PayrollWithholdingsConfigTab schoolId={schoolId} /></TabsContent>
        <TabsContent value="contributions"><PayrollContributionsConfigTab schoolId={schoolId} /></TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
