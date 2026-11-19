import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { findUserByEmail, normalizeEmail } from "../_shared/authUsers.ts";
import { getCallerRole } from "../_shared/callerRole.ts";
import { generatePassword, sendWelcomeEmail } from "../_shared/welcome-email.ts";

// Prevent SMTP/TLS internal errors from crashing the edge worker.
if (typeof addEventListener === "function") {
  addEventListener("unhandledrejection", (e: any) => {
    console.error("[create-family] unhandledrejection swallowed:", e?.reason ?? e);
    e?.preventDefault?.();
  });
  addEventListener("error", (e: any) => {
    console.error("[create-family] uncaught error swallowed:", e?.error ?? e?.message ?? e);
    e?.preventDefault?.();
  });
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

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

    // Only school staff (a staff member may also be a representative: several user_roles rows).
    const callerRole = await getCallerRole(supabaseAdmin, user.id, ["school"], { requireSchool: true });
    if (!callerRole?.school_id) return json({ error: "No tiene permisos para crear familias" }, 403);
    const schoolId = callerRole.school_id;

    const body = await req.json();
    const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
    if (!email) return json({ error: "El correo electrónico es requerido" }, 400);

    const existingUser = await findUserByEmail(supabaseAdmin, email);

    let userId: string;
    let createdUser = false;
    let password: string | null = null;

    if (existingUser) {
      userId = existingUser.id;

      // Block if the account already has a non-representative role (admin, school, teacher).
      const { data: existingRoles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      const nonRepRoles = (existingRoles || []).filter((r) => r.role !== "representative");
      if (nonRepRoles.length > 0) {
        return json({
          error: "Este correo pertenece a una cuenta administrativa o docente. Use un correo diferente para la familia.",
        }, 400);
      }

      const { data: userFamilies } = await supabaseAdmin
        .from("families")
        .select("id")
        .eq("user_id", userId);

      if (userFamilies && userFamilies.length > 0) {
        const familyIds = userFamilies.map((f) => f.id);

        const { data: existingAssoc } = await supabaseAdmin
          .from("family_schools")
          .select("id")
          .eq("school_id", schoolId)
          .in("family_id", familyIds)
          .limit(1)
          .maybeSingle();

        if (existingAssoc) {
          return json({ error: "Ya existe una familia con este correo en esta institución" }, 400);
        }

        // Associate the existing family to this school.
        const familyId = userFamilies[0].id;
        const { error: assocError } = await supabaseAdmin
          .from("family_schools")
          .insert({ family_id: familyId, school_id: schoolId });

        if (assocError) {
          console.error("Error associating family to school:", assocError);
          return json({ error: "Error al asociar la familia al colegio" }, 500);
        }

        await supabaseAdmin
          .from("user_roles")
          .upsert(
            { user_id: userId, role: "representative", school_id: schoolId },
            { onConflict: "user_id,role,school_id", ignoreDuplicates: true },
          );

        return json({
          success: true,
          family: { id: familyId },
          existing_user: true,
          email_sent: false,
          message: "La familia ya existía en otro colegio y se asoció a esta institución. Conserva su contraseña actual.",
        });
      }

      // User exists but has no family: ensure the representative role, then create the family.
      await supabaseAdmin
        .from("user_roles")
        .upsert(
          { user_id: userId, role: "representative", school_id: schoolId },
          { onConflict: "user_id,role,school_id", ignoreDuplicates: true },
        );
    } else {
      password = generatePassword();
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (createError || !newUser.user) {
        console.error("Error creating user:", createError);
        return json({ error: "Error al crear el usuario" }, 500);
      }

      userId = newUser.user.id;
      createdUser = true;

      const { error: roleInsertError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role: "representative", school_id: schoolId });

      if (roleInsertError) {
        console.error("Error creating role:", roleInsertError);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return json({ error: "Error al asignar rol al usuario" }, 500);
      }
    }

    /** Undo an account created in this request so a retry starts clean. */
    const rollbackNewUser = async () => {
      if (!createdUser) return;
      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
    };

    const { data: family, error: familyError } = await supabaseAdmin
      .from("families")
      .insert({ user_id: userId })
      .select()
      .single();

    if (familyError) {
      console.error("Error creating family:", familyError);
      await rollbackNewUser();
      return json({ error: "Error al crear la familia" }, 500);
    }

    const { error: assocError } = await supabaseAdmin
      .from("family_schools")
      .insert({ family_id: family.id, school_id: schoolId });

    if (assocError) {
      console.error("Error creating family-school association:", assocError);
      await supabaseAdmin.from("families").delete().eq("id", family.id);
      await rollbackNewUser();
      return json({ error: "Error al asociar la familia al colegio" }, 500);
    }

    // Welcome email only for new accounts. Awaited so the screen can say whether it went out;
    // a failed email never undoes the family (it can be resent from the list).
    if (!password) {
      return json({
        success: true,
        family,
        existing_user: true,
        email_sent: false,
        message: "Familia creada. La cuenta ya existía y conserva su contraseña actual.",
      });
    }

    const welcome = await sendWelcomeEmail(supabaseAdmin, { schoolId, email, password, role: "representante" });
    return json({
      success: true,
      family,
      existing_user: false,
      password,
      email_sent: welcome.sent,
      email_error: welcome.error ?? null,
      message: welcome.sent
        ? `Familia creada. Se envió el correo de bienvenida a ${email}. Contraseña temporal: ${password}`
        : `Familia creada, pero no se pudo enviar el correo de bienvenida (${welcome.error ?? "error desconocido"}). ` +
          `Contraseña temporal: ${password}. Puede reenviarlo desde la lista de familias.`,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return json({ error: "Error interno del servidor" }, 500);
  }
}

if (import.meta.main) Deno.serve(handler);
