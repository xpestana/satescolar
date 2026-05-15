import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  receiptUrl: string | null; // storage path: {school_id}/{family_id}/{file}
  title?: string;
}

export function ReceiptViewerModal({ open, onOpenChange, receiptUrl, title = "Capture del pago" }: Props) {
  const [signed, setSigned] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!open || !receiptUrl) { setSigned(null); return; }
      setLoading(true);
      try {
        // receiptUrl can be a full URL or a storage path
        if (/^https?:\/\//.test(receiptUrl)) {
          if (!cancelled) setSigned(receiptUrl);
        } else {
          const { data, error } = await supabase.storage
            .from("payment-receipts")
            .createSignedUrl(receiptUrl, 60 * 30);
          if (error) throw error;
          if (!cancelled) setSigned(data?.signedUrl || null);
        }
      } catch (e) {
        if (!cancelled) setSigned(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [open, receiptUrl]);

  const isPdf = signed?.toLowerCase().includes(".pdf");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{title}</span>
            {signed && (
              <div className="flex gap-2 mr-8">
                <Button size="sm" variant="outline" asChild>
                  <a href={signed} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3 mr-1" />Abrir</a>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a href={signed} download><Download className="h-3 w-3 mr-1" />Descargar</a>
                </Button>
              </div>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto bg-muted/40 rounded-md flex items-center justify-center min-h-[400px]">
          {loading && <Loader2 className="h-6 w-6 animate-spin" />}
          {!loading && !signed && <p className="text-sm text-muted-foreground">No se pudo cargar el capture</p>}
          {!loading && signed && !isPdf && (
            <img src={signed} alt="Capture" className="max-w-full max-h-[75vh] object-contain" />
          )}
          {!loading && signed && isPdf && (
            <iframe src={signed} title="receipt" className="w-full h-[75vh]" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
