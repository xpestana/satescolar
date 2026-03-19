

## Plan: Convertir SAT Escolar en PWA

### Qué se hará

Instalar y configurar `vite-plugin-pwa` para que la plataforma sea instalable desde el navegador en móvil y escritorio, con soporte offline básico y manifest completo.

### Cambios

#### 1. Instalar dependencia
- `vite-plugin-pwa`

#### 2. `vite.config.ts` — Configurar plugin PWA
- Agregar `VitePWA` con manifest (nombre, colores, iconos), `registerType: 'autoUpdate'`, y `navigateFallbackDenylist: [/^\/~oauth/]` para no interferir con autenticación.

#### 3. `public/` — Crear iconos PWA
- `pwa-192x192.png` y `pwa-512x512.png` generados desde el logo SVG existente (se usará un SVG inline como icono base y se referenciará el SVG directamente en el manifest, con fallback PNG placeholder).

#### 4. `index.html` — Meta tags móviles
- Agregar `<meta name="theme-color">`, `<link rel="apple-touch-icon">`, y `<meta name="apple-mobile-web-app-capable">` para soporte iOS.

#### 5. `src/components/layout/InstallPWAPrompt.tsx` — Componente de instalación
- Componente que detecta el evento `beforeinstallprompt` del navegador y muestra un banner/botón para instalar la app.
- Se integra en el `DashboardLayout` para que aparezca a usuarios autenticados.

### Archivos a crear/modificar

| Archivo | Acción |
|---|---|
| `vite.config.ts` | Agregar VitePWA plugin |
| `index.html` | Meta tags PWA |
| `public/pwa-192x192.svg` | Icono PWA |
| `public/pwa-512x512.svg` | Icono PWA |
| `src/components/layout/InstallPWAPrompt.tsx` | Crear componente de instalación |
| `src/components/layout/DashboardLayout.tsx` | Integrar InstallPWAPrompt |

