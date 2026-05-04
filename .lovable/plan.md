## Reactivar la app como instalable (sin service worker)

Vamos a usar la **Opción A: solo manifest**. Esto devuelve el botón "Instalar app" en Chrome/Edge desktop y "Agregar a pantalla de inicio" en móvil, sin reintroducir el bug de caché que tuvimos antes.

### Qué se hace

1. **Crear `public/manifest.webmanifest`** con:
   - `name`: "SAT Escolar"
   - `short_name`: "SAT Escolar"
   - `description`: gestión escolar
   - `start_url`: "/"
   - `scope`: "/"
   - `display`: "standalone"
   - `background_color`: "#01051e"
   - `theme_color`: "#01051e"
   - `icons`: referencias a 192x192 y 512x512 (PNG) + uno `maskable` para Android

2. **Generar los iconos PNG** a partir de `src/assets/logo.svg` (o `Simbolo_4.webp` que ya se usa en og:image):
   - `public/icons/icon-192.png`
   - `public/icons/icon-512.png`
   - `public/icons/icon-512-maskable.png` (con padding seguro ~10%)
   - `public/apple-touch-icon.png` (180x180, para iOS)

3. **Editar `index.html`** para enlazar el manifest e iconos:
   ```html
   <link rel="manifest" href="/manifest.webmanifest" />
   <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
   <meta name="apple-mobile-web-app-capable" content="yes" />
   <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
   <meta name="apple-mobile-web-app-title" content="SAT Escolar" />
   ```
   El `theme-color` ya existe.

4. **NO tocar** los kill-switches (`public/sw.js`, `public/service-worker.js`) ni el código de des-registro en `src/main.tsx`. Se quedan tal cual para que sigan limpiando SW viejos en navegadores que aún los tengan registrados.

5. **NO instalar** `vite-plugin-pwa` ni añadir ningún service worker nuevo.

### Por qué esto NO repite el problema anterior

El bug anterior era 100% del **service worker** cacheando HTML viejo dentro del iframe del editor de Lovable. Sin service worker no hay caché propia de la app: el navegador usa su caché normal HTTP, que respeta los headers que ya envía nginx/Lovable. El manifest es un archivo estático JSON que el navegador lee solo para mostrar el prompt de instalación; no intercepta requests ni guarda nada.

### Limitaciones a conocer

- **No hay modo offline.** Si el usuario pierde internet, la app no carga (igual que cualquier web normal). Para un sistema escolar online esto está bien.
- **iOS** muestra el ícono y abre standalone, pero no tiene "prompt de instalación" automático; el usuario debe usar "Compartir → Agregar a pantalla de inicio" manualmente. Es limitación de Safari, no nuestra.
- En el **editor preview de Lovable** el botón de instalar puede no aparecer porque está en iframe. Aparece correctamente en el dominio publicado y en tu VPS.

### Archivos a tocar

- Crear: `public/manifest.webmanifest`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-512-maskable.png`, `public/apple-touch-icon.png`
- Editar: `index.html` (añadir 4-5 líneas en `<head>`)

Sin migraciones, sin cambios en backend, sin nuevas dependencias.