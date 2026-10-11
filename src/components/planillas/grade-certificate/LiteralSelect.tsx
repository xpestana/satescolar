import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { CERTIFICATE_LITERALS } from "@/lib/grade-certificate";
import { PLANILLA_EMPTY } from "@/lib/resumen-final-text";

const NONE = "none";

interface LiteralSelectProps {
  value: string;
  onChange: (literal: string) => void;
  "aria-label": string;
}

/** Literal A–D of Orientación y Convivencia or of the group; empty prints as asterisks. */
export function LiteralSelect({ value, onChange, ...props }: LiteralSelectProps) {
  // A stored literal outside the usual scale stays selectable instead of disappearing.
  const options = value && !(CERTIFICATE_LITERALS as readonly string[]).includes(value)
    ? [...CERTIFICATE_LITERALS, value]
    : CERTIFICATE_LITERALS;

  return (
    <Select value={value || NONE} onValueChange={(next) => onChange(next === NONE ? "" : next)}>
      <SelectTrigger className="h-8 w-20 mx-auto text-sm" aria-label={props["aria-label"]}>
        {value ? <span className="font-semibold">{value}</span> : <span className="text-muted-foreground/60">{PLANILLA_EMPTY.nota}</span>}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Sin literal</SelectItem>
        {options.map((literal) => (
          <SelectItem key={literal} value={literal}>{literal}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
