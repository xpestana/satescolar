import { DashboardSkeleton } from "@/components/ui/loading-skeletons";
import { useSchoolId } from "@/hooks/useSchoolId";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, FileText, CreditCard, Settings } from "lucide-react";
import { PaymentMethodsTab } from "@/components/payments/PaymentMethodsTab";
import { PaymentSettingsTab } from "@/components/payments/PaymentSettingsTab";
import { PaymentPlansTab } from "@/components/payments/PaymentPlansTab";
import { PaymentConceptsTab } from "@/components/payments/PaymentConceptsTab";

export default function PaymentConfig() {
  const { schoolId, isLoading: schoolLoading } = useSchoolId();

  if (schoolLoading || !schoolId) return <DashboardLayout><DashboardSkeleton /></DashboardLayout>;

  return (
    <DashboardLayout>
      <PageHeader title="Configuración de Pagos" breadcrumbs={[{ label: "Administrativo", href: "/pagos" }, { label: "Configuración" }]} />
      <Tabs defaultValue="concepts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="concepts" className="gap-2"><Package className="h-4 w-4" />Conceptos</TabsTrigger>
          <TabsTrigger value="plans" className="gap-2"><FileText className="h-4 w-4" />Planes</TabsTrigger>
          <TabsTrigger value="methods" className="gap-2"><CreditCard className="h-4 w-4" />Métodos de Pago</TabsTrigger>
          <TabsTrigger value="settings" className="gap-2"><Settings className="h-4 w-4" />Configuraciones</TabsTrigger>
        </TabsList>
        <TabsContent value="concepts"><PaymentConceptsTab schoolId={schoolId} /></TabsContent>
        <TabsContent value="plans"><PaymentPlansTab schoolId={schoolId} /></TabsContent>
        <TabsContent value="methods"><PaymentMethodsTab schoolId={schoolId} /></TabsContent>
        <TabsContent value="settings"><PaymentSettingsTab schoolId={schoolId} /></TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
