import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { findUserByEmail, normalizeEmail } from "../_shared/authUsers.ts";
import { getCallerRole } from "../_shared/callerRole.ts";
import { sendWelcomeEmail } from "../_shared/welcome-email.ts";

// Prevent SMTP/TLS internal errors from crashing the edge worker.
if (typeof addEventListener === "function") {
  addEventListener("unhandledrejection", (e: any) => {
    console.error("[create-teacher] unhandledrejection swallowed:", e?.reason ?? e);
    e?.preventDefault?.();
  });
  addEventListener("error", (e: any) => {
    console.error("[create-teacher] uncaught error swallowed:", e?.error ?? e?.message ?? e);
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
    if (!callerRole?.school_id) return json({ error: "No tiene permisos para crear docentes" }, 403);
    const schoolId = callerRole.school_id;

    const { email: rawEmail, form_data, photo_url, document_id, phone } = await req.json();
    const email = typeof rawEmail === "string" ? normalizeEmail(rawEmail) : "";

    if (!email || !document_id) {
      return json({ error: "El correo electrónico y el documento son requeridos" }, 400);
    }

    // The initial password is the document number without its prefix (V-12345678 → 12345678).
    const rawDocument = document_id.includes("-") ? document_id.split("-").slice(1).join("-") : document_id;
    const teacherPassword = rawDocument;

    const existingUser = await findUserByEmail(supabaseAdmin, email);

    let userId: string;
    let createdUser = false;
    let createdRoleId: string | null = null;

    if (existingUser) {
      userId = existingUser.id;

      const { data: existingTeacher } = await supabaseAdmin
        .from("teachers")
        .select("id")
        .eq("user_id", userId)
        .eq("school_id", schoolId)
        .maybeSingle();

      if (existingTeacher) {
        return json({ error: "Ya existe un docente con este correo en esta institución" }, 400);
      }

      const { data: existingRole } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role", "teacher")
        .eq("school_id", schoolId)
        .limit(1)
        .maybeSingle();

      if (!existingRole) {
        const { data: newRole, error: roleError } = await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: userId, role: "teacher", school_id: schoolId })
          .select("id")
          .single();
        if (roleError) {
          console.error("Error adding teacher role:", roleError);
          return json({ error: "Error al asignar rol al usuario" }, 500);
        }
        createdRoleId = newRole.id;
      }
    } else {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: teacherPassword,
        email_confirm: true,
      });

      if (createError || !newUser.user) {
        console.error("Error creating user:", createError);
        const weakPassword = /password/i.test(createError?.message ?? "");
        return json({
          error: weakPassword
            ? "No se pudo crear la cuenta: el número de documento no sirve como contraseña inicial (muy corto)"
            : "Error al crear el usuario",
        }, weakPassword ? 400 : 500);
      }

      userId = newUser.user.id;
      createdUser = true;

      const { error: roleInsertError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role: "teacher", school_id: schoolId });

      if (roleInsertError) {
        console.error("Error creating role:", roleInsertError);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return json({ error: "Error al asignar rol al usuario" }, 500);
      }
    }

    const { data: teacher, error: teacherError } = await supabaseAdmin
      .from("teachers")
      .insert({
        user_id: userId,
        school_id: schoolId,
        form_data: form_data || {},
        photo_url: photo_url || null,
        document_id: document_id || null,
        phone: phone || null,
        email,
      })
      .select()
      .single();

    if (teacherError) {
      console.error("Error creating teacher:", teacherError);
      // Undo what this request created so the account is not left with a role and no teacher record.
      if (createdUser) {
        await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
        await supabaseAdmin.auth.admin.deleteUser(userId);
      } else if (createdRoleId) {
        await supabaseAdmin.from("user_roles").delete().eq("id", createdRoleId);
      }
      return json({ error: "Error al crear el docente" }, 500);
    }

    if (!createdUser) {
      return json({
        success: true,
        teacher,
        existing_user: true,
        email_sent: false,
        message: "Docente creado. La cuenta ya existía y conserva su contraseña actual.",
      });
    }

    // Awaited so the screen can say whether it went out; a failed email never undoes the teacher.
    const welcome = await sendWelcomeEmail(supabaseAdmin, {
      schoolId,
      email,
      password: teacherPassword,
      role: "docente",
    });
    return json({
      success: true,
      teacher,
      existing_user: false,
      password: teacherPassword,
      email_sent: welcome.sent,
      email_error: welcome.error ?? null,
      message: welcome.sent
        ? `Docente creado. Se envió el correo de bienvenida a ${email}. Contraseña temporal: ${teacherPassword}`
        : `Docente creado, pero no se pudo enviar el correo de bienvenida (${welcome.error ?? "error desconocido"}). ` +
          `Contraseña temporal: ${teacherPassword}. Puede reenviarlo desde la lista de docentes.`,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return json({ error: "Error interno del servidor" }, 500);
  }
}

if (import.meta.main) Deno.serve(handler);
