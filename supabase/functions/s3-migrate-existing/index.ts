// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface MigrationStats {
  scanned: number;
  uploaded: number;
  skipped: number;
  deleted: number;
  errors: number;
  errorDetails: string[];
  migrated: { table: string; id: string; from: string; to: string }[];
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ---- Auth: only admins ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleRow } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden — admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Body opts ----
    const body = await req.json().catch(() => ({}));
    const deleteOriginals = body?.deleteOriginals !== false; // default true

    // ---- Service client ----
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ---- AWS ----
    const accessKeyId = Deno.env.get("AWS_ACCESS_KEY_ID")!;
    const secretAccessKey = Deno.env.get("AWS_SECRET_ACCESS_KEY")!;
    const region = Deno.env.get("AWS_REGION")!;
    const bucket = Deno.env.get("AWS_S3_BUCKET")!;
    const aws = new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region });
    const s3Host = `${bucket}.s3.${region}.amazonaws.com`;
    const s3Origin = `https://${s3Host}`;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const stats: MigrationStats = {
      scanned: 0, uploaded: 0, skipped: 0, deleted: 0, errors: 0,
      errorDetails: [], migrated: [],
    };

    function isAlreadyOnS3(url?: string | null): boolean {
      if (!url) return true;
      return url.includes(s3Host);
    }

    function extractPath(url: string, bucketName: string): string | null {
      const marker = `/${bucketName}/`;
      const i = url.indexOf(marker);
      if (i < 0) return null;
      return url.slice(i + marker.length);
    }

    async function migrateOne(
      bucketName: string,
      objectPath: string,
      schoolId: string,
      folder: string,
      entityId: string | null,
    ): Promise<string | null> {
      stats.scanned++;
      try {
        const { data: blob, error: dlErr } = await admin.storage
          .from(bucketName)
          .download(objectPath);
        if (dlErr || !blob) throw new Error(dlErr?.message || "download failed");

        const contentType = blob.type || "application/octet-stream";
        const ts = Date.now();
        const fileName = sanitize(objectPath.split("/").pop() || `file-${ts}`);

        let key = `schools/${schoolId}/${folder}/`;
        if (entityId) key += `${entityId}/`;
        key += `${ts}-${fileName}`;

        const putRes = await aws.fetch(`${s3Origin}/${key}`, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body: blob,
        });

        if (!putRes.ok) {
          const txt = await putRes.text().catch(() => "");
          throw new Error(`S3 PUT ${putRes.status}: ${txt}`);
        }

        stats.uploaded++;

        if (deleteOriginals) {
          const { error: rmErr } = await admin.storage.from(bucketName).remove([objectPath]);
          if (!rmErr) stats.deleted++;
        }

        return `${s3Origin}/${key}`;
      } catch (e: any) {
        stats.errors++;
        stats.errorDetails.push(`${bucketName}/${objectPath}: ${e?.message || e}`);
        return null;
      }
    }

    async function updateAndRecord(
      table: string, id: string, urlCol: string,
      oldUrl: string, newUrl: string,
    ) {
      await admin.from(table).update({ [urlCol]: newUrl }).eq("id", id);
      stats.migrated.push({ table, id, from: oldUrl, to: newUrl });
    }

    // 1. schools.logo_url  (school-logos)
    const { data: schools } = await admin.from("schools").select("id, logo_url");
    for (const s of schools || []) {
      if (isAlreadyOnS3(s.logo_url)) { stats.skipped++; continue; }
      const path = extractPath(s.logo_url as string, "school-logos");
      if (!path) { stats.skipped++; continue; }
      const newUrl = await migrateOne("school-logos", path, s.id, "logo", null);
      if (newUrl) await updateAndRecord("schools", s.id, "logo_url", s.logo_url as string, newUrl);
    }

    // 2. carnet_config.watermark_url  (school-assets)
    const { data: carnets } = await admin.from("carnet_config").select("id, school_id, watermark_url");
    for (const c of carnets || []) {
      if (isAlreadyOnS3(c.watermark_url)) { stats.skipped++; continue; }
      const path = extractPath(c.watermark_url as string, "school-assets");
      if (!path) { stats.skipped++; continue; }
      const newUrl = await migrateOne("school-assets", path, c.school_id, "assets", null);
      if (newUrl) await updateAndRecord("carnet_config", c.id, "watermark_url", c.watermark_url as string, newUrl);
    }

    // 3. students.photo_url  (school via student_schools)
    const { data: students } = await admin.from("students").select("id, photo_url");
    for (const st of students || []) {
      if (isAlreadyOnS3(st.photo_url)) { stats.skipped++; continue; }
      const path = extractPath(st.photo_url as string, "family-photos");
      if (!path) { stats.skipped++; continue; }
      const { data: ss } = await admin
        .from("student_schools").select("school_id").eq("student_id", st.id).limit(1).maybeSingle();
      if (!ss?.school_id) { stats.skipped++; continue; }
      const newUrl = await migrateOne("family-photos", path, ss.school_id, "students", st.id);
      if (newUrl) await updateAndRecord("students", st.id, "photo_url", st.photo_url as string, newUrl);
    }

    // 4. representatives.photo_url  (school via family_schools)
    const { data: reps } = await admin.from("representatives").select("id, photo_url, family_id");
    for (const r of reps || []) {
      if (isAlreadyOnS3(r.photo_url)) { stats.skipped++; continue; }
      const path = extractPath(r.photo_url as string, "family-photos");
      if (!path) { stats.skipped++; continue; }
      const { data: fs } = await admin
        .from("family_schools").select("school_id").eq("family_id", r.family_id).limit(1).maybeSingle();
      if (!fs?.school_id) { stats.skipped++; continue; }
      const newUrl = await migrateOne("family-photos", path, fs.school_id, "representatives", r.id);
      if (newUrl) await updateAndRecord("representatives", r.id, "photo_url", r.photo_url as string, newUrl);
    }

    // 5. teachers.photo_url
    const { data: teachers } = await admin.from("teachers").select("id, school_id, photo_url");
    for (const t of teachers || []) {
      if (isAlreadyOnS3(t.photo_url)) { stats.skipped++; continue; }
      const path = extractPath(t.photo_url as string, "family-photos");
      if (!path || !t.school_id) { stats.skipped++; continue; }
      const newUrl = await migrateOne("family-photos", path, t.school_id, "teachers", t.id);
      if (newUrl) await updateAndRecord("teachers", t.id, "photo_url", t.photo_url as string, newUrl);
    }

    // 6. classroom_config.cover_url  (classroom-files o school-assets)
    const { data: ccfg } = await admin.from("classroom_config").select("id, school_id, cover_url");
    for (const c of ccfg || []) {
      if (isAlreadyOnS3(c.cover_url)) { stats.skipped++; continue; }
      const url = c.cover_url as string;
      const supaIdx = url.indexOf("/storage/v1/object/public/");
      if (supaIdx < 0) { stats.skipped++; continue; }
      const tail = url.slice(supaIdx + "/storage/v1/object/public/".length);
      const slash = tail.indexOf("/");
      const bucketName = tail.slice(0, slash);
      const path = tail.slice(slash + 1);
      const newUrl = await migrateOne(bucketName, path, c.school_id, "assets", null);
      if (newUrl) await updateAndRecord("classroom_config", c.id, "cover_url", url, newUrl);
    }

    // 7. classroom attachments
    for (const t of ["classroom_activity_attachments","classroom_post_attachments","classroom_submission_attachments"]) {
      const { data: rows } = await admin.from(t).select("id, school_id, file_url");
      for (const r of rows || []) {
        if (isAlreadyOnS3(r.file_url)) { stats.skipped++; continue; }
        const url = r.file_url as string;
        const supaIdx = url.indexOf("/storage/v1/object/public/");
        if (supaIdx < 0) { stats.skipped++; continue; }
        const tail = url.slice(supaIdx + "/storage/v1/object/public/".length);
        const slash = tail.indexOf("/");
        const bucketName = tail.slice(0, slash);
        const path = tail.slice(slash + 1);
        const newUrl = await migrateOne(bucketName, path, r.school_id, "assets", null);
        if (newUrl) await updateAndRecord(t, r.id, "file_url", url, newUrl);
      }
    }

    return new Response(JSON.stringify({ ok: true, stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("s3-migrate-existing error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
