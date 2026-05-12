import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BCV_URL = "https://www.bcv.org.ve/";

const parseRate = (raw: string) =>
  parseFloat(raw.replace(/\s/g, "").replace(/\./g, "").replace(",", "."));

const stripTags = (value: string) => value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").trim();

const extractRateFromHtml = (html: string, id: "dolar" | "euro", currency: "USD" | "EUR") => {
  const idMatch = html.match(
    new RegExp(`id=["']${id}["'][\\s\\S]{0,1800}?<strong[^>]*>([\\s\\S]*?)<\\/strong>`, "i")
  );
  if (idMatch) return stripTags(idMatch[1]);

  const currencyMatch = html.match(
    new RegExp(`\\b${currency}\\b[\\s\\S]{0,800}?<strong[^>]*>([\\s\\S]*?[\\d][\\d.,\\s]*?)<\\/strong>`, "i")
  );
  return currencyMatch ? stripTags(currencyMatch[1]) : null;
};

const extractPublishedDate = (html: string) => {
  const dateMatch = html.match(/Fecha\s+Valor:[\s\S]{0,500}?content=["'](\d{4}-\d{2}-\d{2})/i);
  if (dateMatch) return dateMatch[1];

  const fallbackDateMatch = html.match(/content=["'](\d{4}-\d{2}-\d{2})T00:00:00-04:00["'][\s\S]{0,300}?Fecha\s+Valor/i);
  return fallbackDateMatch ? fallbackDateMatch[1] : new Date().toISOString().slice(0, 10);
};

const scrapeBcvPage = async (firecrawlKey: string) => {
  const payload = {
    url: BCV_URL,
    formats: ["rawHtml", "html", "markdown"],
    onlyMainContent: false,
    waitFor: 1000,
  };

  const endpoints = ["https://api.firecrawl.dev/v2/scrape", "https://api.firecrawl.dev/v1/scrape"];
  let lastError = "Unknown Firecrawl error";

  for (const endpoint of endpoints) {
    const fcRes = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const fcData = await fcRes.json().catch(() => null);
    if (!fcRes.ok || !fcData?.success) {
      lastError = fcData?.error || `${endpoint} returned ${fcRes.status}`;
      continue;
    }

    const data = fcData.data || fcData;
    const html = [data.rawHtml, data.html, data.markdown].filter(Boolean).join("\n");
    if (html) {
      console.log(`Fetched BCV via Firecrawl ${endpoint.includes("/v2/") ? "v2" : "v1"}, length: ${html.length}`);
      return html;
    }
    lastError = `${endpoint} returned empty content`;
  }

  throw new Error(`Firecrawl error: ${lastError}`);
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!firecrawlKey) {
      throw new Error("FIRECRAWL_API_KEY not configured");
    }

    const html = await scrapeBcvPage(firecrawlKey);

    const usdRaw = extractRateFromHtml(html, "dolar", "USD");
    const eurRaw = extractRateFromHtml(html, "euro", "EUR");

    if (!usdRaw || !eurRaw) {
      throw new Error(
        "Could not extract exchange rates from BCV page. USD match: " +
          !!usdRaw +
          ", EUR match: " +
          !!eurRaw
      );
    }

    const usdRate = parseRate(usdRaw);
    const eurRate = parseRate(eurRaw);
    const publishedDate = extractPublishedDate(html);

    console.log(`BCV rates - USD: ${usdRate}, EUR: ${eurRate}, Date: ${publishedDate}`);

    // Upsert into bcv_rates
    const { error: upsertError } = await supabase.from("bcv_rates").upsert(
      [
        { currency: "USD", rate_to_ves: usdRate, published_date: publishedDate, fetched_at: new Date().toISOString() },
        { currency: "EUR", rate_to_ves: eurRate, published_date: publishedDate, fetched_at: new Date().toISOString() },
      ],
      { onConflict: "currency,published_date" }
    );

    if (upsertError) {
      console.error("Upsert bcv_rates error:", upsertError);
      throw upsertError;
    }

    // Update exchange_rates for ALL schools (USD and EUR only)
    const { data: allSchoolRates } = await supabase
      .from("exchange_rates")
      .select("id, school_id, currency")
      .in("currency", ["USD", "EUR"]);

    if (allSchoolRates && allSchoolRates.length > 0) {
      for (const sr of allSchoolRates) {
        const newRate = sr.currency === "USD" ? usdRate : eurRate;
        await supabase
          .from("exchange_rates")
          .update({ rate_to_ves: newRate, updated_at: new Date().toISOString() })
          .eq("id", sr.id);
      }
    }

    // Also insert exchange_rates for schools that don't have USD/EUR yet
    const { data: allSchools } = await supabase.from("schools").select("id");
    if (allSchools) {
      const schoolsWithRates = new Set(
        (allSchoolRates || []).map((r: any) => `${r.school_id}_${r.currency}`)
      );
      for (const school of allSchools) {
        for (const cur of ["USD", "EUR"]) {
          if (!schoolsWithRates.has(`${school.id}_${cur}`)) {
            const rate = cur === "USD" ? usdRate : eurRate;
            await supabase.from("exchange_rates").insert({
              school_id: school.id,
              currency: cur,
              rate_to_ves: rate,
            });
          }
        }
      }
    }

    const result = { usd: usdRate, eur: eurRate, published_date: publishedDate };

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error fetching BCV rates:", error);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

if (import.meta.main) Deno.serve(handler);
