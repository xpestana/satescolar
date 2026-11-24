import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TechnicalSectionFieldsProps {
  id: string;
  isTechnical: boolean;
  onTechnicalChange: (value: boolean) => void;
  specialty: string;
  onSpecialtyChange: (value: string) => void;
  onEnter?: () => void;
}

/** "Técnica" checkbox; when checked, the specialty input appears right below it. */
export function TechnicalSectionFields({
  id,
  isTechnical,
  onTechnicalChange,
  specialty,
  onSpecialtyChange,
  onEnter,
}: TechnicalSectionFieldsProps) {
  return (
    <>
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
      {isTechnical && (
        <div className="basis-full space-y-1">
          <Label htmlFor={`${id}-specialty`} className="text-xs text-muted-foreground">
            Especialidad *
          </Label>
          <Input
            id={`${id}-specialty`}
            placeholder="Ej: Informática"
            value={specialty}
            maxLength={120}
            onChange={(e) => onSpecialtyChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && onEnter) {
                e.preventDefault();
                onEnter();
              }
            }}
            className="h-9"
          />
        </div>
      )}
    </>
  );
}
