import { useRef, useCallback, useEffect } from "react";
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
  Minus,
  Link,
  Undo,
  Redo,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Escribe tu mensaje aquí...",
  minHeight = 250,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  const exec = useCallback((command: string, val?: string) => {
    document.execCommand(command, false, val);
    editorRef.current?.focus();
    // Trigger change after command
    setTimeout(() => {
      if (editorRef.current) {
        onChange(editorRef.current.innerHTML);
      }
    }, 0);
  }, [onChange]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handleLink = useCallback(() => {
    const url = prompt("URL del enlace:", "https://");
    if (url) {
      exec("createLink", url);
    }
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
        e.preventDefault(); // Prevent losing selection
        if (onClick) onClick();
        else if (command) exec(command, val);
      }}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );

  return (
    <div className="border rounded-md overflow-hidden bg-background">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b bg-muted/30">
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
        <Separator orientation="vertical" className="h-6 mx-1" />
        <ToolBtn icon={Link} title="Insertar enlace" onClick={handleLink} />
        <ToolBtn icon={Minus} command="insertHorizontalRule" title="Línea horizontal" />
        <Separator orientation="vertical" className="h-6 mx-1" />
        <ToolBtn icon={Undo} command="undo" title="Deshacer" />
        <ToolBtn icon={Redo} command="redo" title="Rehacer" />
      </div>

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        className="px-4 py-3 outline-none prose prose-sm max-w-none text-foreground [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-primary [&_a]:underline [&_hr]:my-3 [&_hr]:border-border"
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
}
