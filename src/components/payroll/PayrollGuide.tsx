import { useState, type ReactNode } from "react";
import { ChevronDown, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export interface PayrollGuideContent {
  id: string;
  title: string;
  steps: ReactNode[];
  notes?: ReactNode[];
}

const storageKey = (id: string) => `payroll-guide-hidden:${id}`;

function wasHidden(id: string): boolean {
  try {
    return window.localStorage.getItem(storageKey(id)) === "1";
  } catch {
    return false;
  }
}

function rememberHidden(id: string, hidden: boolean) {
  try {
    if (hidden) window.localStorage.setItem(storageKey(id), "1");
    else window.localStorage.removeItem(storageKey(id));
  } catch {
    // Without storage the guide simply opens again next time.
  }
}

/** Step-by-step instructions of a payroll screen. Open until each person chooses to hide them. */
export function PayrollGuide({ guide, className }: { guide: PayrollGuideContent; className?: string }) {
  const [open, setOpen] = useState(() => !wasHidden(guide.id));

  const toggle = (next: boolean) => {
    setOpen(next);
    rememberHidden(guide.id, !next);
  };

  return (
    <Collapsible
      open={open}
      onOpenChange={toggle}
      className={cn("mb-4 rounded-lg border border-border/50 bg-muted/50 p-4", className)}
      data-guide={guide.id}
    >
      <div className="flex items-center gap-3">
        <Info className="h-5 w-5 flex-shrink-0 text-primary" />
        <p className="flex-1 text-sm font-medium text-foreground">{guide.title}</p>
        <CollapsibleTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-xs">
            {open ? "Ocultar" : "Ver instrucciones"}
            <ChevronDown className={cn("ml-1 h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div className="mt-2 space-y-2 pl-8 text-sm text-muted-foreground">
          <ol className="list-decimal space-y-1 pl-4">
            {guide.steps.map((step, index) => <li key={index}>{step}</li>)}
          </ol>
          {guide.notes && guide.notes.length > 0 && (
            <ul className="list-disc space-y-1 pl-4 text-xs">
              {guide.notes.map((note, index) => <li key={index}>{note}</li>)}
            </ul>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
