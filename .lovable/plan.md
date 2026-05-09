## Diagnóstico

Tras el cambio del scroll del documento al `<main>`, en esta vista quedan dos barras visibles a la derecha:

1. La del **`<main>`** (contenido de la página) — correcta y deseada.
2. La del **`<nav>` interno del sidebar** (`overflow-y-auto`) — aparece porque el menú lateral, con todas las secciones de "Registros / Utilidades / Inscripciones / Notas / …", excede la altura disponible.

No es un problema de las páginas hijas: el barrido del repo confirma que ningún `pages/*` crea su propio contenedor scrollable a pantalla completa. Todos los `overflow-y-auto` restantes son popovers, tablas o listas acotadas (`max-h-*`), lo cual está bien.

El "desorden" real es visual: dos barras compitiendo a la derecha. La solución limpia es **mantener un solo scrollbar visible** (el del contenido) y dejar el del sidebar funcional pero oculto, además de blindar el patrón para que ninguna página futura introduzca un tercer scroll.

## Cambios

### 1. Ocultar la barra del sidebar (sigue siendo scrollable)
- Agregar utilidad reutilizable `.scrollbar-hidden` en `src/index.css`:

```css
@layer utilities {
  .scrollbar-hidden {
    scrollbar-width: none;            /* Firefox */
    -ms-overflow-style: none;         /* IE/Edge legacy */
  }
  .scrollbar-hidden::-webkit-scrollbar { /* Chrome / Safari */
    display: none;
  }
}
```

- Aplicar `scrollbar-hidden` al `<nav>` del sidebar en `src/components/layout/AppSidebar.tsx` (sigue desplazándose con la rueda / touch / teclado).

Resultado: una sola barra visible, la del contenido principal, pegada al borde izquierdo del sidebar.

### 2. Reforzar el principio "solo `<main>` hace scroll de página"
- En `src/components/layout/DashboardLayout.tsx` añadir un comentario corto que documente la regla y que las páginas **no** deben usar `min-h-screen`, `h-screen` ni `overflow-y-auto` a nivel raíz.
- Crear un wrapper opcional `PageContainer` (`src/components/layout/PageContainer.tsx`) con clases estándar (`space-y-6`, ancho máximo, etc.) para que las páginas lo usen en lugar de repetir clases — DRY. Adoptarlo solo donde sea trivial (no migración masiva en este turno).

### 3. Auditoría rápida (sin cambios funcionales)
Ya verificado por búsqueda: ninguna página actual rompe la regla. Los `overflow-y-auto` restantes son válidos (popovers, listas con `max-h-*`, tablas con scroll horizontal). No se tocan.

## Qué NO se toca

- Comportamiento, estilos visuales ni rutas del sidebar.
- Lógica de las páginas existentes.
- Modales y popovers con `overflow-y-auto` propios (correctos).

## Resultado esperado

- Una única barra de scroll visible en cualquier vista del dashboard, justo al borde izquierdo del sidebar.
- El menú lateral sigue siendo desplazable con rueda/touch aunque su barra ya no se vea.
- Una utilidad y un wrapper documentados que evitan que futuras páginas reintroduzcan scrolls dobles.
