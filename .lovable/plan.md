

# Plan: Usar Firecrawl para scraping del BCV

## Resumen

Reemplazar el scraping directo/proxy en la edge function `fetch-bcv-rates` por Firecrawl, que maneja correctamente certificados SSL problemáticos. Firecrawl está disponible como conector.

## Paso 1: Conectar Firecrawl

Vincular el conector de Firecrawl al proyecto para que `FIRECRAWL_API_KEY` esté disponible como variable de entorno en las edge functions.

## Paso 2: Modificar `fetch-bcv-rates`

Reemplazar toda la lógica de fetch directo + proxies por una llamada a la API de Firecrawl `/v1/scrape` con formato `html`:

```typescript
const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${Deno.env.get("FIRECRAWL_API_KEY")}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    url: "https://www.bcv.org.ve/",
    formats: ["html"],
    onlyMainContent: false,
  }),
});
```

Mantener los mismos regex de extracción de tasas USD/EUR y fecha valor. Mantener la lógica de upsert en `bcv_rates` y actualización de `exchange_rates` sin cambios.

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/fetch-bcv-rates/index.ts` | Reemplazar fetch directo/proxies por llamada a Firecrawl API |

