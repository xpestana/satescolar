## Diagnóstico

En el último cambio metí dos cosas que ahora estorban:

1. **Oculté la barra del sidebar** (`scrollbar-hidden` en el `<nav>`). Tú quieres que **se vea**: tanto el scroll del contenido como el del sidebar deben estar presentes. Hay que revertir esto.

2. **Puse `h-screen` en el wrapper intermedio** (el div con `paddingRight`) además del `h-screen` del `<main>`. Tener dos elementos en cascada con altura fija de viewport, uno con `padding-right`, hace que el navegador en algunos casos pinte una barra de scroll extra en el wrapper (ese es el "tercer scroll" que ves, vacío y que baja más allá del contenido). El root ya está en `h-screen overflow-hidden`, así que el wrapper no necesita altura propia: basta con que `<main>` sea el único elemento dimensionado y scrolleable.

El sidebar (aside fixed) ya tiene su propio `h-screen` y es independiente del flujo, no influye.

## Cambios

### 1. `src/index.css`
- Mantener la utilidad `.scrollbar-hidden` (es genérica y útil) **pero dejar de usarla en el sidebar**. No se borra, simplemente queda disponible para popovers/listas.

### 2. `src/components/layout/AppSidebar.tsx`
- En el `<nav>` quitar `scrollbar-hidden`. Vuelve a verse la barra del sidebar como antes.

### 3. `src/components/layout/DashboardLayout.tsx`
- Quitar `h-screen` del div wrapper intermedio. Queda solo con `transition-[padding]` y el `paddingRight` reservado.
- Mantener `<main>` como único elemento scrolleable (`h-screen overflow-y-auto pt-16 px-4 pb-6 md:px-6`).
- Mantener el root `h-screen overflow-hidden` (eso evita que el documento mismo haga scroll).

Estructura resultante:

```text
<div h-screen overflow-hidden>          // root: bloquea scroll del documento
  <TopBar />                            // fixed
  <AppSidebar />                        // fixed, scroll interno propio (visible)
  <div paddingRight=sidebar>            // wrapper sin altura propia
    <main h-screen overflow-y-auto>    // único scroll de contenido visible
      ...contenido...
    </main>
  </div>
</div>
```

### 4. Mobile
- Sin cambios respecto a la última versión: en móvil `reserveSidebar=false`, el sidebar overlay, `<main>` ocupa todo el ancho.

## Qué NO se toca

- `PageContainer.tsx` (queda disponible para uso futuro, no rompe nada).
- Lógica del sidebar, hover, colapso, permisos.
- TopBar.
- Páginas individuales.

## Resultado esperado

- **Scroll del contenido** visible, pegado al borde izquierdo del sidebar (como ya estaba).
- **Scroll del sidebar** visible cuando el menú es más alto que la pantalla (revertido).
- **Sin tercer scroll fantasma** — desaparece el scroll extra del wrapper que bajaba más allá del contenido.
- El documento sigue sin scrollear (root mantiene `overflow-hidden`).
