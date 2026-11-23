import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SendEmailConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subject: string;
  html: string;
  recipients: string[];
  isSending: boolean;
  onConfirm: () => void;
}

/** Shows the email exactly as it will go out and sends it on confirmation. */
export function SendEmailConfirmDialog({
  open,
  onOpenChange,
  title,
  subject,
  html,
  recipients,
  isSending,
  onConfirm,
}: SendEmailConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="space-y-1 text-left">
            <span className="block">
              <strong>Asunto:</strong> {subject}
            </span>
            <span className="block break-all">
              <strong>Para:</strong> {recipients.length ? recipients.join(", ") : "Sin destinatarios"}
            </span>
          </DialogDescription>
        </DialogHeader>
        <iframe title="Vista previa" srcDoc={html} className="h-[55vh] w-full rounded-md border" sandbox="" />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={isSending || recipients.length === 0}>
            {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Enviar correo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
