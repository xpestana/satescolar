// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_FOLDERS = new Set([
  "logo",
  "assets",
  "students",
  "representatives",
  "teachers",
  "posts",
  "activities",
  "submissions",
]);

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ---- Auth ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: authErr } = await supabase.auth.getClaims(token);
    if (authErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Input ----
    const body = await req.json();
    const folder = String(body?.folder || "");
    const fileName = sanitize(String(body?.fileName || "file"));
    const contentType = String(body?.contentType || "application/octet-stream");
    const schoolId = String(body?.schoolId || "");
    const entityId = body?.entityId ? sanitize(String(body.entityId)) : null;
    const classroomId = body?.classroomId ? sanitize(String(body.classroomId)) : null;

    if (!ALLOWED_FOLDERS.has(folder)) {
      return new Response(JSON.stringify({ error: "Invalid folder" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!/^[0-9a-f-]{36}$/i.test(schoolId)) {
      return new Response(JSON.stringify({ error: "Invalid schoolId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Build object key ----
    const ts = Date.now();
    let key = `schools/${schoolId}/`;
    if (["posts", "activities", "submissions"].includes(folder)) {
      if (!classroomId) {
        return new Response(
          JSON.stringify({ error: "classroomId required for classroom folders" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      key += `classroom/${classroomId}/${folder}/`;
      if (entityId) key += `${entityId}/`;
      key += `${ts}-${fileName}`;
    } else if (folder === "logo" || folder === "assets") {
      key += `${folder}/${ts}-${fileName}`;
    } else {
      // students / representatives / teachers
      if (!entityId) {
        return new Response(JSON.stringify({ error: "entityId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      key += `${folder}/${entityId}/${ts}-${fileName}`;
    }

    // ---- Sign PUT URL ----
    const accessKeyId = Deno.env.get("AWS_ACCESS_KEY_ID")!;
    const secretAccessKey = Deno.env.get("AWS_SECRET_ACCESS_KEY")!;
    const region = Deno.env.get("AWS_REGION")!;
    const bucket = Deno.env.get("AWS_S3_BUCKET")!;

    const aws = new AwsClient({
      accessKeyId,
      secretAccessKey,
      service: "s3",
      region,
    });

    const host = `${bucket}.s3.${region}.amazonaws.com`;
    const url = new URL(`https://${host}/${key}`);
    url.searchParams.set("X-Amz-Expires", "900");

    // Sign as PUT with public-read ACL and content-type
    const signed = await aws.sign(
      new Request(url.toString(), {
        method: "PUT",
        headers: {
          "x-amz-acl": "public-read",
          "Content-Type": contentType,
        },
      }),
      { aws: { signQuery: true } },
    );

    const publicUrl = `https://${host}/${key}`;

    return new Response(
      JSON.stringify({
        uploadUrl: signed.url,
        publicUrl,
        key,
        headers: {
          "x-amz-acl": "public-read",
          "Content-Type": contentType,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("s3-sign-upload error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
