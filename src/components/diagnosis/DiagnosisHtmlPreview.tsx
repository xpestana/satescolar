import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

/** Letter width at 96 dpi: the sheet is laid out at this width and scaled to fit the container. */
const PAGE_WIDTH_PX = 816;
const PAGE_HEIGHT_PX = 1056;

/**
 * Live preview of the diagnosis sheet as HTML (not PDF), so it is instant and also works on
 * phones, where a PDF inside an iframe often doesn't render. The iframe is sandboxed without
 * scripts; `allow-same-origin` only lets us read its height.
 */
export default function DiagnosisHtmlPreview({ html, loading }: { html: string | null; loading?: boolean }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(0.5);
  const [contentHeight, setContentHeight] = useState(PAGE_HEIGHT_PX);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(([entry]) => {
      setScale(Math.min(1, entry.contentRect.width / PAGE_WIDTH_PX));
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  const measure = () => {
    const body = frameRef.current?.contentDocument?.body;
    if (body) setContentHeight(Math.max(PAGE_HEIGHT_PX, body.scrollHeight));
  };

  return (
    <div ref={boxRef} className="relative w-full">
      {html ? (
        <div
          className="mx-auto overflow-hidden rounded-sm bg-white shadow-md ring-1 ring-border"
          style={{ width: PAGE_WIDTH_PX * scale, height: contentHeight * scale }}
        >
          <iframe
            ref={frameRef}
            title="Vista previa del diagnóstico"
            sandbox="allow-same-origin"
            srcDoc={html}
            onLoad={measure}
            className="border-0 origin-top-left"
            style={{ width: PAGE_WIDTH_PX, height: contentHeight, transform: `scale(${scale})` }}
          />
        </div>
      ) : (
        <div className="flex h-64 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "La vista previa aparecerá aquí."}
        </div>
      )}
      {html && loading && (
        <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}
