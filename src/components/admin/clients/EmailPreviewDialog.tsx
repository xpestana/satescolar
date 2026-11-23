import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface EmailPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: string;
  html: string;
  recipients: string[];
}

/** Shows an email exactly as it will be sent (same builder as the Edge Function). */
export function EmailPreviewDialog({ open, onOpenChange, subject, html, recipients }: EmailPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Vista previa del correo</DialogTitle>
          <DialogDescription className="space-y-1 text-left">
            <span className="block">
              <strong>Asunto:</strong> {subject}
            </span>
            <span className="block break-all">
              <strong>Para:</strong> {recipients.length ? recipients.join(", ") : "Sin destinatarios"}
            </span>
          </DialogDescription>
        </DialogHeader>
        <iframe title="Vista previa" srcDoc={html} className="h-[60vh] w-full rounded-md border" sandbox="" />
      </DialogContent>
    </Dialog>
  );
}
