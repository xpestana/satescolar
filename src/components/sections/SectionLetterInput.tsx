import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SectionLetterInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  isTechnical: boolean;
  onTechnicalChange: (value: boolean) => void;
  /** Hides the "Técnica" checkbox for grades that cannot be technical. */
  allowTechnical: boolean;
  onAdd: () => void;
  autoFocus?: boolean;
}

/** One-letter section input with the optional "Técnica" checkbox and the add button. */
export function SectionLetterInput({
  id,
  value,
  onChange,
  isTechnical,
  onTechnicalChange,
  allowTechnical,
  onAdd,
  autoFocus,
}: SectionLetterInputProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        id={id}
        placeholder="Ej: A"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
        maxLength={1}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onAdd();
          }
        }}
        className="h-9 text-center uppercase w-16"
        autoFocus={autoFocus}
      />
      {allowTechnical && (
        <div className="flex items-center gap-1.5">
          <Checkbox
            id={`${id}-technical`}
            checked={isTechnical}
            onCheckedChange={(checked) => onTechnicalChange(checked === true)}
          />
          <Label htmlFor={`${id}-technical`} className="text-sm font-normal cursor-pointer">
            Técnica
          </Label>
        </div>
      )}
      <Button type="button" size="sm" onClick={onAdd} disabled={!value.trim()} className="h-9">
        +
      </Button>
    </div>
  );
}
