import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch BCV page via Firecrawl API
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!firecrawlKey) {
      throw new Error("FIRECRAWL_API_KEY not configured");
    }

    const fcRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: "https://www.bcv.org.ve/",
        formats: ["html"],
        onlyMainContent: false,
      }),
    });

    const fcData = await fcRes.json();
    if (!fcRes.ok || !fcData.success) {
      throw new Error(`Firecrawl error: ${fcData.error || fcRes.status}`);
    }

    const html = fcData.data?.html || "";
    if (!html) {
      throw new Error("Firecrawl returned empty HTML");
    }
    console.log("Fetched BCV via Firecrawl");

    // Extract USD rate from id="dolar" block
    const usdMatch = html.match(
      /id="dolar"[\s\S]*?<strong>\s*([\d.,]+)\s*<\/strong>/
    );
    // Extract EUR rate from id="euro" block
    const eurMatch = html.match(
      /id="euro"[\s\S]*?<strong>\s*([\d.,]+)\s*<\/strong>/
    );
    // Extract published date from content attribute
    const dateMatch = html.match(
      /Fecha Valor:[\s\S]*?content="(\d{4}-\d{2}-\d{2})/
    );

    if (!usdMatch || !eurMatch) {
      throw new Error(
        "Could not extract exchange rates from BCV page. USD match: " +
          !!usdMatch +
          ", EUR match: " +
          !!eurMatch
      );
    }

    // Parse rates: BCV uses comma as decimal separator (e.g. "473,87020000")
    const parseRate = (raw: string) =>
      parseFloat(raw.replace(/\./g, "").replace(",", "."));

    const usdRate = parseRate(usdMatch[1]);
    const eurRate = parseRate(eurMatch[1]);
    const publishedDate = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10);

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

Deno.serve(handler);
