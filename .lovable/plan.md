## Problema

El `index.html` actual contiene un loader inline que inyecta `/src/main.tsx?preview-cache-bust=...`. En el preview publicado esa URL devuelve 404 y la pantalla queda en blanco. Además `main.tsx` tiene una rutina con `sessionStorage` que fuerza un reload duro y puede causar parpadeos.

Ya verifiqué con el navegador remoto que la app funciona (login + `/inscripciones` se ven bien). Lo que falla en tu navegador es cache local: el HTML viejo sigue cacheado por un Service Worker registrado antes.

## Cambios

1. **`index.html`** — quitar el script inline. Dejar solo `<script type="module" src="/src/main.tsx"></script>`.
2. **`src/main.tsx`** — reemplazar el bloque de cleanup + reload por una sola llamada `navigator.serviceWorker.getRegistrations().then(...unregister)`. Sin `caches.delete`, sin `sessionStorage`, sin reload.
3. **Conservar** `public/sw.js` y `public/service-worker.js` como kill-switches (ya se auto-desregistran).

## Acción manual de tu lado (una sola vez)

Para soltar el SW viejo cacheado en tu navegador actual:
- DevTools → Application → Service Workers → Unregister todos
- Application → Storage → Clear site data
- Ctrl+Shift+R

A partir de ahí no vuelve a aparecer el problema.
