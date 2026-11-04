import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { History, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePayrollTaxConfig } from "@/hooks/payroll/usePayrollTaxConfig";
import { IslrRateFormDialog } from "@/components/payroll/IslrRateFormDialog";
import { formatDateOnly, todayCaracasIso } from "@/lib/dateUtils";
import { isDefaultIslrRate } from "@/lib/payroll/withholdings/defaultRates";
import { resolveRateVersion } from "@/lib/payroll/withholdings/resolveRateVersion";
import { PERSON_TYPE_LABELS, type IslrConcept, type PersonType } from "@/lib/payroll/withholdings/types";

const COLUMNS: { type: PersonType; label: string }[] = [
  { type: "natural_resident", label: "Natural residente" },
  { type: "legal_domiciled", label: "Jurídica domiciliada" },
  { type: "natural_non_resident", label: "Natural no residente" },
  { type: "legal_non_domiciled", label: "Jurídica no domiciliada" },
];

/** ISLR table: a percentage per concept and type of person, with its history. */
export function IslrRatesCard({ schoolId }: { schoolId: string }) {
  const { toast } = useToast();
  const { concepts, rates, saveConcept, deleteFutureRate } = usePayrollTaxConfig(schoolId);
  const today = todayCaracasIso();

  const [editing, setEditing] = useState<{ concept: IslrConcept; personType: PersonType } | null>(null);
  const [historyFor, setHistoryFor] = useState<IslrConcept | null>(null);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");

  const addConcept = () => {
    if (!newName.trim()) return;
    saveConcept.mutate(
      { name: newName.trim(), seniat_code: newCode.trim() || null },
      {
        onSuccess: () => { setNewName(""); setNewCode(""); toast({ title: "Concepto agregado" }); },
        onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
      }
    );
  };

  const updateCode = (concept: IslrConcept, code: string) => {
    if ((concept.seniat_code ?? "") === code.trim()) return;
    saveConcept.mutate(
      { id: concept.id, name: concept.name, seniat_code: code.trim() || null },
      { onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }) }
    );
  };

  const history = historyFor ? rates.filter((r) => r.concept_id === historyFor.id) : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tabla de retención de ISLR</CardTitle>
        <CardDescription>Haga clic en un porcentaje para cambiarlo. Los pagos ya registrados conservan el suyo.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">Concepto</TableHead>
                <TableHead className="w-28">Código SENIAT</TableHead>
                {COLUMNS.map((c) => <TableHead key={c.type} className="text-center">{c.label}</TableHead>)}
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {concepts.map((concept) => (
                <TableRow key={concept.id}>
                  <TableCell className="font-medium">{concept.name}</TableCell>
                  <TableCell>
                    <Input
                      aria-label={`Código SENIAT de ${concept.name}`}
                      className="h-8 text-xs min-w-[96px]"
                      defaultValue={concept.seniat_code ?? ""}
                      placeholder="Pendiente"
                      onBlur={(e) => updateCode(concept, e.target.value)}
                    />
                  </TableCell>
                  {COLUMNS.map((column) => {
                    const version = resolveRateVersion(
                      rates.filter((r) => r.concept_id === concept.id && r.person_type === column.type),
                      today
                    );
                    return (
                      <TableCell key={column.type} className="text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Editar ${concept.name}, ${column.label}`}
                          onClick={() => setEditing({ concept, personType: column.type })}
                        >
                          {version ? `${version.rate_pct} %` : <span className="text-muted-foreground">—</span>}
                          <Pencil className="h-3 w-3 ml-1 opacity-50" />
                        </Button>
                        {version && !isDefaultIslrRate(concept.name, version) && (
                          <div><Badge variant="secondary" className="text-[10px]">Modificado</Badge></div>
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell>
                    <Button size="icon" variant="ghost" className="h-8 w-8" title="Historial" onClick={() => setHistoryFor(concept)}>
                      <History className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input className="max-w-xs" placeholder="Nuevo concepto" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Input className="w-32" placeholder="Código SENIAT" value={newCode} onChange={(e) => setNewCode(e.target.value)} />
          <Button variant="outline" onClick={addConcept} disabled={!newName.trim() || saveConcept.isPending}>
            {saveConcept.isPending ? <Loader2 className="animate-spin h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}Agregar
          </Button>
        </div>
      </CardContent>

      <IslrRateFormDialog
        schoolId={schoolId}
        concept={editing?.concept ?? null}
        personType={editing?.personType ?? "natural_resident"}
        onClose={() => setEditing(null)}
      />

      <Dialog open={!!historyFor} onOpenChange={(v) => !v && setHistoryFor(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Historial — {historyFor?.name}</DialogTitle>
            <DialogDescription>Solo se pueden borrar las versiones programadas para el futuro.</DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Desde</TableHead>
                <TableHead>Tipo de persona</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead className="text-right">% base</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{formatDateOnly(r.valid_from)}</TableCell>
                  <TableCell>{PERSON_TYPE_LABELS[r.person_type]}</TableCell>
                  <TableCell className="text-right">{r.rate_pct} %</TableCell>
                  <TableCell className="text-right">{r.base_pct} %</TableCell>
                  <TableCell>
                    {r.valid_from > today && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        title="Borrar versión programada"
                        onClick={() => deleteFutureRate.mutate(r.id, { onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }) })}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
