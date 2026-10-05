import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Receipt, FileText } from "lucide-react";
import { InvoiceFormatTab } from "@/components/payments/InvoiceFormatTab";
import { BolletasFormatTab } from "@/components/grades/BolletasFormatTab";
import { ModuleGate } from "@/components/modules/ModuleGate";
import { ModuleLockIcon } from "@/components/modules/ModuleLockIcon";

export default function FormatsConfig() {
  return (
    <DashboardLayout>
      <PageHeader
        title="Formatos"
        breadcrumbs={[
          { label: "Configuración", href: "/pagos/configuracion" },
          { label: "Formatos" },
        ]}
      />

      <Tabs defaultValue="facturas">
        <TabsList className="mb-6">
          <TabsTrigger value="facturas" className="gap-2">
            <Receipt className="h-4 w-4" />
            Formato de Facturas
            <ModuleLockIcon module="payments" />
          </TabsTrigger>
          <TabsTrigger value="boletas" className="gap-2">
            <FileText className="h-4 w-4" />
            Formato de Boletas
            <ModuleLockIcon module="grades" />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="facturas">
          <ModuleGate module="payments">
            <InvoiceFormatTab />
          </ModuleGate>
        </TabsContent>

        <TabsContent value="boletas">
          <ModuleGate module="grades">
            <BolletasFormatTab />
          </ModuleGate>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
