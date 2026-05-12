## Diagnóstico

El error no tiene relación con migraciones. En el VPS se está ejecutando una versión vieja de `fetch-bcv-rates`:

- Log del VPS: `Fetched BCV via Firecrawl`
- Código actual en Lovable: `Fetched BCV via Firecrawl v2/v1, length: ...`
- En el código actual, la línea 51 es el header `Authorization`, pero en el stack del VPS la línea 51 cae en el `throw` viejo. Eso confirma que el contenedor no está leyendo el archivo actualizado.

## Plan para resolverlo

1. Verificar en el VPS que el archivo montado tenga el código nuevo:

```bash
cd ~/satescolar
sed -n '1,130p' supabase/functions/fetch-bcv-rates/index.ts | grep -E "Fetched BCV|v2|length|rawHtml"
```

2. Verificar dentro del contenedor si ve el mismo archivo:

```bash
docker exec -it sat-functions sh -lc 'sed -n "1,130p" /home/deno/functions/fetch-bcv-rates/index.ts | grep -E "Fetched BCV|v2|length|rawHtml"'
```

3. Si ambos comandos no muestran `Fetched BCV via Firecrawl v2/v1, length: ...`, actualizar el repo del VPS con los cambios actuales y reiniciar solo funciones:

```bash
cd ~/satescolar
git pull
```

4. Reiniciar recreando el contenedor de funciones para cortar cualquier caché del edge-runtime:

```bash
cd ~/satescolar
docker compose stop supabase-functions
docker compose rm -f supabase-functions
docker compose up -d supabase-functions
```

5. Probar la función y revisar logs:

```bash
curl -i -X POST https://api.satescolar.com/functions/v1/fetch-bcv-rates

docker logs -f sat-functions
```

## Ajuste recomendado si aún falla

Agregaré un fallback directo al BCV además de Firecrawl. Así, aunque Firecrawl devuelva markdown/html incompleto o cacheado, la función intentará leer directamente `https://www.bcv.org.ve/` desde el VPS y extraerá USD/EUR con el parser nuevo.

## Resultado esperado

Los logs deberían cambiar a algo como:

```text
Fetched BCV via Firecrawl v2, length: ...
BCV rates - USD: 504.9146, EUR: 595.05195439, Date: 2026-05-12
```

Si el VPS no tiene el código nuevo, el problema se resuelve con sincronizar/recrear `sat-functions`. Si sí lo tiene pero Firecrawl entrega contenido distinto, el fallback directo corrige la extracción.