import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCallerRole } from "../_shared/callerRole.ts";
import { generatePassword, isSmtpConfigured, sendWelcomeEmail, type WelcomeRole } from "../_shared/welcome-email.ts";

// Prevent SMTP/TLS internal errors from crashing the edge worker.
if (typeof addEventListener === "function") {
  addEventListener("unhandledrejection", (e: any) => {
    console.error("[resend-welcome-email] unhandledrejection swallowed:", e?.reason ?? e);
    e?.preventDefault?.();
  });
  addEventListener("error", (e: any) => {
    console.error("[resend-welcome-email] uncaught error swallowed:", e?.error ?? e?.message ?? e);
    e?.preventDefault?.();
  });
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/**
 * Generates new credentials for a family or a teacher of the caller's school and emails them.
 * The new password is always returned, so a failed email never leaves the user locked out.
 */
export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No autorizado" }, 401);

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user) return json({ error: "No autorizado" }, 401);

    const callerRole = await getCallerRole(supabaseAdmin, user.id, ["school", "admin"], { requireSchool: true });
    if (!callerRole?.school_id) return json({ error: "No tiene permisos" }, 403);
    const schoolId = callerRole.school_id;

    // target_type: "family" (family_id = families.id) or "teacher" (family_id = teachers.id)
    const { family_id, target_type } = await req.json();
    if (!family_id) return json({ error: "family_id es requerido" }, 400);

    let targetUserId: string;
    let targetEmail: string;
    let role: WelcomeRole;
    let teacherDocumentId: string | null = null;

    if (target_type === "teacher") {
      const { data: teacher, error: teacherError } = await supabaseAdmin
        .from("teachers")
        .select("user_id, email, document_id")
        .eq("id", family_id)
        .eq("school_id", schoolId)
        .maybeSingle();

      if (teacherError || !teacher || !teacher.user_id) return json({ error: "Docente no encontrado" }, 404);

      targetUserId = teacher.user_id;
      targetEmail = teacher.email || "";
      teacherDocumentId = teacher.document_id || null;
      role = "docente";
    } else {
      const { data: family, error: familyError } = await supabaseAdmin
        .from("families")
        .select("user_id")
        .eq("id", family_id)
        .maybeSingle();

      if (familyError || !family) return json({ error: "Familia no encontrada" }, 404);

      const { data: familySchool } = await supabaseAdmin
        .from("family_schools")
        .select("id")
        .eq("family_id", family_id)
        .eq("school_id", schoolId)
        .limit(1)
        .maybeSingle();

      if (!familySchool) return json({ error: "No tiene permisos sobre esta familia" }, 403);

      targetUserId = family.user_id;
      role = "representante";

      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
      targetEmail = authUser?.user?.email || "";
    }

    if (!targetEmail) return json({ error: "No se encontró el correo del usuario" }, 400);

    // Check BEFORE touching the password: if mail cannot go out, keep the current password.
    if (!isSmtpConfigured()) {
      return json({ error: "El envío de correos no está configurado en el servidor. No se cambió la contraseña." }, 503);
    }

    // Teachers: the document number (without prefix) as before; families: a random password.
    let newPassword: string;
    if (target_type === "teacher" && teacherDocumentId) {
      newPassword = teacherDocumentId.includes("-")
        ? teacherDocumentId.split("-").slice(1).join("-")
        : teacherDocumentId;
    } else {
      newPassword = generatePassword();
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
      password: newPassword,
    });
    if (updateError) {
      console.error("Error updating password:", updateError);
      return json({ error: "Error al actualizar la contraseña" }, 500);
    }

    const welcome = await sendWelcomeEmail(supabaseAdmin, {
      schoolId,
      email: targetEmail,
      password: newPassword,
      role,
    });

    return json({
      success: true,
      email: targetEmail,
      newPassword,
      email_sent: welcome.sent,
      email_error: welcome.error ?? null,
      message: welcome.sent
        ? `Correo de bienvenida reenviado a ${targetEmail}. Nueva contraseña generada.`
        : `Se generó una contraseña nueva, pero no se pudo enviar el correo a ${targetEmail} ` +
          `(${welcome.error ?? "error desconocido"}). Contraseña nueva: ${newPassword}`,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return json({ error: "Error interno del servidor" }, 500);
  }
}

if (import.meta.main) Deno.serve(handler);
