import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Receipt, FileText } from "lucide-react";
import { InvoiceFormatTab } from "@/components/payments/InvoiceFormatTab";
import { BolletasFormatTab } from "@/components/grades/BolletasFormatTab";

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
          </TabsTrigger>
          <TabsTrigger value="boletas" className="gap-2">
            <FileText className="h-4 w-4" />
            Formato de Boletas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="facturas">
          <InvoiceFormatTab />
        </TabsContent>

        <TabsContent value="boletas">
          <BolletasFormatTab />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
