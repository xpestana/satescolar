import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Prevent stray rejections from tearing down the edge worker.
if (typeof addEventListener === "function") {
  addEventListener("unhandledrejection", (e: any) => {
    console.error("[import-school-data] unhandledrejection swallowed:", e?.reason ?? e);
    e?.preventDefault?.();
  });
  addEventListener("error", (e: any) => {
    console.error("[import-school-data] uncaught error swallowed:", e?.error ?? e?.message ?? e);
    e?.preventDefault?.();
  });
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map of the "Nivel/Grado/Año" label (as stored in student.form_data.nivel_grado)
// to the granular `grade_level` enum value used by the `sections` table.
const GRADE_LABEL_TO_LEVEL: Record<string, string> = {
  "I Nivel": "i_nivel",
  "II Nivel": "ii_nivel",
  "III Nivel": "iii_nivel",
  "1er Grado": "1_grado",
  "2do Grado": "2_grado",
  "3er Grado": "3_grado",
  "4to Grado": "4_grado",
  "5to Grado": "5_grado",
  "6to Grado": "6_grado",
  "1er Año": "1_ano",
  "2do Año": "2_ano",
  "3er Año": "3_ano",
  "4to Año": "4_ano",
  "5to Año": "5_ano",
  "6to Año": "6_ano",
};

interface ImportChild {
  document_id: string | null;
  tipo_documento: string;
  documento: string;
  primer_nombre: string;
  segundo_nombre: string;
  primer_apellido: string;
  segundo_apellido: string;
  genero: string;
  fecha_nacimiento: string;
  nivel_grado: string;
  calificacion: string;
  entidad_federal: string;
}

interface ImportRepresentative {
  email: string;
  cedula: string; // digits only, or ""
  tipo_documento: string;
  primer_nombre: string;
  segundo_nombre: string;
  primer_apellido: string;
  segundo_apellido: string;
  telefono: string;
  direccion: string;
  hijos: ImportChild[];
}

interface ImportTeacher {
  email: string;
  cedula: string; // digits only
  primer_nombre: string;
  segundo_nombre: string;
  primer_apellido: string;
  segundo_apellido: string;
  area_asignada: string;
  create_area: boolean;
}

function generateRandomPassword(length = 16): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join("");
}

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

    // ── Auth: admin only ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "No autorizado" }, 401);
    }

    const { data: { user: requestingUser }, error: authError } =
      await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));

    if (authError || !requestingUser) {
      return json({ error: "Token inválido" }, 401);
    }

    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUser.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminRole) {
      return json({ error: "Acceso denegado: se requiere rol de administrador" }, 403);
    }

    // ── Parse body ──
    const body = await req.json();
    const schoolId: string = body?.school_id;
    const yearRangeInput: string = body?.school_year || "2024-2025";
    const representantes: ImportRepresentative[] = Array.isArray(body?.representantes) ? body.representantes : [];
    const docentes: ImportTeacher[] = Array.isArray(body?.docentes) ? body.docentes : [];
    const subjectsToCreate: string[] = Array.isArray(body?.subjects_to_create) ? body.subjects_to_create : [];

    if (!schoolId) {
      return json({ error: "school_id es requerido" }, 400);
    }

    const { data: school, error: schoolError } = await supabaseAdmin
      .from("schools")
      .select("id, name")
      .eq("id", schoolId)
      .maybeSingle();

    if (schoolError || !school) {
      return json({ error: "El colegio indicado no existe" }, 400);
    }

    // ── Report accumulators ──
    const created: string[] = [];
    const skipped: string[] = [];
    const failed: string[] = [];
    const summary = {
      familiasCreadas: 0,
      familiasOmitidas: 0,
      representantesCreados: 0,
      estudiantesCreados: 0,
      estudiantesOmitidos: 0,
      inscripcionesCreadas: 0,
      docentesCreados: 0,
      docentesOmitidos: 0,
      areasCreadas: 0,
      asignacionesCreadas: 0,
      errores: 0,
    };

    // ── Build email -> auth user id map (paginated, reliable dedup) ──
    const emailToUserId = new Map<string, string>();
    {
      let page = 1;
      const perPage = 1000;
      // deno-lint-ignore no-constant-condition
      while (true) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
        if (error) break;
        const users = data?.users ?? [];
        for (const u of users) {
          if (u.email) emailToUserId.set(u.email.toLowerCase(), u.id);
        }
        if (users.length < perPage) break;
        page++;
      }
    }

    async function getOrCreateAuthUser(email: string, password: string, role: "representative" | "teacher"): Promise<string> {
      const key = email.toLowerCase();
      let userId = emailToUserId.get(key);

      if (!userId) {
        const safePassword = password && password.length >= 6 ? password : generateRandomPassword();
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: safePassword,
          email_confirm: true,
        });
        if (createError || !newUser?.user) {
          throw new Error(`No se pudo crear el usuario (${email}): ${createError?.message ?? "desconocido"}`);
        }
        userId = newUser.user.id;
        emailToUserId.set(key, userId);
      }

      // Ensure the role for this school (idempotent).
      await supabaseAdmin
        .from("user_roles")
        .upsert(
          { user_id: userId, role, school_id: schoolId },
          { onConflict: "user_id,role,school_id", ignoreDuplicates: true },
        );

      return userId;
    }

    // ── Ensure school year (match ignoring spaces; create canonical "YYYY - YYYY") ──
    const normalizedTarget = yearRangeInput.replace(/\s/g, "");
    let schoolYearId: string | null = null;
    {
      const { data: years } = await supabaseAdmin
        .from("school_years")
        .select("id, year_range")
        .eq("school_id", schoolId);
      const match = (years ?? []).find((y) => (y.year_range || "").replace(/\s/g, "") === normalizedTarget);
      if (match) {
        schoolYearId = match.id;
      } else {
        const canonical = normalizedTarget.replace("-", " - ");
        const { data: inserted, error: yearErr } = await supabaseAdmin
          .from("school_years")
          .insert({ school_id: schoolId, year_range: canonical })
          .select("id")
          .single();
        if (yearErr || !inserted) {
          return json({ error: `No se pudo crear el año escolar: ${yearErr?.message ?? ""}` }, 500);
        }
        schoolYearId = inserted.id;
        created.push(`Año escolar ${canonical}`);
      }
    }

    // ── Section cache: ensure one section per grade_level ──
    const sectionByLevel = new Map<string, string>();
    {
      const { data: existingSections } = await supabaseAdmin
        .from("sections")
        .select("id, grade_level, name")
        .eq("school_id", schoolId);
      for (const s of existingSections ?? []) {
        // First section found for a grade level wins (we reuse it for enrollment).
        if (!sectionByLevel.has(s.grade_level)) sectionByLevel.set(s.grade_level, s.id);
      }
    }

    async function ensureSection(nivelGrado: string): Promise<string | null> {
      const level = GRADE_LABEL_TO_LEVEL[nivelGrado];
      if (!level) return null;
      if (sectionByLevel.has(level)) return sectionByLevel.get(level)!;
      const { data: inserted, error } = await supabaseAdmin
        .from("sections")
        .insert({ school_id: schoolId, grade_level: level, name: "A" })
        .select("id")
        .single();
      if (error || !inserted) {
        // Possible race / pre-existing unique conflict — re-read.
        const { data: again } = await supabaseAdmin
          .from("sections")
          .select("id")
          .eq("school_id", schoolId)
          .eq("grade_level", level)
          .limit(1)
          .maybeSingle();
        if (again) {
          sectionByLevel.set(level, again.id);
          return again.id;
        }
        return null;
      }
      sectionByLevel.set(level, inserted.id);
      created.push(`Sección ${nivelGrado} (A)`);
      return inserted.id;
    }

    const repName = (r: ImportRepresentative) =>
      [r.primer_nombre, r.segundo_nombre, r.primer_apellido, r.segundo_apellido].filter(Boolean).join(" ") || r.email;
    const childName = (c: ImportChild) =>
      [c.primer_nombre, c.segundo_nombre, c.primer_apellido, c.segundo_apellido].filter(Boolean).join(" ") || c.document_id || "estudiante";

    // ── Representatives / families / students / enrollments ──
    for (const rep of representantes) {
      const label = repName(rep);
      try {
        if (!rep.email) throw new Error("Representante sin email");

        const password = rep.cedula && rep.cedula.length >= 6 ? rep.cedula : generateRandomPassword();
        const userId = await getOrCreateAuthUser(rep.email, password, "representative");

        // Find or create family for this user.
        let familyId: string;
        const { data: existingFamilies } = await supabaseAdmin
          .from("families")
          .select("id")
          .eq("user_id", userId);

        if (existingFamilies && existingFamilies.length > 0) {
          familyId = existingFamilies[0].id;
          summary.familiasOmitidas++;
          skipped.push(`Familia ${label} (ya existía)`);
        } else {
          const { data: fam, error: famErr } = await supabaseAdmin
            .from("families")
            .insert({
              user_id: userId,
              address: rep.direccion || null,
              contact_phone: rep.telefono || null,
            })
            .select("id")
            .single();
          if (famErr || !fam) throw new Error(`Error al crear la familia: ${famErr?.message ?? ""}`);
          familyId = fam.id;
          summary.familiasCreadas++;
          created.push(`Familia ${label}`);
        }

        // Ensure family-school link.
        await supabaseAdmin
          .from("family_schools")
          .upsert({ family_id: familyId, school_id: schoolId }, { onConflict: "family_id,school_id", ignoreDuplicates: true });

        // Ensure a primary representative for the family.
        const documentId = rep.cedula ? `${rep.tipo_documento || "V"}-${rep.cedula}` : null;
        const { data: existingReps } = await supabaseAdmin
          .from("representatives")
          .select("id")
          .eq("family_id", familyId)
          .limit(1);

        if (!existingReps || existingReps.length === 0) {
          const { error: repErr } = await supabaseAdmin.from("representatives").insert({
            family_id: familyId,
            document_id: documentId,
            phone: rep.telefono || null,
            email: rep.email || null,
            is_primary: true,
            form_data: {
              tipo_documento: rep.tipo_documento || "V",
              documento: rep.cedula || "",
              primer_nombre: rep.primer_nombre || "",
              segundo_nombre: rep.segundo_nombre || "",
              primer_apellido: rep.primer_apellido || "",
              segundo_apellido: rep.segundo_apellido || "",
              numero_contacto: rep.telefono || "",
              correo_electronico: rep.email || "",
              direccion: rep.direccion || "",
            },
          });
          if (repErr) throw new Error(`Error al crear el representante: ${repErr.message}`);
          summary.representantesCreados++;
        }

        // Children.
        for (const child of rep.hijos || []) {
          const cLabel = childName(child);
          try {
            let studentId: string;
            const { data: existingStudent } = child.document_id
              ? await supabaseAdmin
                  .from("students")
                  .select("id")
                  .eq("family_id", familyId)
                  .eq("document_id", child.document_id)
                  .maybeSingle()
              : { data: null as { id: string } | null };

            if (existingStudent) {
              studentId = existingStudent.id;
              summary.estudiantesOmitidos++;
              skipped.push(`Estudiante ${cLabel} (ya existía)`);
            } else {
              const { data: student, error: stErr } = await supabaseAdmin
                .from("students")
                .insert({
                  family_id: familyId,
                  document_id: child.document_id,
                  status: "active",
                  form_data: {
                    tipo_documento: child.tipo_documento || "V",
                    documento: child.documento || "",
                    primer_nombre: child.primer_nombre || "",
                    segundo_nombre: child.segundo_nombre || "",
                    primer_apellido: child.primer_apellido || "",
                    segundo_apellido: child.segundo_apellido || "",
                    genero: child.genero || "",
                    fecha_nacimiento: child.fecha_nacimiento || "",
                    nivel_grado: child.nivel_grado || "",
                    calificacion: child.calificacion || "",
                    entidad_federal: child.entidad_federal || "",
                  },
                })
                .select("id")
                .single();
              if (stErr || !student) throw new Error(`Error al crear el estudiante: ${stErr?.message ?? ""}`);
              studentId = student.id;
              summary.estudiantesCreados++;
              created.push(`Estudiante ${cLabel}`);
            }

            // Ensure student-school link.
            await supabaseAdmin
              .from("student_schools")
              .upsert({ student_id: studentId, school_id: schoolId }, { onConflict: "student_id,school_id", ignoreDuplicates: true });

            // Enrollment for the target year.
            const sectionId = await ensureSection(child.nivel_grado);
            if (sectionId && schoolYearId) {
              const { error: enrErr } = await supabaseAdmin
                .from("enrollments")
                .upsert(
                  {
                    student_id: studentId,
                    section_id: sectionId,
                    school_year_id: schoolYearId,
                    school_id: schoolId,
                    enrollment_type: "Regular",
                  },
                  { onConflict: "student_id,school_year_id,school_id" },
                );
              if (enrErr) throw new Error(`Error al inscribir: ${enrErr.message}`);
              summary.inscripcionesCreadas++;
            } else if (!sectionId) {
              failed.push(`Inscripción ${cLabel}: grado no reconocido ("${child.nivel_grado}")`);
              summary.errores++;
            }
          } catch (e) {
            summary.errores++;
            failed.push(`Estudiante ${cLabel}: ${(e as Error).message}`);
          }
        }
      } catch (e) {
        summary.errores++;
        failed.push(`Representante ${label}: ${(e as Error).message}`);
      }
    }

    // ── Teachers / subjects / assignments ──
    // Subject cache by name.
    const subjectByName = new Map<string, string>();
    {
      const { data: existingSubjects } = await supabaseAdmin
        .from("school_subjects")
        .select("id, name")
        .eq("school_id", schoolId);
      for (const s of existingSubjects ?? []) subjectByName.set(s.name, s.id);
    }

    async function ensureSubject(name: string): Promise<string | null> {
      if (subjectByName.has(name)) return subjectByName.get(name)!;
      const { data: inserted, error } = await supabaseAdmin
        .from("school_subjects")
        .insert({ school_id: schoolId, name, subject_type: "regular", evaluation_type: "numeric" })
        .select("id")
        .single();
      if (error || !inserted) {
        const { data: again } = await supabaseAdmin
          .from("school_subjects")
          .select("id")
          .eq("school_id", schoolId)
          .eq("name", name)
          .maybeSingle();
        if (again) {
          subjectByName.set(name, again.id);
          return again.id;
        }
        return null;
      }
      subjectByName.set(name, inserted.id);
      summary.areasCreadas++;
      created.push(`Área ${name}`);
      return inserted.id;
    }

    for (const doc of docentes) {
      const label =
        [doc.primer_nombre, doc.segundo_nombre, doc.primer_apellido, doc.segundo_apellido].filter(Boolean).join(" ") || doc.email;
      try {
        if (!doc.email) throw new Error("Docente sin email");
        const password = doc.cedula && doc.cedula.length >= 6 ? doc.cedula : generateRandomPassword();
        const userId = await getOrCreateAuthUser(doc.email, password, "teacher");

        // Find or create teacher for this school.
        let teacherId: string;
        const { data: existingTeacher } = await supabaseAdmin
          .from("teachers")
          .select("id")
          .eq("user_id", userId)
          .eq("school_id", schoolId)
          .maybeSingle();

        if (existingTeacher) {
          teacherId = existingTeacher.id;
          summary.docentesOmitidos++;
          skipped.push(`Docente ${label} (ya existía)`);
        } else {
          const documentId = doc.cedula ? `V-${doc.cedula}` : null;
          const { data: teacher, error: tErr } = await supabaseAdmin
            .from("teachers")
            .insert({
              user_id: userId,
              school_id: schoolId,
              document_id: documentId,
              email: doc.email,
              form_data: {
                tipo_documento: "V",
                documento: doc.cedula || "",
                primer_nombre: doc.primer_nombre || "",
                segundo_nombre: doc.segundo_nombre || "",
                primer_apellido: doc.primer_apellido || "",
                segundo_apellido: doc.segundo_apellido || "",
                correo_electronico: doc.email || "",
                area_administrativa: doc.area_asignada || "",
              },
            })
            .select("id")
            .single();
          if (tErr || !teacher) throw new Error(`Error al crear el docente: ${tErr?.message ?? ""}`);
          teacherId = teacher.id;
          summary.docentesCreados++;
          created.push(`Docente ${label}`);
        }

        // Subject + assignment (skip when create_area is false, e.g. "Dirección General").
        if (doc.create_area && doc.area_asignada) {
          const subjectId = await ensureSubject(doc.area_asignada);
          if (subjectId && schoolYearId) {
            const { error: asgErr } = await supabaseAdmin
              .from("subject_teacher_assignments")
              .upsert(
                { school_id: schoolId, subject_id: subjectId, teacher_id: teacherId, school_year_id: schoolYearId },
                { onConflict: "subject_id,teacher_id,school_year_id", ignoreDuplicates: true },
              );
            if (asgErr) throw new Error(`Error al asignar el área: ${asgErr.message}`);
            summary.asignacionesCreadas++;
          }
        }
      } catch (e) {
        summary.errores++;
        failed.push(`Docente ${label}: ${(e as Error).message}`);
      }
    }

    // ── Standalone subjects (bachillerato: created without teacher assignment) ──
    for (const name of subjectsToCreate) {
      if (name) await ensureSubject(name);
    }

    return json({ success: true, summary, created, skipped, failed }, 200);
  } catch (error) {
    console.error("[import-school-data] unexpected error:", error);
    return json({ error: "Error interno del servidor" }, 500);
  }
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

if (import.meta.main) Deno.serve(handler);
