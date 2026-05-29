import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendViaSmtp } from "../_shared/smtp-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLATFORM_URL = "https://satescolar.lovable.app";

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let p = "";
  const arr = new Uint8Array(12);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 12; i++) p += chars[arr[i] % chars.length];
  return p;
}

function welcomeHtml(schoolName: string, logoUrl: string | null, email: string, password: string, fullName: string): string {
  const logo = logoUrl ? `<img src="${logoUrl}" alt="${schoolName}" style="max-height:80px;margin-bottom:12px;" />` : "";
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f7;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:32px 0;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;">
<tr><td align="center" style="padding:32px 24px 16px;background:#f8f9fc;border-bottom:1px solid #e8e8ed;">${logo}<h2 style="margin:0;font-size:20px;color:#1a1a2e;">${schoolName}</h2></td></tr>
<tr><td style="padding:32px;"><h1 style="margin:0 0 16px;font-size:22px;color:#1a1a2e;">Hola ${fullName},</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4a4a5a;">Has sido registrado/a como <strong>usuario escolar</strong> en <strong>${schoolName}</strong> con permisos específicos asignados por la administración del colegio.</p>
<p style="margin:0 0 8px;font-size:15px;color:#4a4a5a;">Tus credenciales:</p>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4ff;border-radius:8px;margin:12px 0 24px;"><tr><td style="padding:16px 20px;">
<p style="margin:0 0 6px;font-size:14px;color:#6b7280;">Usuario</p><p style="margin:0 0 12px;font-size:16px;font-weight:bold;color:#1a1a2e;">${email}</p>
<p style="margin:0 0 6px;font-size:14px;color:#6b7280;">Contraseña</p><p style="margin:0;font-size:16px;font-weight:bold;color:#1a1a2e;">${password}</p>
</td></tr></table>
<table width="100%"><tr><td align="center" style="padding:8px 0 16px;">
<a href="${PLATFORM_URL}" style="display:inline-block;padding:14px 32px;background:#1e78c8;color:#fff;font-weight:bold;text-decoration:none;border-radius:8px;">Ingresar a la Plataforma</a>
</td></tr></table>
<p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;">Te recomendamos cambiar tu contraseña al ingresar.</p></td></tr>
<tr><td align="center" style="padding:20px;background:#f8f9fc;border-top:1px solid #e8e8ed;"><p style="margin:0;font-size:13px;color:#6b7280;font-weight:bold;">SAT ESCOLAR</p></td></tr>
</table></td></tr></table></body></html>`;
}

async function sendEmail(to: string, schoolName: string, html: string, subject: string) {
  try {
    const host = Deno.env.get("SMTP_HOST") ?? "";
    const user = Deno.env.get("SMTP_USER") ?? "";
    const pass = Deno.env.get("SMTP_PASS") ?? "";
    const from = Deno.env.get("SMTP_FROM_EMAIL") ?? "";
    const fromName = Deno.env.get("SMTP_FROM_NAME") ?? "SAT Escolar";
    if (!host || !user || !pass || !from) { console.log("SMTP not configured"); return; }
    await sendViaSmtp({ from: `${fromName} <${from}>`, to: [to], subject, html });
  } catch (e) { console.error("Email failed:", e); }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const token = authHeader.replace("Bearer ", "");
    const { data: authUser, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !authUser?.user) return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const callerId = authUser.user.id;

    // Get caller's school role
    const { data: callerRole } = await admin
      .from("user_roles")
      .select("school_id, is_owner")
      .eq("user_id", callerId)
      .eq("role", "school")
      .maybeSingle();

    if (!callerRole?.school_id) {
      return new Response(JSON.stringify({ error: "No autorizado" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const schoolId = callerRole.school_id;
    const callerIsOwner = !!callerRole.is_owner;

    // Check if non-owner has settings.users permission
    let callerHasSettingsUsers = false;
    if (!callerIsOwner) {
      const { data: assigns } = await admin
        .from("school_user_profiles")
        .select("profile_id")
        .eq("user_id", callerId)
        .eq("school_id", schoolId);
      const profileIds = (assigns ?? []).map((a: any) => a.profile_id);
      if (profileIds.length > 0) {
        const { data: permItems } = await admin
          .from("permission_profile_items")
          .select("permission_key")
          .in("profile_id", profileIds)
          .eq("permission_key", "settings.users");
        callerHasSettingsUsers = (permItems?.length ?? 0) > 0;
      }
    }

    const body = await req.json();
    const { action } = body;

    const { data: schoolData } = await admin.from("schools").select("name, logo_url").eq("id", schoolId).single();
    const schoolName = schoolData?.name ?? "Colegio";
    const logoUrl = schoolData?.logo_url ?? null;

    // === CREATE === (owner only)
    if (action === "create") {
      if (!callerIsOwner) {
        return new Response(JSON.stringify({ error: "Solo el dueño del colegio puede crear usuarios" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { email, full_name, profile_ids, password: customPassword } = body;
      if (!email || !full_name) return new Response(JSON.stringify({ error: "Email y nombre son requeridos" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const password = (typeof customPassword === "string" && customPassword.length >= 8) ? customPassword : generatePassword();
      const { data: existing } = await admin.auth.admin.listUsers();
      if (existing?.users?.find(u => u.email === email)) {
        return new Response(JSON.stringify({ error: "Ya existe un usuario con este correo" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { full_name },
      });
      if (createErr || !newUser.user) return new Response(JSON.stringify({ error: "Error al crear usuario" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const userId = newUser.user.id;
      const { error: roleErr } = await admin.from("user_roles").insert({ user_id: userId, role: "school", school_id: schoolId, is_owner: false });
      if (roleErr) {
        await admin.auth.admin.deleteUser(userId);
        return new Response(JSON.stringify({ error: "Error al asignar rol" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (Array.isArray(profile_ids) && profile_ids.length > 0) {
        // Validar que todos los perfiles pertenezcan a este colegio
        const { data: validProfiles } = await admin
          .from("permission_profiles")
          .select("id")
          .eq("school_id", schoolId)
          .in("id", profile_ids);
        const validIds = new Set((validProfiles ?? []).map((p: any) => p.id));
        const filtered = profile_ids.filter((pid: string) => validIds.has(pid));
        if (filtered.length > 0) {
          await admin.from("school_user_profiles").insert(filtered.map((pid: string) => ({ user_id: userId, school_id: schoolId, profile_id: pid })));
        }
      }

      sendEmail(email, schoolName, welcomeHtml(schoolName, logoUrl, email, password, full_name), `Bienvenido a ${schoolName} - SAT Escolar`).catch(console.error);

      return new Response(JSON.stringify({ success: true, user_id: userId, password }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === UPDATE (profiles + name) === (owner or settings.users)
    if (action === "update") {
      if (!callerIsOwner && !callerHasSettingsUsers) {
        return new Response(JSON.stringify({ error: "No tienes permisos para editar usuarios" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { user_id, full_name, profile_ids } = body;
      if (!user_id) return new Response(JSON.stringify({ error: "user_id requerido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      // Verify target belongs to this school and is NOT owner
      const { data: target } = await admin.from("user_roles").select("id, is_owner").eq("user_id", user_id).eq("school_id", schoolId).eq("role", "school").maybeSingle();
      if (!target || target.is_owner) return new Response(JSON.stringify({ error: "Usuario no encontrado o es dueño" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      if (typeof full_name === "string") {
        await admin.auth.admin.updateUserById(user_id, { user_metadata: { full_name } });
      }

      if (Array.isArray(profile_ids)) {
        await admin.from("school_user_profiles").delete().eq("user_id", user_id).eq("school_id", schoolId);
        if (profile_ids.length > 0) {
          await admin.from("school_user_profiles").insert(profile_ids.map((pid: string) => ({ user_id, school_id: schoolId, profile_id: pid })));
        }
      }

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === RESET PASSWORD === (owner or settings.users)
    if (action === "reset_password") {
      if (!callerIsOwner && !callerHasSettingsUsers) {
        return new Response(JSON.stringify({ error: "No tienes permisos para resetear contraseñas" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { user_id } = body;
      const { data: target } = await admin.from("user_roles").select("is_owner").eq("user_id", user_id).eq("school_id", schoolId).eq("role", "school").maybeSingle();
      if (!target || target.is_owner) return new Response(JSON.stringify({ error: "No autorizado" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const password = generatePassword();
      const { data: u } = await admin.auth.admin.getUserById(user_id);
      const email = u?.user?.email;
      const fullName = (u?.user?.user_metadata as any)?.full_name ?? "Usuario";
      await admin.auth.admin.updateUserById(user_id, { password });

      if (email) sendEmail(email, schoolName, welcomeHtml(schoolName, logoUrl, email, password, fullName), `Nuevas credenciales - ${schoolName}`).catch(console.error);

      return new Response(JSON.stringify({ success: true, password }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === DELETE === (owner only)
    if (action === "delete") {
      if (!callerIsOwner) {
        return new Response(JSON.stringify({ error: "Solo el dueño del colegio puede eliminar usuarios" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { user_id } = body;
      const { data: target } = await admin.from("user_roles").select("is_owner").eq("user_id", user_id).eq("school_id", schoolId).eq("role", "school").maybeSingle();
      if (!target || target.is_owner) return new Response(JSON.stringify({ error: "No autorizado" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      await admin.from("school_user_profiles").delete().eq("user_id", user_id).eq("school_id", schoolId);
      await admin.from("user_roles").delete().eq("user_id", user_id).eq("school_id", schoolId).eq("role", "school");
      await admin.auth.admin.deleteUser(user_id);
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Acción inválida" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Unexpected:", e);
    return new Response(JSON.stringify({ error: "Error interno" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
}

if (import.meta.main) Deno.serve(handler);
