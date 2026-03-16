import { cn } from "@/lib/utils";

interface TemplatePreviewProps {
  templateId: string;
  level: "preschool" | "primary" | "secondary";
  selected?: boolean;
  onClick?: () => void;
  name: string;
  description: string;
}

// Abstract miniature layouts for each template
function PreschoolClassic() {
  return (
    <div className="space-y-1">
      <div className="h-2 w-full rounded-sm bg-primary/30" />
      <div className="flex gap-1">
        <div className="h-6 w-1/3 rounded-sm bg-primary/15" />
        <div className="flex-1 space-y-0.5">
          <div className="h-1.5 w-full rounded-full bg-muted-foreground/20" />
          <div className="h-1.5 w-3/4 rounded-full bg-muted-foreground/20" />
          <div className="h-1.5 w-full rounded-full bg-muted-foreground/20" />
        </div>
      </div>
      <div className="h-4 w-full rounded-sm bg-muted/60" />
    </div>
  );
}

function PreschoolColorful() {
  return (
    <div className="space-y-1">
      <div className="h-2.5 w-full rounded-sm bg-gradient-to-r from-pink-300 to-yellow-200" />
      <div className="grid grid-cols-3 gap-0.5">
        <div className="h-3 rounded-sm bg-green-200/60" />
        <div className="h-3 rounded-sm bg-blue-200/60" />
        <div className="h-3 rounded-sm bg-purple-200/60" />
      </div>
      <div className="space-y-0.5">
        <div className="h-1.5 w-full rounded-full bg-muted-foreground/15" />
        <div className="h-1.5 w-2/3 rounded-full bg-muted-foreground/15" />
      </div>
    </div>
  );
}

function PreschoolMinimal() {
  return (
    <div className="space-y-1.5">
      <div className="h-1.5 w-2/3 rounded-full bg-muted-foreground/25" />
      <div className="space-y-0.5">
        <div className="h-1 w-full rounded-full bg-muted-foreground/10" />
        <div className="h-1 w-full rounded-full bg-muted-foreground/10" />
        <div className="h-1 w-4/5 rounded-full bg-muted-foreground/10" />
      </div>
      <div className="h-px w-full bg-border" />
      <div className="h-1 w-1/2 rounded-full bg-muted-foreground/10" />
    </div>
  );
}

function PrimaryClassic() {
  return (
    <div className="space-y-1">
      <div className="h-2 w-full rounded-sm bg-primary/25" />
      <div className="space-y-0.5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-1">
            <div className="h-1.5 flex-1 rounded-full bg-muted-foreground/20" />
            <div className="h-1.5 w-4 rounded-full bg-primary/20" />
          </div>
        ))}
      </div>
      <div className="h-3 w-full rounded-sm bg-muted/50" />
    </div>
  );
}

function PrimaryDetailed() {
  return (
    <div className="space-y-1">
      <div className="h-2.5 w-full rounded-sm bg-primary/20" />
      <div className="grid grid-cols-2 gap-0.5">
        <div className="space-y-0.5">
          <div className="h-1 w-full rounded-full bg-muted-foreground/15" />
          <div className="h-1 w-3/4 rounded-full bg-muted-foreground/15" />
        </div>
        <div className="space-y-0.5">
          <div className="h-1 w-full rounded-full bg-primary/15" />
          <div className="h-1 w-2/3 rounded-full bg-primary/15" />
        </div>
      </div>
      <div className="h-2 w-full rounded-sm bg-muted/40" />
      <div className="h-1 w-1/2 rounded-full bg-muted-foreground/10" />
    </div>
  );
}

function PrimaryCompact() {
  return (
    <div className="space-y-0.5">
      <div className="h-1.5 w-full rounded-sm bg-primary/30" />
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex gap-0.5">
          <div className="h-1 flex-1 rounded-full bg-muted-foreground/15" />
          <div className="h-1 w-3 rounded-full bg-muted-foreground/10" />
        </div>
      ))}
    </div>
  );
}

function SecondaryClassic() {
  return (
    <div className="space-y-1">
      <div className="h-2 w-full rounded-sm bg-primary/25" />
      <div className="space-y-0.5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-1">
            <div className="h-1.5 flex-1 rounded-full bg-muted-foreground/20" />
            <div className="h-1.5 w-3 rounded-full bg-primary/15" />
            <div className="h-1.5 w-3 rounded-full bg-primary/15" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SecondaryFormal() {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <div className="h-3 w-3 rounded-full bg-muted-foreground/20" />
        <div className="h-1.5 flex-1 rounded-full bg-muted-foreground/25" />
      </div>
      <div className="h-px w-full bg-border" />
      <div className="space-y-0.5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-1.5 w-full rounded-full bg-muted-foreground/12" />
        ))}
      </div>
      <div className="h-px w-full bg-border" />
    </div>
  );
}

function SecondaryModern() {
  return (
    <div className="space-y-1">
      <div className="h-2.5 w-full rounded-sm bg-gradient-to-r from-primary/20 to-primary/5" />
      <div className="grid grid-cols-3 gap-0.5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-2.5 rounded-sm bg-accent/40" />
        ))}
      </div>
      <div className="h-1 w-2/3 rounded-full bg-muted-foreground/15" />
    </div>
  );
}

const thumbnails: Record<string, Record<string, React.FC>> = {
  preschool: {
    classic: PreschoolClassic,
    colorful: PreschoolColorful,
    minimal: PreschoolMinimal,
  },
  primary: {
    classic: PrimaryClassic,
    detailed: PrimaryDetailed,
    compact: PrimaryCompact,
  },
  secondary: {
    classic: SecondaryClassic,
    formal: SecondaryFormal,
    modern: SecondaryModern,
  },
};

export function TemplatePreview({ templateId, level, selected, onClick, name, description }: TemplatePreviewProps) {
  const Thumb = thumbnails[level]?.[templateId];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col gap-1.5 rounded-lg border-2 p-2.5 text-left transition-all hover:shadow-sm",
        selected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border hover:border-primary/40"
      )}
    >
      <div className="w-full rounded bg-card p-2 border border-border/50">
        {Thumb ? <Thumb /> : <div className="h-8 bg-muted rounded" />}
      </div>
      <div>
        <p className="text-xs font-medium leading-tight">{name}</p>
        <p className="text-[10px] text-muted-foreground leading-tight">{description}</p>
      </div>
    </button>
  );
}
