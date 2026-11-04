import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { DashboardSkeleton } from "@/components/ui/loading-skeletons";
import { Check, ChevronsUpDown, FileText, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useSchoolId } from "@/hooks/useSchoolId";
import { usePermissions } from "@/hooks/usePermissions";
import { ExchangeRateWidget } from "@/components/payments/ExchangeRateWidget";
import { usePayrollBeneficiaries } from "@/hooks/payroll/usePayrollBeneficiaries";
import { usePayrollPeriods } from "@/hooks/payroll/usePayrollPeriods";
import { PayrollStaffTab } from "@/components/payroll/PayrollStaffTab";
import { PayrollSupplierTab } from "@/components/payroll/PayrollSupplierTab";

export default function PayrollRegistration() {
  const { schoolId, isLoading: schoolLoading } = useSchoolId();
  const { has } = usePermissions();

  const canRegister = has("payroll.register");
  const canApprove = has("payroll.approve");

  const { periods, isLoading: periodsLoading } = usePayrollPeriods(schoolId);
  const { beneficiaries } = usePayrollBeneficiaries(schoolId);

  const [periodId, setPeriodId] = useState<string>("");
  const [periodOpen, setPeriodOpen] = useState(false);
  const activePeriodId = periodId || periods[0]?.id || "";

  if (schoolLoading || !schoolId) return <DashboardLayout><DashboardSkeleton /></DashboardLayout>;

  const activePeriod = periods.find((p) => p.id === activePeriodId);

  return (
    <DashboardLayout>
      <PageHeader
        title="Registro de Nómina"
        breadcrumbs={[{ label: "Nómina", href: "/pagos/nomina" }, { label: "Registro" }]}
        description="Selecciona el período y registra, aprueba y paga al personal y a los proveedores."
      />

      {periodsLoading ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Cargando períodos...</CardContent></Card>
      ) : periods.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No hay períodos de nómina. Crea uno en{" "}
            <Link to="/pagos/nomina/configuracion" className="text-primary underline">Configuración de Nómina</Link>.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-4">
            <Popover open={periodOpen} onOpenChange={setPeriodOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={periodOpen} className="w-[240px] justify-between font-normal">
                  <span className="truncate">
                    {activePeriod ? `${activePeriod.name}${activePeriod.status === "closed" ? " (cerrado)" : ""}` : "Período"}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[240px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar período..." />
                  <CommandList>
                    <CommandEmpty>No se encontró ningún período.</CommandEmpty>
                    <CommandGroup>
                      {periods.map((p) => (
                        <CommandItem
                          key={p.id}
                          value={p.name}
                          onSelect={() => { setPeriodId(p.id); setPeriodOpen(false); }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", activePeriodId === p.id ? "opacity-100" : "opacity-0")} />
                          {p.name} {p.status === "closed" ? "(cerrado)" : ""}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <Tabs defaultValue="staff" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="staff" className="gap-2"><Users className="h-4 w-4" />Personal</TabsTrigger>
              <TabsTrigger value="suppliers" className="gap-2"><FileText className="h-4 w-4" />Proveedores y honorarios</TabsTrigger>
            </TabsList>
            <TabsContent value="staff">
              <PayrollStaffTab
                schoolId={schoolId}
                periodId={activePeriodId}
                beneficiaries={beneficiaries}
                canRegister={canRegister}
                canApprove={canApprove}
              />
            </TabsContent>
            <TabsContent value="suppliers">
              <PayrollSupplierTab
                schoolId={schoolId}
                periodId={activePeriodId}
                beneficiaries={beneficiaries}
                canRegister={canRegister}
                canApprove={canApprove}
              />
            </TabsContent>
          </Tabs>

          <ExchangeRateWidget schoolId={schoolId} />
        </>
      )}
    </DashboardLayout>
  );
}
