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
  errors: number;
  errorDetails: string[];
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

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authErr } = await userClient.auth.getClaims(token);
    if (authErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const userId = claims.claims.sub as string;
    const { data: roleRow } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden — admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Service client for cross-school access ----
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ---- AWS client ----
    const accessKeyId = Deno.env.get("AWS_ACCESS_KEY_ID")!;
    const secretAccessKey = Deno.env.get("AWS_SECRET_ACCESS_KEY")!;
    const region = Deno.env.get("AWS_REGION")!;
    const bucket = Deno.env.get("AWS_S3_BUCKET")!;
    const aws = new AwsClient({
      accessKeyId, secretAccessKey, service: "s3", region,
    });
    const s3Host = `${bucket}.s3.${region}.amazonaws.com`;
    const s3Origin = `https://${s3Host}`;

    const stats: MigrationStats = {
      scanned: 0, uploaded: 0, skipped: 0, errors: 0, errorDetails: [],
    };

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    // Helper: download from supabase storage and upload to S3
    async function migrateOne(
      bucketName: string,
      objectPath: string,
      schoolId: string,
      folder: string,
      entityId: string | null,
    ): Promise<string | null> {
      stats.scanned++;
      try {
        // Download from Supabase storage
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

        // Upload to S3
        const putRes = await aws.fetch(`${s3Origin}/${key}`, {
          method: "PUT",
          headers: {
            "x-amz-acl": "public-read",
            "Content-Type": contentType,
          },
          body: blob,
        });

        if (!putRes.ok) {
          const txt = await putRes.text().catch(() => "");
          throw new Error(`S3 PUT ${putRes.status}: ${txt}`);
        }

        stats.uploaded++;
        return `${s3Origin}/${key}`;
      } catch (e: any) {
        stats.errors++;
        stats.errorDetails.push(`${bucketName}/${objectPath}: ${e?.message || e}`);
        return null;
      }
    }

    function isAlreadyMigrated(url: string | null | undefined): boolean {
      if (!url) return true;
      return url.includes(s3Host);
    }

    // ---- 1. school-logos → schools.logo_url ----
    const { data: schools } = await admin
      .from("schools")
      .select("id, logo_url");
    for (const s of schools || []) {
      if (isAlreadyMigrated(s.logo_url)) { stats.skipped++; continue; }
      const path = (s.logo_url as string).split("/school-logos/")[1];
      if (!path) { stats.skipped++; continue; }
      const newUrl = await migrateOne("school-logos", path, s.id, "logo", null);
      if (newUrl) {
        await admin.from("schools").update({ logo_url: newUrl }).eq("id", s.id);
      }
    }

    // ---- 2. school-assets → carnet_config.watermark_url ----
    const { data: carnets } = await admin
      .from("carnet_config")
      .select("id, school_id, watermark_url");
    for (const c of carnets || []) {
      if (isAlreadyMigrated(c.watermark_url)) { stats.skipped++; continue; }
      const path = (c.watermark_url as string).split("/school-assets/")[1];
      if (!path) { stats.skipped++; continue; }
      const newUrl = await migrateOne("school-assets", path, c.school_id, "assets", null);
      if (newUrl) {
        await admin.from("carnet_config").update({ watermark_url: newUrl }).eq("id", c.id);
      }
    }

    // ---- 3. family-photos → students.photo_url ----
    const { data: students } = await admin
      .from("students")
      .select("id, photo_url, school_id");
    for (const st of students || []) {
      if (isAlreadyMigrated(st.photo_url)) { stats.skipped++; continue; }
      const path = (st.photo_url as string).split("/family-photos/")[1];
      if (!path || !st.school_id) { stats.skipped++; continue; }
      const newUrl = await migrateOne("family-photos", path, st.school_id, "students", st.id);
      if (newUrl) {
        await admin.from("students").update({ photo_url: newUrl }).eq("id", st.id);
      }
    }

    // ---- 4. family-photos → representatives.photo_url ----
    const { data: reps } = await admin
      .from("representatives")
      .select("id, photo_url, family_id");
    for (const r of reps || []) {
      if (isAlreadyMigrated(r.photo_url)) { stats.skipped++; continue; }
      const path = (r.photo_url as string).split("/family-photos/")[1];
      if (!path) { stats.skipped++; continue; }
      // Resolve school via family_schools
      const { data: fs } = await admin
        .from("family_schools")
        .select("school_id")
        .eq("family_id", r.family_id)
        .limit(1)
        .maybeSingle();
      if (!fs?.school_id) { stats.skipped++; continue; }
      const newUrl = await migrateOne("family-photos", path, fs.school_id, "representatives", r.family_id);
      if (newUrl) {
        await admin.from("representatives").update({ photo_url: newUrl }).eq("id", r.id);
      }
    }

    // ---- 5. family-photos → teachers.photo_url ----
    const { data: teachers } = await admin
      .from("teachers")
      .select("id, photo_url, school_id");
    for (const t of teachers || []) {
      if (isAlreadyMigrated(t.photo_url)) { stats.skipped++; continue; }
      const path = (t.photo_url as string).split("/family-photos/")[1];
      if (!path || !t.school_id) { stats.skipped++; continue; }
      const newUrl = await migrateOne("family-photos", path, t.school_id, "teachers", t.id);
      if (newUrl) {
        await admin.from("teachers").update({ photo_url: newUrl }).eq("id", t.id);
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
