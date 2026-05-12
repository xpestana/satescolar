import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";

export default function AttendanceScan() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<"loading" | "success" | "duplicate" | "error">("loading");
  const [data, setData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("Token no proporcionado");
      return;
    }

    const record = async () => {
      try {
        const baseUrl = import.meta.env.VITE_SUPABASE_URL;
        const res = await fetch(
          `${baseUrl}/functions/v1/record-attendance`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          }
        );
        const json = await res.json();
        if (json.status === "success") {
          setStatus("success");
          setData(json);
        } else if (json.status === "duplicate") {
          setStatus("duplicate");
          setData(json);
        } else {
          setStatus("error");
          setErrorMsg(json.error || json.message || "Error desconocido");
        }
      } catch {
        setStatus("error");
        setErrorMsg("Error de conexión");
      }
    };

    record();
  }, [token]);

  const bgColor =
    status === "success" ? "bg-green-50" :
    status === "duplicate" ? "bg-amber-50" :
    status === "error" ? "bg-red-50" : "bg-white";

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${bgColor}`}>
      <div className="max-w-sm w-full bg-white rounded-2xl shadow-lg p-8 text-center space-y-4">
        {status === "loading" && (
          <>
            <Loader2 className="h-16 w-16 text-primary mx-auto animate-spin" />
            <p className="text-lg font-medium text-muted-foreground">Registrando asistencia...</p>
          </>
        )}

        {status === "success" && data && (
          <>
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-xl font-bold text-green-700">¡Asistencia Registrada!</h2>
            <div className="space-y-2 text-left bg-green-50 rounded-lg p-4">
              <p><span className="text-muted-foreground">Nombre:</span> <strong>{data.personName}</strong></p>
              <p><span className="text-muted-foreground">Rol:</span> <strong>{data.role}</strong></p>
              <p><span className="text-muted-foreground">Fecha:</span> {data.date}</p>
              <p><span className="text-muted-foreground">Hora:</span> {data.time}</p>
            </div>
          </>
        )}

        {status === "duplicate" && data && (
          <>
            <Clock className="h-16 w-16 text-amber-500 mx-auto" />
            <h2 className="text-xl font-bold text-amber-700">Ya Registrado</h2>
            <p className="text-muted-foreground">La asistencia ya fue registrada recientemente.</p>
            <div className="space-y-2 text-left bg-amber-50 rounded-lg p-4">
              <p><span className="text-muted-foreground">Nombre:</span> <strong>{data.personName}</strong></p>
              <p><span className="text-muted-foreground">Rol:</span> <strong>{data.role}</strong></p>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="h-16 w-16 text-red-500 mx-auto" />
            <h2 className="text-xl font-bold text-red-700">Error</h2>
            <p className="text-muted-foreground">{errorMsg}</p>
          </>
        )}

        <p className="text-xs text-muted-foreground pt-4">SAT ESCOLAR</p>
      </div>
    </div>
  );
}
