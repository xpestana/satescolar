import { forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toCertificateText } from "@/lib/grade-certificate";

/** Borderless input for the cells of the certificate tables. */
export const CERTIFICATE_CELL_INPUT =
  "h-8 px-2 text-sm border-0 shadow-none bg-transparent focus-visible:ring-1 focus-visible:ring-offset-0";

interface CertificateTextInputProps extends Omit<React.ComponentProps<"input">, "value" | "onChange"> {
  value: string;
  onValueChange: (value: string) => void;
  /** Applied when the field loses focus. By default: trimmed and in upper case, as the form prints it. */
  normalize?: (value: string) => string;
}

/**
 * Text field of the certificate. It shows upper case while typing and stores the normalized value
 * on blur, so the caret never jumps in the middle of a word.
 */
export const CertificateTextInput = forwardRef<HTMLInputElement, CertificateTextInputProps>(
  ({ value, onValueChange, normalize = toCertificateText, className, onBlur, ...props }, ref) => (
    <Input
      ref={ref}
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      onBlur={(event) => {
        const normalized = normalize(value);
        if (normalized !== value) onValueChange(normalized);
        onBlur?.(event);
      }}
      className={cn("uppercase placeholder:normal-case", className)}
      {...props}
    />
  ),
);
CertificateTextInput.displayName = "CertificateTextInput";
