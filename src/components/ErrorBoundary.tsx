import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary] Uncaught error:", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleBack = () => {
    this.setState({ hasError: false, error: null });
    window.history.back();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md w-full bg-white border border-border rounded-lg shadow-sm p-6 text-center space-y-4">
            <div className="flex justify-center">
              <AlertTriangle className="h-12 w-12 text-destructive" />
            </div>
            <h1 className="text-lg font-semibold text-foreground">
              Ocurrió un error inesperado
            </h1>
            <p className="text-sm text-muted-foreground">
              La página no se pudo mostrar correctamente. Puedes recargar o
              volver atrás para continuar.
            </p>
            {this.state.error?.message && (
              <pre className="text-xs text-left bg-muted rounded p-2 overflow-auto max-h-40">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={this.handleBack}>
                Volver
              </Button>
              <Button onClick={this.handleReload}>Recargar</Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
