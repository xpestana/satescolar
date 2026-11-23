import { useEffect, useState } from "react";
import { Loader2, Plus, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useClientAccountMutations } from "@/hooks/clients/useClientAccountMutations";

interface ClientObservationsPopoverProps {
  accountId: string;
  schoolName: string;
  observations: string | null;
}

/** Observations shown right in the clients list: a preview, and a popover to read and edit them. */
export function ClientObservationsPopover({ accountId, schoolName, observations }: ClientObservationsPopoverProps) {
  const { updateAccount } = useClientAccountMutations(accountId);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const current = observations?.trim() ?? "";

  useEffect(() => {
    if (open) setText(observations ?? "");
  }, [open, observations]);

  const save = async () => {
    try {
      await updateAccount.mutateAsync({ observations: text.trim() || null });
      toast.success("Observaciones guardadas");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron guardar las observaciones");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {current ? (
          <button
            type="button"
            className="flex max-w-[280px] items-start gap-1.5 rounded-md p-1 text-left text-xs text-muted-foreground hover:bg-amber-50"
            aria-label={`Ver observaciones de ${schoolName}`}
          >
            <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
            <span className="line-clamp-2 whitespace-pre-line">{current}</span>
          </button>
        ) : (
          <button
            type="button"
            className="flex items-center gap-1 rounded-md p-1 text-xs text-muted-foreground/70 hover:bg-muted hover:text-foreground"
            aria-label={`Agregar observaciones a ${schoolName}`}
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar nota
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-96" align="start">
        <p className="mb-2 text-sm font-semibold">Observaciones · {schoolName}</p>
        <Textarea
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Acuerdos, forma de pago, a quién cobrarle..."
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Cerrar
          </Button>
          <Button size="sm" onClick={save} disabled={updateAccount.isPending || text === (observations ?? "")}>
            {updateAccount.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
