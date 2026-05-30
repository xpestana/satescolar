import { useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Minus,
  Link,
  Undo,
  Redo,
  Table,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";

export interface RichTextEditorHandle {
  insertAtCursor: (text: string) => void;
}

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  className?: string;
}

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
function RichTextEditor({
  value,
  onChange,
  placeholder = "Escribe tu mensaje aquí...",
  minHeight = 250,
  className = "",
}, ref) {
  const editorRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    insertAtCursor(text: string) {
      editorRef.current?.focus();
      document.execCommand("insertText", false, text);
      setTimeout(() => {
        if (editorRef.current) onChange(editorRef.current.innerHTML);
      }, 0);
    },
  }));
  const isInternalChangeRef = useRef(false);

  useEffect(() => {
    if (isInternalChangeRef.current) {
      isInternalChangeRef.current = false;
      return;
    }
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value || "";
    }
  }, [value]);

  const exec = useCallback((command: string, val?: string) => {
    document.execCommand(command, false, val);
    editorRef.current?.focus();
    setTimeout(() => {
      if (editorRef.current) onChange(editorRef.current.innerHTML);
    }, 0);
  }, [onChange]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      isInternalChangeRef.current = true;
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handleLink = useCallback(() => {
    const url = prompt("URL del enlace:", "https://");
    if (url) exec("createLink", url);
  }, [exec]);

  const handleInsertTable = useCallback(() => {
    const tableHtml = `<table style="width:100%;border-collapse:collapse;margin:8px 0"><tbody><tr><td style="border:1px solid #d1d5db;padding:4px 8px">&nbsp;</td><td style="border:1px solid #d1d5db;padding:4px 8px">&nbsp;</td><td style="border:1px solid #d1d5db;padding:4px 8px">&nbsp;</td></tr><tr><td style="border:1px solid #d1d5db;padding:4px 8px">&nbsp;</td><td style="border:1px solid #d1d5db;padding:4px 8px">&nbsp;</td><td style="border:1px solid #d1d5db;padding:4px 8px">&nbsp;</td></tr><tr><td style="border:1px solid #d1d5db;padding:4px 8px">&nbsp;</td><td style="border:1px solid #d1d5db;padding:4px 8px">&nbsp;</td><td style="border:1px solid #d1d5db;padding:4px 8px">&nbsp;</td></tr></tbody></table><p><br></p>`;
    exec("insertHTML", tableHtml);
  }, [exec]);

  const ToolBtn = ({
    icon: Icon,
    command,
    value: val,
    title,
    onClick,
  }: {
    icon: any;
    command?: string;
    value?: string;
    title: string;
    onClick?: () => void;
  }) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-8 w-8 p-0"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        if (onClick) onClick();
        else if (command) exec(command, val);
      }}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );

  return (
    <div className={`border rounded-md overflow-hidden bg-background flex flex-col h-full ${className}`}>
      {/* Toolbar — always visible, never scrolls */}
      <div className="shrink-0 flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b bg-muted/30">
        <ToolBtn icon={Bold} command="bold" title="Negrita (Ctrl+B)" />
        <ToolBtn icon={Italic} command="italic" title="Cursiva (Ctrl+I)" />
        <ToolBtn icon={Underline} command="underline" title="Subrayado (Ctrl+U)" />
        <Separator orientation="vertical" className="h-6 mx-1" />
        <ToolBtn icon={Heading2} command="formatBlock" value="h2" title="Título" />
        <ToolBtn icon={Heading3} command="formatBlock" value="h3" title="Subtítulo" />
        <Separator orientation="vertical" className="h-6 mx-1" />
        <ToolBtn icon={List} command="insertUnorderedList" title="Lista con viñetas" />
        <ToolBtn icon={ListOrdered} command="insertOrderedList" title="Lista numerada" />
        <Separator orientation="vertical" className="h-6 mx-1" />
        <ToolBtn icon={AlignLeft} command="justifyLeft" title="Alinear izquierda" />
        <ToolBtn icon={AlignCenter} command="justifyCenter" title="Centrar" />
        <ToolBtn icon={AlignRight} command="justifyRight" title="Alinear derecha" />
        <ToolBtn icon={AlignJustify} command="justifyFull" title="Justificar" />
        <Separator orientation="vertical" className="h-6 mx-1" />
        <ToolBtn icon={Table} title="Insertar tabla (3×3)" onClick={handleInsertTable} />
        <ToolBtn icon={Link} title="Insertar enlace" onClick={handleLink} />
        <ToolBtn icon={Minus} command="insertHorizontalRule" title="Línea horizontal" />
        <Separator orientation="vertical" className="h-6 mx-1" />
        <ToolBtn icon={Undo} command="undo" title="Deshacer" />
        <ToolBtn icon={Redo} command="redo" title="Rehacer" />
      </div>

      {/* Editable area — scrolls independently */}
      <div
        ref={editorRef}
        contentEditable
        className="flex-1 overflow-y-auto px-4 py-3 outline-none prose prose-sm max-w-none text-foreground [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-primary [&_a]:underline [&_hr]:my-3 [&_hr]:border-border [&_table]:w-full [&_table]:border-collapse [&_table]:my-2 [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:bg-muted/30 [&_th]:font-semibold"
        style={{ minHeight }}
        onInput={handleInput}
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData("text/html") || e.clipboardData.getData("text/plain");
          document.execCommand("insertHTML", false, text);
        }}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />

      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: hsl(var(--muted-foreground));
          pointer-events: none;
        }
      `}</style>
    </div>
  );
});

RichTextEditor.displayName = "RichTextEditor";
