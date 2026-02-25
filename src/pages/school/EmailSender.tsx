import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmailComposer } from "@/components/utilities/EmailComposer";
import { EmailHistory } from "@/components/utilities/EmailHistory";

export default function EmailSender() {
  return (
    <DashboardLayout>
      <PageHeader
        title="Correos Electrónicos"
        breadcrumbs={[
          { label: "Utilidades" },
          { label: "Correos Electrónicos" },
        ]}
      />
      <div className="space-y-6">
        <EmailComposer />
        <EmailHistory />
      </div>
    </DashboardLayout>
  );
}
