import { supabase } from "@/integrations/supabase/client";

export type S3Folder =
  | "logo"
  | "assets"
  | "students"
  | "representatives"
  | "teachers"
  | "posts"
  | "activities"
  | "submissions";

export interface UploadToS3Params {
  file: File | Blob;
  folder: S3Folder;
  schoolId: string;
  entityId?: string;
  classroomId?: string;
  fileName?: string;
}

export interface UploadResult {
  publicUrl: string;
  key: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

/**
 * Sube un archivo a AWS S3 usando una URL pre-firmada solicitada al edge
 * function `s3-sign-upload`. Devuelve la URL pública del objeto en S3.
 *
 * Estructura de carpetas en el bucket:
 *   schools/<schoolId>/<folder>/<entityId?>/<timestamp>-<fileName>
 *   schools/<schoolId>/classroom/<classroomId>/<folder>/<entityId?>/...
 */
export async function uploadToS3({
  file,
  folder,
  schoolId,
  entityId,
  classroomId,
  fileName,
}: UploadToS3Params): Promise<UploadResult> {
  const finalName =
    fileName ||
    (file instanceof File ? file.name : `upload-${Date.now()}.bin`);
  const contentType = file.type || "application/octet-stream";

  // 1. Pedir URL firmada
  const { data, error } = await supabase.functions.invoke("s3-sign-upload", {
    body: {
      folder,
      fileName: finalName,
      contentType,
      schoolId,
      entityId,
      classroomId,
    },
  });

  if (error || !data?.uploadUrl) {
    throw new Error(error?.message || data?.error || "Error firmando subida");
  }

  // 2. PUT directo a S3
  const putRes = await fetch(data.uploadUrl, {
    method: "PUT",
    headers: data.headers || {
      "x-amz-acl": "public-read",
      "Content-Type": contentType,
    },
    body: file,
  });

  if (!putRes.ok) {
    const text = await putRes.text().catch(() => "");
    throw new Error(`Error subiendo a S3 (${putRes.status}): ${text}`);
  }

  return {
    publicUrl: data.publicUrl,
    key: data.key,
    fileName: finalName,
    fileSize: file.size,
    mimeType: contentType,
  };
}
