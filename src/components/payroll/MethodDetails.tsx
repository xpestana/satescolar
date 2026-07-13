import { CopyButton } from "./CopyButton";
import { methodLabeledValues } from "@/lib/payroll/methodFields";
import { METHOD_LABELS, type PayrollMethodType } from "@/lib/payroll/types";

interface MethodLike {
  method_type: PayrollMethodType;
  label?: string | null;
  config: Record<string, unknown> | null;
}

/** A single labeled datum shown on its own line with a copy-to-clipboard button. */
export function CopyableField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className="font-medium truncate">{value}</span>
      <CopyButton value={value} label={label} />
    </div>
  );
}

interface MethodDetailsProps {
  method: MethodLike;
  /** Show the method type as a small heading above the fields. */
  showType?: boolean;
  className?: string;
}

/**
 * Renders a payment method's fields one per line — each with its own copy button
 * so the operator can copy a single datum (account number, phone…) at a time.
 */
export function MethodDetails({ method, showType, className }: MethodDetailsProps) {
  const values = methodLabeledValues(method);

  return (
    <div className={className}>
      {showType && (
        <p className="text-xs font-medium text-muted-foreground mb-1">
          {method.label || METHOD_LABELS[method.method_type]}
          {method.label ? ` · ${METHOD_LABELS[method.method_type]}` : ""}
        </p>
      )}
      {values.length === 0 ? (
        <p className="text-xs text-muted-foreground">{METHOD_LABELS[method.method_type]}</p>
      ) : (
        <div className="space-y-0.5">
          {values.map((v) => (
            <CopyableField key={v.label} label={v.label} value={v.value} />
          ))}
        </div>
      )}
    </div>
  );
}
