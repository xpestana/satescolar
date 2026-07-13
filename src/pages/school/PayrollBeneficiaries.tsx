import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DashboardSkeleton } from "@/components/ui/loading-skeletons";
import { Search, Plus, CreditCard, History, Pencil } from "lucide-react";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useSchoolData } from "@/hooks/useSchoolData";
import { usePayrollBeneficiaries } from "@/hooks/payroll/usePayrollBeneficiaries";
import { BeneficiaryFormModal } from "@/components/payroll/BeneficiaryFormModal";
import { PayrollMethodsModal } from "@/components/payroll/PayrollMethodsModal";
import { PayrollBeneficiaryHistoryModal } from "@/components/payroll/PayrollBeneficiaryHistoryModal";
import { CATEGORY_LABELS, type PayrollBeneficiary, type PayrollCategory } from "@/lib/payroll/types";

export default function PayrollBeneficiaries() {
  const { schoolId, isLoading: schoolLoading } = useSchoolId();
  const { school } = useSchoolData();
  const { beneficiaries, isLoading } = usePayrollBeneficiaries(schoolId);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PayrollBeneficiary | null>(null);
  const [methodsFor, setMethodsFor] = useState<PayrollBeneficiary | null>(null);
  const [historyFor, setHistoryFor] = useState<PayrollBeneficiary | null>(null);

  const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  const filtered = useMemo(() => {
    let rows = beneficiaries;
    if (categoryFilter !== "all") rows = rows.filter((b) => b.category === categoryFilter);
    if (search.trim()) {
      const q = normalize(search);
      rows = rows.filter((b) => normalize(b.full_name).includes(q) || normalize(b.document_id ?? "").includes(q));
    }
    return rows;
  }, [beneficiaries, categoryFilter, search]);

  if (schoolLoading || !schoolId) return <DashboardLayout><DashboardSkeleton /></DashboardLayout>;

  return (
    <DashboardLayout>
      <PageHeader
        title="Beneficiarios de Nómina"
        breadcrumbs={[{ label: "Administrativo", href: "/pagos" }, { label: "Nómina", href: "/pagos/nomina" }, { label: "Beneficiarios" }]}
        description="Registra al personal y proveedores a pagar, sus datos y métodos de pago reutilizables."
      />

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nombre o cédula..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Categoría" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {(Object.keys(CATEGORY_LABELS) as PayrollCategory[]).map((c) => (
              <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" />Nuevo beneficiario
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Cédula</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead className="w-52">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No hay beneficiarios.</TableCell></TableRow>
              ) : (
                filtered.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.full_name}</TableCell>
                    <TableCell>{b.document_id || "—"}</TableCell>
                    <TableCell><Badge variant="outline">{CATEGORY_LABELS[b.category]}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{b.email || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => setMethodsFor(b)}>
                          <CreditCard className="h-3 w-3 mr-1" />Métodos
                        </Button>
                        <Button size="sm" variant="ghost" title="Historial" onClick={() => setHistoryFor(b)}>
                          <History className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" title="Editar" onClick={() => { setEditing(b); setFormOpen(true); }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <BeneficiaryFormModal open={formOpen} onOpenChange={setFormOpen} schoolId={schoolId} beneficiary={editing} />
      {methodsFor && (
        <PayrollMethodsModal
          open={!!methodsFor}
          onOpenChange={(v) => !v && setMethodsFor(null)}
          schoolId={schoolId}
          beneficiaryId={methodsFor.id}
          beneficiaryName={methodsFor.full_name}
        />
      )}
      {historyFor && (
        <PayrollBeneficiaryHistoryModal
          open={!!historyFor}
          onOpenChange={(v) => !v && setHistoryFor(null)}
          schoolId={schoolId}
          schoolName={school?.name ?? "—"}
          beneficiary={historyFor}
        />
      )}
    </DashboardLayout>
  );
}
