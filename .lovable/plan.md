

# Plan: Tasa BCV Automática - Scraping + Cron Job

## Resumen

Crear una edge function que haga scraping de la pagina del BCV (`bcv.org.ve`) para obtener las tasas USD y EUR oficiales, y un cron job que la ejecute diariamente a las 6 AM (hora Venezuela, UTC-4 = 10:00 UTC). Adicionalmente, agregar un boton "Descargar tasa BCV" en el widget de tasas para que el operador pueda actualizarla manualmente en cualquier momento.

## Analisis del HTML del BCV

La pagina tiene una estructura estable con selectores claros:
- `#dolar .centrado strong` → tasa USD (ej: `473,87020000`)
- `#euro .centrado strong` → tasa EUR (ej: `542,63824342`)
- Fecha: `.date-display-single[content]` dentro del bloque de tipo de cambio → `2026-03-31T00:00:00-04:00`

El BCV publica la tasa del dia habil. La edge function parseara la fecha publicada y la guardara junto con la tasa.

## Base de datos

**Nueva tabla `bcv_rates`** (global, no por escuela):

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | uuid PK | |
| currency | text | USD, EUR |
| rate_to_ves | numeric | Tasa oficial BCV |
| published_date | date | Fecha valor publicada por el BCV |
| fetched_at | timestamptz | Cuando se descargo |

Constraint UNIQUE en `(currency, published_date)` para evitar duplicados.

RLS: SELECT para authenticated, INSERT/UPDATE solo via service role (edge function).

## Edge Function: `fetch-bcv-rates`

1. Hace fetch del HTML de `https://www.bcv.org.ve/`
2. Extrae tasas USD y EUR con regex sobre el HTML (los divs `#dolar` y `#euro` tienen `<strong> 473,87020000 </strong>`)
3. Extrae la fecha valor del `content` attribute del `date-display-single`
4. Upsert en `bcv_rates`
5. Actualiza `exchange_rates` de **todos los colegios** con las tasas BCV (USD y EUR)
6. Retorna las tasas extraidas

Patron de extraccion (regex, no necesita parser HTML):
```
// USD: buscar el bloque id="dolar" y extraer el strong
const usdMatch = html.match(/id="dolar"[\s\S]*?<strong>\s*([\d.,]+)\s*<\/strong>/);
const eurMatch = html.match(/id="euro"[\s\S]*?<strong>\s*([\d.,]+)\s*<\/strong>/);
// Fecha: content="2026-03-31T00:00:00-04:00"
const dateMatch = html.match(/Fecha Valor:[\s\S]*?content="(\d{4}-\d{2}-\d{2})/);
```

## Cron Job (pg_cron)

Programar ejecucion diaria a las 10:00 UTC (6:00 AM Venezuela):
```sql
SELECT cron.schedule('fetch-bcv-rates-daily', '0 10 * * *', ...);
```

## Frontend

**Modificar `ExchangeRateWidget.tsx`:**
- Agregar un boton "Tasa BCV" con icono de descarga junto al titulo
- Al hacer click, invoca la edge function `fetch-bcv-rates`
- Muestra la fecha de ultima actualizacion BCV
- Las tasas se llenan automaticamente con los valores descargados
- El operador sigue pudiendo editar manualmente si lo desea (ej: para COP que no esta en BCV)

## Archivos a crear/modificar

| Archivo | Cambio |
|---------|--------|
| Migracion SQL | Crear tabla `bcv_rates`, habilitar pg_cron y pg_net |
| SQL (insert, no migracion) | Crear cron job schedule |
| `supabase/functions/fetch-bcv-rates/index.ts` | Edge function de scraping |
| `src/components/payments/ExchangeRateWidget.tsx` | Boton "Tasa BCV" + mostrar fecha BCV |

## Notas tecnicas

- COP no esta publicada en el BCV, asi que solo se actualizan USD y EUR automaticamente
- La tasa BCV es la "Fecha Valor" que aparece en la pagina, que puede ser del dia siguiente si se publica en la tarde — la edge function guarda esa fecha exacta
- El scraping usa regex simple sobre el HTML, sin dependencias externas, compatible con Deno

