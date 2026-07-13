import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePlanillasConfig } from "@/hooks/usePlanillasConfig";
import { DatosComunes } from "@/components/planillas/config/DatosComunes";
import { CodigosEducacion } from "@/components/planillas/config/CodigosEducacion";
import { ConfiguracionRFRE } from "@/components/planillas/config/ConfiguracionRFRE";

export default function PlanillasConfiguracion() {
  const config = usePlanillasConfig();

  return (
    <DashboardLayout>
      <PageHeader title="Configuración de Planillas" />

      <Tabs defaultValue="datos-comunes">
        <TabsList className="mb-6">
          <TabsTrigger value="datos-comunes">Datos comunes</TabsTrigger>
          <TabsTrigger value="codigos">Códigos</TabsTrigger>
          <TabsTrigger value="rfre">Configuraciones RFRE</TabsTrigger>
        </TabsList>

        <TabsContent value="datos-comunes">
          <DatosComunes
            schoolHeader={config.schoolHeader}
            saveSchoolHeader={config.saveSchoolHeader}
            isLoading={config.isLoading}
          />
        </TabsContent>

        <TabsContent value="codigos">
          <CodigosEducacion
            educationCodes={config.educationCodes}
            saveEducationCodes={config.saveEducationCodes}
            isLoading={config.isLoading}
          />
        </TabsContent>

        <TabsContent value="rfre">
          <ConfiguracionRFRE
            rfreConfig={config.rfreConfig}
            saveRfreConfig={config.saveRfreConfig}
            isLoading={config.isLoading}
          />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
