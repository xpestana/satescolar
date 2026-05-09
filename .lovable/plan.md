## Problema

Hoy se ven dos barras de scroll pegadas al borde derecho del sidebar:

1. La de `<main>` (`h-screen overflow-y-auto` dentro del wrapper con `paddingRight: SIDEBAR_WIDTH`) — esa **sí** está bien posicionada (al borde izquierdo del sidebar, que es lo que pide el usuario).
2. La de `<nav>` interno del sidebar (`overflow-y-auto`) — esta es la que se ve "extra" justo al lado, y el usuario la percibe como que el scroll de la página está pegado al del sidebar.

Además:
- En móvil, `paddingRight: 20rem` deja el contenido aplastado contra el borde izquierdo y el sidebar fijo cubre casi toda la pantalla.
- Varias páginas largas (EditFamily, AddStudent, AddRepresentative, dashboards, etc.) repiten patrones de contenedor (`max-w-*`, `mx-auto`, `space-y-6`) en cada archivo — viola DRY.

## Objetivo

- **Una sola barra de scroll visible**, en el borde derecho del área de contenido (pegada al borde izquierdo del sidebar).
- El sidebar conserva su scroll interno **funcional** pero **sin barra visible**.
- Layout responsive: en móvil el sidebar se oculta por defecto y el contenido usa todo el ancho.
- Eliminar duplicación de wrappers de página con un único `PageContainer`.

## Cambios

### 1. Ocultar la barra del sidebar (`src/index.css`)
Agregar utilidad `.scrollbar-hidden` (Firefox / IE / WebKit) en `@layer utilities`. El nav sigue scrolleando con rueda/touch, solo desaparece la barra visual.

### 2. `src/components/layout/AppSidebar.tsx`
- Aplicar `scrollbar-hidden` al `<nav>` interno.
- Sin cambios funcionales.

### 3. Layout responsive (`src/components/layout/DashboardLayout.tsx` + `useSidebarState`)
- Detectar móvil (`useIsMobile` ya existe en `src/hooks/use-mobile.tsx`).
- En móvil: forzar `collapsed=true` por defecto, el sidebar aparece como overlay (ya es `fixed`, basta con no reservar `paddingRight`).
- En desktop: comportamiento actual.
- El wrapper solo aplica `paddingRight: SIDEBAR_WIDTH` cuando **no es móvil y no está colapsado**.
- TopBar idéntico tratamiento para `right`.

### 4. Nuevo `src/components/layout/PageContainer.tsx` (DRY)
Componente único que estandariza el ancho/espaciado de cualquier página:

```tsx
<PageContainer> ...contenido... </PageContainer>
// = <div class="max-w-7xl mx-auto space-y-6 pb-8"> ... </div>
```

Variantes opcionales: `size="full" | "wide" | "narrow"`.

### 5. Migrar páginas largas al `PageContainer`
Aplicar a las páginas con formularios largos / dashboards donde hoy se repite el patrón:
- `src/pages/school/EditFamily.tsx`
- `src/pages/school/AddStudent.tsx`
- `src/pages/school/AddRepresentative.tsx`
- `src/pages/representative/EditFamilyData.tsx`
- `src/pages/representative/RepAddStudent.tsx`
- `src/pages/representative/RepAddRepresentative.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/school/SchoolDashboard.tsx`
- `src/pages/representative/RepresentativeDashboard.tsx`

**Solo se reemplaza el wrapper exterior**; no se toca lógica, queries, formularios ni validaciones.

### 6. Verificación móvil
Ajustar padding del `<main>` (`p-4 md:p-6`) y del header del TopBar para que no se desborden a 375px. Probar a 375 y 768 CSS px.

## Qué NO se toca

- Lógica de auth, permisos, queries, mutaciones.
- Comportamiento de colapsar/hover del sidebar en desktop.
- Estilos de tarjetas, inputs, modales.
- Edge functions ni base de datos.

## Resultado esperado

- Una sola barra de scroll visible, exactamente al borde izquierdo del sidebar.
- Sidebar sigue scrolleando internamente sin mostrar barra.
- En móvil el sidebar se oculta y el contenido ocupa el ancho completo.
- Páginas largas comparten el mismo wrapper (`PageContainer`) — menos duplicación, más consistencia.
