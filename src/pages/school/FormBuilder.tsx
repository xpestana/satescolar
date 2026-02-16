import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Info, Edit } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function FormBuilder() {
  const navigate = useNavigate();

  const breadcrumbs = [
    { label: "Dashboard", href: "/school/dashboard" },
    { label: "Configuraciones - Formularios" },
  ];

  return (
    <DashboardLayout>
      <PageHeader title="Configuraciones - Formularios" breadcrumbs={breadcrumbs} />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            Configuraciones - Formularios
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Info banner */}
          <div className="flex items-start gap-3 mb-6 p-4 bg-muted/50 rounded-lg">
            <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Desde aquí puedes crear los formularios que usará el colegio durante todo el uso del sistema.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-4 justify-center">
            <Button
              onClick={() => navigate("/school/configuraciones/formularios/representantes")}
              className="gap-2"
            >
              <Edit className="h-4 w-4" />
              Editar Formulario De Representantes
            </Button>
            <Button
              onClick={() => navigate("/school/configuraciones/formularios/estudiantes")}
              className="gap-2"
            >
              <Edit className="h-4 w-4" />
              Editar Formulario De Estudiantes
            </Button>
            <Button
              onClick={() => navigate("/school/configuraciones/formularios/docentes")}
              className="gap-2"
            >
              <Edit className="h-4 w-4" />
              Editar Formulario De Docentes
            </Button>
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
