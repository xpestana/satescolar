import { useState } from "react";
import { Loader2, Plus, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ClientContact } from "@/hooks/clients/useClientAccount";
import type { SchoolOwnerContact } from "@/hooks/clients/useSchoolOwnerContacts";

interface ClientRecipientsCardProps {
  owners: SchoolOwnerContact[];
  notifyOwner: boolean;
  contacts: ClientContact[];
  onNotifyOwnerChange: (value: boolean) => void;
  onAddContact: (contact: { name: string; email: string; role_label: string }) => Promise<void>;
  onToggleContact: (id: string, isActive: boolean) => void;
  onRemoveContact: (id: string) => void;
  isAdding: boolean;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Who receives the billing emails: the school's main user (optional) and extra contacts. */
export function ClientRecipientsCard({
  owners,
  notifyOwner,
  contacts,
  onNotifyOwnerChange,
  onAddContact,
  onToggleContact,
  onRemoveContact,
  isAdding,
}: ClientRecipientsCardProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const emailValid = EMAIL_PATTERN.test(email.trim());

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailValid) return;
    try {
      await onAddContact({ name, email, role_label: role });
      setName("");
      setEmail("");
      setRole("");
    } catch {
      // The page shows the error toast.
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Destinatarios de cobro</CardTitle>
        <CardDescription>Todos reciben el mismo recordatorio y el mismo agradecimiento.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-lg border p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="notify-owner">Enviar al usuario principal</Label>
              <p className="text-xs text-muted-foreground">Desactívelo si el cobro no se le hace a esa persona.</p>
            </div>
            <Switch id="notify-owner" checked={notifyOwner} onCheckedChange={onNotifyOwnerChange} />
          </div>
          <div className="mt-3 space-y-1">
            {owners.length === 0 ? (
              <p className="text-sm text-orange-600">Este colegio aún no tiene usuario principal.</p>
            ) : (
              owners.map((o) => (
                <p key={o.userId} className={`flex items-center gap-2 text-sm ${notifyOwner ? "" : "text-muted-foreground line-through"}`}>
                  <UserRound className="h-4 w-4 shrink-0" />
                  <span className="break-all">
                    {o.fullName ? `${o.fullName} · ` : ""}
                    {o.email}
                  </span>
                </p>
              ))
            )}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Otros correos</p>
          {contacts.length === 0 && <p className="text-sm text-muted-foreground">No hay correos adicionales.</p>}
          {contacts.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
              <div className={`min-w-0 text-sm ${c.is_active ? "" : "text-muted-foreground line-through"}`}>
                <p className="break-all font-medium">{c.email}</p>
                {(c.name || c.role_label) && (
                  <p className="text-xs text-muted-foreground">{[c.name, c.role_label].filter(Boolean).join(" · ")}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Switch
                  checked={c.is_active}
                  onCheckedChange={(v) => onToggleContact(c.id, v)}
                  aria-label={c.is_active ? "Pausar envío" : "Reanudar envío"}
                />
                <Button variant="ghost" size="icon" onClick={() => onRemoveContact(c.id)} aria-label="Eliminar correo">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={add} className="space-y-2 rounded-lg bg-muted/40 p-3">
          <p className="text-sm font-medium">Agregar correo de cobro</p>
          <Input type="email" placeholder="correo@colegio.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <div className="grid gap-2 sm:grid-cols-2">
            <Input placeholder="Nombre (opcional)" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Cargo (p. ej. Administrador)" value={role} onChange={(e) => setRole(e.target.value)} />
          </div>
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={!emailValid || isAdding}>
              {isAdding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Agregar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
