import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmailComposer } from "@/components/utilities/EmailComposer";

export default function EmailSender() {
  return (
    <DashboardLayout>
      <PageHeader
        title="Correo Electrónico"
        breadcrumbs={[
          { label: "Utilidades" },
          { label: "Correo" },
        ]}
      />
      <EmailComposer />
    </DashboardLayout>
  );
}
