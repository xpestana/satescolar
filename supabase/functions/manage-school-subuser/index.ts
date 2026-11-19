import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { findUserByEmail, normalizeEmail } from "../_shared/authUsers.ts";
import { generatePassword, sendWelcomeEmail } from "../_shared/welcome-email.ts";

// Evita que un error interno de SMTP/TLS tumbe el worker.
if (typeof addEventListener === "function") {
  addEventListener("unhandledrejection", (e: any) => {
    console.error("[manage-school-subuser] unhandledrejection:", e?.reason ?? e);
    e?.preventDefault?.();
  });
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const { data: schoolData } = await admin.from("schools").select("name").eq("id", schoolId).maybeSingle();
    const schoolName = schoolData?.name ?? "Colegio";

    // === CREATE === (owner or settings.users)
    if (action === "create") {
      if (!callerIsOwner && !callerHasSettingsUsers) {
        return new Response(JSON.stringify({ error: "No tienes permisos para crear usuarios" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { full_name, profile_ids, password: customPassword } = body;
      const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
      if (!email || !full_name) return new Response(JSON.stringify({ error: "Email y nombre son requeridos" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const password = (typeof customPassword === "string" && customPassword.length >= 8) ? customPassword : generatePassword();
      // Paginated lookup: listUsers() alone only sees the first 50 accounts.
      if (await findUserByEmail(admin, email)) {
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

      // Awaited so the screen can say whether the email went out (the password is shown anyway).
      const welcome = await sendWelcomeEmail(admin, { schoolId, email, password, role: "usuario del colegio", fullName: full_name });

      return new Response(JSON.stringify({ success: true, user_id: userId, password, email_sent: welcome.sent, email_error: welcome.error ?? null }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
      const { user_id, password: customPassword } = body;
      const { data: target } = await admin.from("user_roles").select("is_owner").eq("user_id", user_id).eq("school_id", schoolId).eq("role", "school").maybeSingle();
      if (!target || target.is_owner) return new Response(JSON.stringify({ error: "No autorizado" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const password = (typeof customPassword === "string" && customPassword.length >= 8) ? customPassword : generatePassword();
      const { data: u } = await admin.auth.admin.getUserById(user_id);
      const email = u?.user?.email;
      const { error: updateErr } = await admin.auth.admin.updateUserById(user_id, { password });
      if (updateErr) {
        console.error("[manage-school-subuser] password:", updateErr);
        return new Response(JSON.stringify({ error: "No se pudo cambiar la contraseña" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const welcome = email
        ? await sendWelcomeEmail(admin, {
          schoolId,
          email,
          password,
          role: "usuario del colegio",
          fullName: (u?.user?.user_metadata as { full_name?: string } | undefined)?.full_name ?? null,
          defaultSubject: `Nuevas credenciales - ${schoolName}`,
        })
        : { sent: false, error: "La cuenta no tiene correo" };

      return new Response(JSON.stringify({ success: true, password, email_sent: welcome.sent, email_error: welcome.error ?? null }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
