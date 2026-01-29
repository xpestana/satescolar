import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Building2 } from "lucide-react";

interface School {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  rif: string;
  logo_url?: string | null;
  dea_code?: string;
  statistical_code?: string;
  fax?: string | null;
  url?: string | null;
  institution_type?: string;
}

interface SchoolDetailsModalProps {
  school: School | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SchoolDetailsModal({ school, open, onOpenChange }: SchoolDetailsModalProps) {
  if (!school) return null;

  const institutionTypeLabels: Record<string, string> = {
    public: "Público",
    private: "Privado",
    subsidized: "Subvencionado",
    other: "Otro",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl text-primary">
            Nombre: {school.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-8 mt-4">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Avatar className="h-32 w-32 border-2 border-muted">
              <AvatarImage src={school.logo_url || undefined} alt={school.name} />
              <AvatarFallback className="bg-muted">
                <Building2 className="h-16 w-16 text-muted-foreground" />
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Details Grid */}
          <div className="flex-1 grid grid-cols-3 gap-x-6 gap-y-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Rif</p>
              <p className="font-medium">{school.rif}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Código Estadístico</p>
              <p className="font-medium">{school.statistical_code || "-"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Código DEA</p>
              <p className="font-medium">{school.dea_code || "-"}</p>
            </div>

            <div className="col-span-3">
              <p className="text-muted-foreground text-xs">Dirección</p>
              <p className="font-medium">{school.address}</p>
            </div>

            <div>
              <p className="text-muted-foreground text-xs">Teléfono</p>
              <p className="font-medium">{school.phone}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Fax</p>
              <p className="font-medium">{school.fax || "-"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Tipo de Institución</p>
              <p className="font-medium">
                {school.institution_type 
                  ? institutionTypeLabels[school.institution_type] || school.institution_type 
                  : "-"}
              </p>
            </div>

            <div>
              <p className="text-muted-foreground text-xs">Correo Electrónico</p>
              <a href={`mailto:${school.email}`} className="font-medium text-primary hover:underline">
                {school.email}
              </a>
            </div>
            <div className="col-span-2">
              <p className="text-muted-foreground text-xs">Url</p>
              {school.url ? (
                <a 
                  href={school.url.startsWith("http") ? school.url : `https://${school.url}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  {school.url}
                </a>
              ) : (
                <p className="font-medium">-</p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
