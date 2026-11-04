import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardSkeleton } from "@/components/ui/loading-skeletons";
import { useSchoolId } from "@/hooks/useSchoolId";
import { usePayrollTaxConfig } from "@/hooks/payroll/usePayrollTaxConfig";
import { AnnualCertificatesTab } from "@/components/payroll/AnnualCertificatesTab";
import { WithholdingsPeriodTab } from "@/components/payroll/WithholdingsPeriodTab";

export default function PayrollWithholdings() {
  const { schoolId, isLoading: schoolLoading } = useSchoolId();
  const { vatEnabled, islrEnabled, isLoading } = usePayrollTaxConfig(schoolId);

  if (schoolLoading || !schoolId || isLoading) return <DashboardLayout><DashboardSkeleton /></DashboardLayout>;

  const defaultTab = vatEnabled ? "vat" : "islr";

  return (
    <DashboardLayout>
      <PageHeader
        title="Retenciones"
        breadcrumbs={[{ label: "Nómina", href: "/pagos/nomina" }, { label: "Retenciones" }]}
        description="Comprobantes, datos para declarar y control de lo enterado al SENIAT."
      />

      {!vatEnabled && !islrEnabled ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Las retenciones no están activas en este colegio. Se activan en{" "}
            <Link to="/pagos/nomina/configuracion" className="text-primary underline">Configuración de Nómina</Link>.
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="mb-4">
            {vatEnabled && <TabsTrigger value="vat">IVA</TabsTrigger>}
            {islrEnabled && <TabsTrigger value="islr">ISLR</TabsTrigger>}
            {islrEnabled && <TabsTrigger value="annual">Comprobante anual</TabsTrigger>}
          </TabsList>
          {vatEnabled && <TabsContent value="vat"><WithholdingsPeriodTab schoolId={schoolId} taxType="vat" /></TabsContent>}
          {islrEnabled && <TabsContent value="islr"><WithholdingsPeriodTab schoolId={schoolId} taxType="islr" /></TabsContent>}
          {islrEnabled && <TabsContent value="annual"><AnnualCertificatesTab schoolId={schoolId} /></TabsContent>}
        </Tabs>
      )}
    </DashboardLayout>
  );
}
