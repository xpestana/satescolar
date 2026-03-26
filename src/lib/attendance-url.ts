const PREVIEW_HOST_MARKER = "id-preview--";
const FALLBACK_PUBLISHED_URL = "https://satescolar.lovable.app";

const normalizeUrl = (value: string) => value.replace(/\/+$/, "");

export const getAttendanceBaseUrl = () => {
  const env = import.meta.env as unknown as Record<string, string | undefined>;
  const configuredUrl = env.VITE_PUBLIC_APP_URL || env.VITE_APP_URL;

  if (configuredUrl) {
    return normalizeUrl(configuredUrl);
  }

  if (typeof window === "undefined") {
    return FALLBACK_PUBLISHED_URL;
  }

  if (window.location.hostname.includes(PREVIEW_HOST_MARKER)) {
    return FALLBACK_PUBLISHED_URL;
  }

  return normalizeUrl(window.location.origin);
};

export const buildAttendanceScanUrl = (token: string) => {
  return `${getAttendanceBaseUrl()}/attendance/scan/${token}`;
};
