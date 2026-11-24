import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TechnicalSectionFields } from "./TechnicalSectionFields";

interface SectionLetterInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  isTechnical: boolean;
  onTechnicalChange: (value: boolean) => void;
  specialty: string;
  onSpecialtyChange: (value: string) => void;
  /** Hides the "Técnica" fields for grades that cannot be technical. */
  allowTechnical: boolean;
  onAdd: () => void;
  autoFocus?: boolean;
}

/** One-letter section input with the optional "Técnica" fields and the add button. */
export function SectionLetterInput({
  id,
  value,
  onChange,
  isTechnical,
  onTechnicalChange,
  specialty,
  onSpecialtyChange,
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
      <Button type="button" size="sm" onClick={onAdd} disabled={!value.trim()} className="h-9">
        +
      </Button>
      {allowTechnical && (
        <TechnicalSectionFields
          id={id}
          isTechnical={isTechnical}
          onTechnicalChange={onTechnicalChange}
          specialty={specialty}
          onSpecialtyChange={onSpecialtyChange}
          onEnter={onAdd}
        />
      )}
    </div>
  );
}
