import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface CopyButtonProps {
  value: string;
  /** What to name the copied datum in the toast, e.g. "N° de cuenta". */
  label?: string;
  className?: string;
}

/** Small inline button that copies a single value to the clipboard. */
export function CopyButton({ value, label, className }: CopyButtonProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
      toast({ title: label ? `${label} copiado` : "Copiado", description: value });
    } catch {
      toast({ title: "No se pudo copiar", variant: "destructive" });
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`Copiar ${label ?? ""}`.trim()}
      className={cn(
        "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
        className
      )}
    >
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}
