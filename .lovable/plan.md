## Problema

El sidebar es `fixed right-0` con su propio `overflow-y-auto`. Como además el documento entero hace scroll (porque `<main>` solo controla el alto mínimo, no el alto máximo), el navegador pinta la barra de scroll del documento en el borde derecho de la ventana — justo al lado de la barra de scroll interna del sidebar. Eso produce las "dos barras juntas" que se ven raras.

## Objetivo

- Mantener el sidebar fijo a la derecha (sin moverlo).
- Que la barra de scroll del contenido principal aparezca en el borde derecho del área de contenido (es decir, pegada al borde izquierdo del sidebar), no al final de la ventana.
- Aprovechar para limpiar el layout y dejarlo más mantenible.

## Cambios

### 1. `src/components/layout/DashboardLayout.tsx`
- Convertir el root en un contenedor de altura fija sin scroll del documento: `h-screen overflow-hidden`.
- Que `<main>` sea el único elemento con scroll vertical: `h-screen overflow-y-auto` con `padding-top` para el TopBar.
- Reservar el ancho del sidebar con `paddingRight` (en vez de `marginRight`) en un wrapper, así el scrollbar del `<main>` queda exactamente en el borde derecho del área de contenido, junto al borde izquierdo del sidebar — no al final de la ventana.
- Extraer el ancho del sidebar (`20rem`) a una constante compartida (`SIDEBAR_WIDTH`) para no repetirlo en 3 archivos.

Estructura resultante (simplificada):

```text
<div class="h-screen overflow-hidden bg-background">
  <TopBar />
  <AppSidebar />            // fixed right-0
  <div style="paddingRight: sidebar reservado">
    <main class="h-screen overflow-y-auto pt-16 p-6"> ... </main>
  </div>
</div>
```

### 2. `src/components/layout/TopBar.tsx`
- Usar la misma constante `SIDEBAR_WIDTH` para el `right` dinámico.
- Pequeña limpieza: extraer `getInitials` y `getRoleLabel` a un util compartido (`src/lib/user-display.ts`) ya que se duplican con `AppSidebar`.

### 3. `src/components/layout/AppSidebar.tsx`
- Reemplazar el `w-80` hardcodeado por la constante `SIDEBAR_WIDTH` (manteniendo Tailwind con `style={{ width: SIDEBAR_WIDTH }}` o un token equivalente).
- Reutilizar `getInitials` / `getRoleLabel` desde el util compartido.
- Sin cambios funcionales en navegación, colapso ni hover.

### 4. Nuevo archivo `src/lib/layout-constants.ts`
```ts
export const SIDEBAR_WIDTH = "20rem";
```

### 5. Nuevo archivo `src/lib/user-display.ts`
- `getInitials(email?: string)` y `getRoleLabel(role: string | null)` centralizados.

## Qué NO se toca

- Comportamiento del sidebar (colapso, hover edge, permisos, secciones).
- Estilos visuales del sidebar y TopBar.
- Rutas, auth ni lógica de negocio.

## Resultado esperado

- Una sola barra de scroll vertical visible: la del contenido, pegada al borde izquierdo del sidebar.
- El sidebar conserva su propio scroll interno cuando hace falta, pero ya no aparece "duplicado" junto al del documento.
- Menos duplicación entre `TopBar`, `AppSidebar` y `DashboardLayout`.
