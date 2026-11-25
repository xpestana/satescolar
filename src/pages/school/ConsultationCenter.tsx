import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdvancedSearchTab } from "@/components/search/AdvancedSearchTab";
import { EnrollmentStatsTab } from "@/components/enrollment-stats/EnrollmentStatsTab";

const TABS = { search: "busqueda", stats: "matricula" } as const;
type TabValue = (typeof TABS)[keyof typeof TABS];

const isTab = (value: string | null): value is TabValue =>
  value === TABS.search || value === TABS.stats;

/** Centro de Consultas: record search and enrollment statistics, one tab each (kept in `?tab=`). */
export default function ConsultationCenter() {
  const [params, setParams] = useSearchParams();
  const tabParam = params.get("tab");
  const tab: TabValue = isTab(tabParam) ? tabParam : TABS.search;

  return (
    <DashboardLayout>
      <PageHeader
        title="Centro de Consultas"
        breadcrumbs={[{ label: "Comunidad Escolar" }, { label: "Centro de Consultas" }]}
      />
      <Tabs value={tab} onValueChange={(value) => setParams({ tab: value }, { replace: true })} className="space-y-4">
        <TabsList>
          <TabsTrigger value={TABS.search}>Búsqueda avanzada</TabsTrigger>
          <TabsTrigger value={TABS.stats}>Estadística de matrícula</TabsTrigger>
        </TabsList>
        <TabsContent value={TABS.search}>
          <AdvancedSearchTab />
        </TabsContent>
        <TabsContent value={TABS.stats}>
          <EnrollmentStatsTab />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
