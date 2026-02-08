import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface GeographicSelectProps {
  fieldName: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  stateId?: string;
  municipalityId?: string;
}

export function GeographicSelect({
  fieldName,
  placeholder,
  value,
  onChange,
  stateId,
  municipalityId,
}: GeographicSelectProps) {
  // Fetch states
  const { data: states = [] } = useQuery({
    queryKey: ["states"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("states")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: fieldName === "estado",
  });

  // Fetch municipalities based on state
  const { data: municipalities = [] } = useQuery({
    queryKey: ["municipalities", stateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("municipalities")
        .select("id, name")
        .eq("state_id", stateId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: fieldName === "municipio" && !!stateId,
  });

  // Fetch cities based on state
  const { data: cities = [] } = useQuery({
    queryKey: ["cities", stateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cities")
        .select("id, name")
        .eq("state_id", stateId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: fieldName === "ciudad" && !!stateId,
  });

  // Fetch parishes based on municipality
  const { data: parishes = [] } = useQuery({
    queryKey: ["parishes", municipalityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parishes")
        .select("id, name")
        .eq("municipality_id", municipalityId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: fieldName === "parroquia" && !!municipalityId,
  });

  const getOptions = () => {
    switch (fieldName) {
      case "estado":
        return states;
      case "municipio":
        return municipalities;
      case "ciudad":
        return cities;
      case "parroquia":
        return parishes;
      default:
        return [];
    }
  };

  const options = getOptions();
  const isDisabled = 
    (fieldName === "municipio" && !stateId) ||
    (fieldName === "ciudad" && !stateId) ||
    (fieldName === "parroquia" && !municipalityId);

  return (
    <Select
      value={value}
      onValueChange={onChange}
      disabled={isDisabled}
    >
      <SelectTrigger>
        <SelectValue placeholder={isDisabled ? "Seleccione primero el campo anterior" : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.id} value={opt.id}>
            {opt.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
