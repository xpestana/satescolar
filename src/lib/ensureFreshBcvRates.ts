import { supabase } from "@/integrations/supabase/client";

export interface EnsureFreshBcvRatesResult {
  updated: boolean;
  publishedDate: string | null;
}

function getTodayCaracasIsoDate(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

export async function ensureFreshBcvRates(): Promise<EnsureFreshBcvRatesResult> {
  const today = getTodayCaracasIsoDate();

  const { data: latest } = await supabase
    .from("bcv_rates")
    .select("published_date")
    .eq("currency", "USD")
    .order("published_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const currentPublished = latest?.published_date ?? null;
  if (currentPublished === today) {
    return { updated: false, publishedDate: currentPublished };
  }

  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!baseUrl || !publishableKey) {
    throw new Error("Faltan VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY");
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  const res = await fetch(`${baseUrl}/functions/v1/fetch-bcv-rates`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: publishableKey,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const json = await res.json();
  if (!json?.success) {
    throw new Error(json?.error || "No se pudo actualizar BCV");
  }

  const publishedDate = json?.data?.published_date ?? today;
  return { updated: true, publishedDate };
}
