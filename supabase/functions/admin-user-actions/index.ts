import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generatePassword, sendWelcomeEmail, type WelcomeRole } from "../_shared/welcome-email.ts";

// Evita que un error interno de SMTP/TLS tumbe el worker.
if (typeof addEventListener === "function") {
  addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
    console.error("[admin-user-actions] unhandledrejection:", e?.reason ?? e);
    e?.preventDefault?.();
  });
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Acciones del administrador de la plataforma sobre cuentas de colegio, docentes y representantes:
 * - reset_and_welcome: genera una contraseña nueva y reenvía el correo de bienvenida.
 * - update_name: guarda el nombre en profiles y en los metadatos de la cuenta
 *   (la RLS de profiles no deja al admin escribir perfiles ajenos desde el navegador).
 */
export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "No autorizado" }, 401);

    const { data: caller, error: authError } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !caller?.user) return json({ error: "Token inválido" }, 401);

    const { data: isAdmin } = await admin
      .from("user_roles")
      .select("id")
      .eq("user_id", caller.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!isAdmin) return json({ error: "Acceso denegado: se requiere rol de administrador" }, 403);

    const body = await req.json();
    const { action, user_id } = body ?? {};
    if (typeof user_id !== "string" || !UUID_RE.test(user_id)) return json({ error: "user_id inválido" }, 400);

    const { data: roleRows } = await admin
      .from("user_roles")
      .select("role, school_id")
      .eq("user_id", user_id);
    const roles = (roleRows ?? []) as { role: string; school_id: string | null }[];
    // Las cuentas de administrador de la plataforma se gestionan en otra pantalla.
    if (roles.some((r) => r.role === "admin")) {
      return json({ error: "No se puede modificar una cuenta de administrador desde aquí" }, 403);
    }

    const { data: target } = await admin.auth.admin.getUserById(user_id);
    if (!target?.user) return json({ error: "Usuario no encontrado" }, 404);

    if (action === "update_name") {
      const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
      if (!fullName) return json({ error: "El nombre es requerido" }, 400);

      const { error: profileError } = await admin
        .from("profiles")
        .upsert({ user_id, full_name: fullName }, { onConflict: "user_id" });
      if (profileError) {
        console.error("[admin-user-actions] profiles:", profileError);
        return json({ error: "No se pudo guardar el nombre" }, 500);
      }
      await admin.auth.admin.updateUserById(user_id, {
        user_metadata: { ...(target.user.user_metadata ?? {}), full_name: fullName },
      });
      return json({ success: true });
    }

    if (action === "reset_and_welcome") {
      const email = target.user.email;
      if (!email) return json({ error: "La cuenta no tiene correo" }, 400);

      // Rol y colegio para el texto del correo: colegio > docente > representante.
      const byRole = (r: string) => roles.find((x) => x.role === r);
      const schoolRole = byRole("school");
      const teacherRole = byRole("teacher");
      let welcomeRole: WelcomeRole;
      let schoolId: string | null = null;
      if (schoolRole) {
        welcomeRole = "administrador";
        schoolId = schoolRole.school_id ?? null;
      } else if (teacherRole) {
        welcomeRole = "docente";
        schoolId = teacherRole.school_id ?? null;
        if (!schoolId) {
          const { data: t } = await admin.from("teachers").select("school_id").eq("user_id", user_id).limit(1).maybeSingle();
          schoolId = t?.school_id ?? null;
        }
      } else if (byRole("representative")) {
        welcomeRole = "representante";
        const { data: fam } = await admin.from("families").select("id").eq("user_id", user_id).limit(1).maybeSingle();
        if (fam) {
          const { data: fs } = await admin.from("family_schools").select("school_id").eq("family_id", fam.id).limit(1).maybeSingle();
          schoolId = fs?.school_id ?? null;
        }
      } else {
        return json({ error: "El usuario no tiene un rol de colegio, docente o representante" }, 400);
      }

      const password = generatePassword();
      const { error: updateError } = await admin.auth.admin.updateUserById(user_id, { password });
      if (updateError) {
        console.error("[admin-user-actions] password:", updateError);
        return json({ error: "Error al actualizar la contraseña" }, 500);
      }

      const welcome = await sendWelcomeEmail(admin, {
        schoolId,
        email,
        password,
        role: welcomeRole,
        fullName: (target.user.user_metadata as { full_name?: string } | undefined)?.full_name ?? null,
      });
      return json({
        success: true,
        email,
        password,
        email_sent: welcome.sent,
        email_error: welcome.error ?? null,
      });
    }

    return json({ error: "Acción inválida" }, 400);
  } catch (e) {
    console.error("[admin-user-actions] Error:", e);
    return json({ error: "Error interno del servidor" }, 500);
  }
}

if (import.meta.main) Deno.serve(handler);
