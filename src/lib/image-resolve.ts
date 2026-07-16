const FETCH_TIMEOUT_MS = 8_000;
const IMAGE_LOAD_TIMEOUT_MS = 10_000;

function isS3Url(url: string): boolean {
  return url.includes("amazonaws.com");
}

function toNginxProxyUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith(".amazonaws.com")) {
      return `/img-proxy/${parsed.hostname}${parsed.pathname}`;
    }
  } catch {
    /* invalid URL */
  }
  return null;
}

async function fetchWithTimeout(
  url: string,
  options?: RequestInit,
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<Response | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string) ?? "");
    reader.onerror = () => resolve("");
    reader.readAsDataURL(blob);
  });
}

async function fetchUrlAsDataUrl(
  fetchUrl: string,
  headers?: Record<string, string>,
): Promise<string> {
  const response = await fetchWithTimeout(
    fetchUrl,
    headers ? { headers } : undefined,
  );
  if (!response?.ok) return "";
  const blob = await response.blob();
  return blobToDataUrl(blob);
}

function getSupabaseProxyConfig(): {
  supabaseUrl: string;
  supabaseKey: string;
  headers: Record<string, string>;
} | null {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!supabaseUrl || !supabaseKey) return null;
  return {
    supabaseUrl,
    supabaseKey,
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  };
}

function edgeProxyUrl(originalUrl: string, supabaseUrl: string): string {
  return `${supabaseUrl}/functions/v1/image-proxy?url=${encodeURIComponent(originalUrl)}`;
}

/**
 * Resolves any image URL to an inline data URL for html2canvas / jsPDF.
 * Never returns a raw cross-origin URL — empty string on failure.
 */
export async function resolveImageToDataUrl(url: string): Promise<string> {
  if (!url) return "";
  if (url.startsWith("data:")) return url;

  const proxyCfg = getSupabaseProxyConfig();

  if (isS3Url(url) && proxyCfg) {
    const dataUrl = await fetchUrlAsDataUrl(
      edgeProxyUrl(url, proxyCfg.supabaseUrl),
      proxyCfg.headers,
    );
    if (dataUrl) return dataUrl;
  }

  const nginxProxy = toNginxProxyUrl(url);
  if (nginxProxy) {
    const dataUrl = await fetchUrlAsDataUrl(nginxProxy);
    if (dataUrl) return dataUrl;
  }

  const direct = await fetchUrlAsDataUrl(url);
  if (direct) return direct;

  if (!isS3Url(url) && proxyCfg) {
    const dataUrl = await fetchUrlAsDataUrl(
      edgeProxyUrl(url, proxyCfg.supabaseUrl),
      proxyCfg.headers,
    );
    if (dataUrl) return dataUrl;
  }

  return "";
}

/** Alias used by primaria boleta code. */
export const fetchAsBase64 = resolveImageToDataUrl;

/**
 * Inlines the firma/sello images of a signature list so html2canvas can draw them
 * (a raw S3 URL is dropped as a cross-origin taint and prints blank).
 */
export async function resolveSignatureImages<T extends { firma_url: string; sello_url: string }>(
  sigs: T[],
): Promise<T[]> {
  return Promise.all(
    sigs.map(async (sig) => ({
      ...sig,
      firma_url: sig.firma_url ? await resolveImageToDataUrl(sig.firma_url) : "",
      sello_url: sig.sello_url ? await resolveImageToDataUrl(sig.sello_url) : "",
    })),
  );
}

/**
 * Loads an image as a PNG data URL (for jsPDF addImage).
 * Uses canvas normalization when the source is not already PNG.
 */
export async function resolveImageToPngDataUrl(url: string): Promise<string | null> {
  const dataUrl = await resolveImageToDataUrl(url);
  if (!dataUrl) return null;
  if (dataUrl.startsWith("data:image/png")) return dataUrl;

  return new Promise((resolve) => {
    const img = new Image();
    const fail = () => resolve(null);
    const timer = setTimeout(fail, IMAGE_LOAD_TIMEOUT_MS);
    img.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || 200;
        canvas.height = img.naturalHeight || 200;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(null);
      }
    };
    img.onerror = fail;
    img.src = dataUrl;
  });
}
