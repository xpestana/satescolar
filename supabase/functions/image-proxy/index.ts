const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const { searchParams } = new URL(req.url);
  const imageUrl = searchParams.get("url");

  if (!imageUrl) {
    return new Response("Missing url parameter", { status: 400, headers: CORS_HEADERS });
  }

  // Validate: only allow URLs from our S3 bucket
  const bucket = Deno.env.get("AWS_S3_BUCKET")?.trim() ?? "";
  const region = Deno.env.get("AWS_REGION")?.trim() ?? "";

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    return new Response("Invalid url", { status: 400, headers: CORS_HEADERS });
  }

  if (bucket && region) {
    const allowedHost = `${bucket}.s3.${region}.amazonaws.com`;
    if (parsedUrl.hostname !== allowedHost) {
      return new Response("URL not from allowed host", { status: 403, headers: CORS_HEADERS });
    }
  }

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      return new Response("Failed to fetch image", { status: response.status, headers: CORS_HEADERS });
    }

    const contentType = response.headers.get("content-type") || "image/png";
    const body = await response.arrayBuffer();

    return new Response(body, {
      headers: {
        ...CORS_HEADERS,
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (e: any) {
    console.error("image-proxy error:", e);
    return new Response("Error fetching image", { status: 500, headers: CORS_HEADERS });
  }
}

if (import.meta.main) Deno.serve(handler);
