import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import type { SchoolYearOption } from "@/hooks/useSchoolYearSelection";
import { friendlyPaymentConfigError } from "@/lib/paymentConfigErrors";

export interface CopyableItem {
  id: string;
  name: string;
  /** Texto corto a la derecha (p. ej. "15 cuotas" o "75,00 USD"). */
  detail?: string;
  inactive?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  years: SchoolYearOption[];
  targetYear: SchoolYearOption;
  /** Sustantivo de lo que se copia, para los textos ("plan"/"planes", "concepto"/"conceptos"). */
  noun: { singular: string; plural: string };
  description: string;
  /** Nombres que ya existen en el año destino (no se duplican). */
  existingNames: string[];
  /** Clave base de React Query para la lista del año de origen; se le agrega el año. */
  queryKeyBase: readonly unknown[];
  fetchItems: (fromYearId: string) => Promise<CopyableItem[]>;
  copyItems: (fromYearId: string, ids: string[]) => Promise<number>;
  onCopied: () => void;
}

const normalizeName = (s: string) => s.trim().toLowerCase();

/**
 * Diálogo "Copiar de otro año" de Configuración de Pagos (planes y conceptos): se elige el año de
 * origen, se marcan los elementos y se copian al año elegido. Lo que ya existe con el mismo nombre
 * en el año destino no se ofrece.
 */
export function CopyFromYearDialog({
  open, onOpenChange, years, targetYear, noun, description, existingNames, queryKeyBase, fetchItems, copyItems, onCopied,
}: Props) {
  const { toast } = useToast();
  const sourceYears = useMemo(() => years.filter((y) => y.id !== targetYear.id), [years, targetYear.id]);
  const [fromYearId, setFromYearId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setFromYearId((prev) => (prev && sourceYears.some((y) => y.id === prev) ? prev : sourceYears[0]?.id ?? ""));
  }, [open, sourceYears]);

  const existing = useMemo(() => new Set(existingNames.map(normalizeName)), [existingNames]);

  const { data: items = [], isLoading } = useQuery({
    queryKey: [...queryKeyBase, fromYearId],
    queryFn: () => fetchItems(fromYearId),
    enabled: open && !!fromYearId,
  });

  // Por defecto se marcan todos los que todavía no existen en el año destino
  useEffect(() => {
    setSelected(new Set(items.filter((i) => !existing.has(normalizeName(i.name))).map((i) => i.id)));
  }, [items, existing]);

  const fromYear = sourceYears.find((y) => y.id === fromYearId);
  const nounFor = (n: number) => (n === 1 ? noun.singular : noun.plural);

  const copy = useMutation({
    mutationFn: () => copyItems(fromYearId, [...selected]),
    onSuccess: (copied) => {
      onCopied();
      toast({
        title: `Se copiaron ${copied} ${nounFor(copied)} a ${targetYear.year_range}`,
        description: `Ajuste montos y moneda de ${targetYear.year_range}: ${fromYear?.year_range ?? "el año de origen"} no cambia.`,
      });
      onOpenChange(false);
    },
    onError: (e: unknown) => toast({ title: `No se pudieron copiar los ${noun.plural}`, description: friendlyPaymentConfigError(e), variant: "destructive" }),
  });

  const toggle = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Copiar {noun.plural} a {targetYear.year_range}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Copiar desde</Label>
            <Select value={fromYearId} onValueChange={setFromYearId}>
              <SelectTrigger><SelectValue placeholder="Seleccione un año" /></SelectTrigger>
              <SelectContent>
                {sourceYears.map((y) => (
                  <SelectItem key={y.id} value={y.id}>{y.year_range}{y.is_active ? " (activo)" : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border divide-y max-h-72 overflow-y-auto">
            {isLoading ? (
              <div className="p-3 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
            ) : items.length === 0 ? (
              <p className="p-4 text-sm text-center text-muted-foreground">No hay {noun.plural} en ese año.</p>
            ) : (
              items.map((item) => {
                const alreadyThere = existing.has(normalizeName(item.name));
                return (
                  <label key={item.id} className={`flex items-center gap-3 px-3 py-2 text-sm ${alreadyThere ? "opacity-60" : "cursor-pointer"}`}>
                    <Checkbox
                      checked={selected.has(item.id)}
                      disabled={alreadyThere}
                      onCheckedChange={(v) => toggle(item.id, !!v)}
                    />
                    <span className="font-medium flex-1">{item.name}</span>
                    {item.detail && <span className="text-xs text-muted-foreground">{item.detail}</span>}
                    {alreadyThere && <Badge variant="secondary" className="text-[10px]">Ya existe</Badge>}
                    {item.inactive && <Badge variant="outline" className="text-[10px]">Inactivo</Badge>}
                  </label>
                );
              })
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => copy.mutate()} disabled={selected.size === 0 || copy.isPending}>
            {copy.isPending && <Loader2 className="animate-spin h-4 w-4 mr-1" />}
            Copiar {selected.size} {nounFor(selected.size)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
