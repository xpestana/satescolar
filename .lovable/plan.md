

# Busqueda Avanzada - Plan de Implementacion

## Resumen
Crear una nueva seccion "Busqueda Avanzada" en el menu lateral bajo "AREA DE REGISTROS" que permita buscar y filtrar estudiantes o representantes del colegio, con columnas configurables guardadas en cookies.

## Cambios a realizar

### 1. Nuevo item en el sidebar
Agregar "Busqueda Avanzada" con icono `Search` en la seccion "AREA DE REGISTROS" del `AppSidebar.tsx`, apuntando a `/registros/busqueda-avanzada`.

### 2. Nueva ruta en App.tsx
Agregar la ruta protegida `/registros/busqueda-avanzada` con rol `school`.

### 3. Nueva pagina: `src/pages/school/AdvancedSearch.tsx`
Pagina principal con:
- **Toggle Estudiantes/Representantes**: Tabs para elegir que listado ver
- **Tabla dinamica**: Muestra los datos de `form_data` (JSON) junto con campos fijos como `document_id`, `photo_url`, `email`, `phone`
- **Barra de busqueda**: Input de texto que filtra en todos los campos visibles
- **Selector de columnas**: Dropdown con checkboxes para elegir que columnas mostrar/ocultar
- **Paginacion**: 10 registros por pagina

### 4. Persistencia de columnas en cookies
- Al cambiar las columnas visibles, guardar la configuracion en `localStorage` (mas confiable que cookies para este caso) con clave por colegio: `adv-search-columns-{schoolId}-{tipo}`
- Si no existe configuracion guardada, mostrar todas las columnas por defecto
- Las columnas disponibles se obtienen dinamicamente de `form_fields` segun el `form_type` seleccionado

### 5. Logica de busqueda
- Cargar todos los estudiantes o representantes del colegio (filtrado por `school_id` via RLS)
- Hacer join con `families` para obtener apellidos de familia
- Filtro de texto en el cliente sobre los campos visibles del `form_data` y campos fijos
- Busqueda case-insensitive

## Sobre la relacion muchos a muchos
Actualmente `students` y `representatives` ya tienen `school_id` como campo directo. Cambiar esto a una tabla intermedia muchos-a-muchos implicaria una migracion compleja que romperia las politicas RLS existentes y toda la logica de insercion/edicion. Por ahora, la estructura actual ya permite que la busqueda filtre por colegio correctamente. Si en el futuro se necesita multi-colegio, se puede agregar una tabla puente sin eliminar el campo actual.

---

## Detalles Tecnicos

### Estructura del componente

```text
AdvancedSearch.tsx
+-- Tabs (estudiantes | representantes)
+-- ColumnSelector (dropdown con checkboxes)
+-- SearchInput (barra de texto)
+-- DataTable (tabla dinamica con columnas configurables)
+-- Pagination
```

### Consulta de datos
```typescript
// Estudiantes
supabase.from("students")
  .select("*, families(father_last_name, mother_last_name)")
  .eq("school_id", schoolId)

// Representantes  
supabase.from("representatives")
  .select("*, families(father_last_name, mother_last_name)")
  .eq("school_id", schoolId)
```

### Columnas dinamicas
Se obtienen de `form_fields` para el school_id y form_type correspondiente, mas los campos fijos (`document_id`, `photo_url`). Cada columna se mapea a una key dentro de `form_data` del registro.

### Persistencia en localStorage
```typescript
const storageKey = `adv-search-cols-${schoolId}-${formType}`;
// Guardar: localStorage.setItem(storageKey, JSON.stringify(visibleColumns))
// Leer: JSON.parse(localStorage.getItem(storageKey) || "null")
```

### Archivos a crear/modificar
- **Crear**: `src/pages/school/AdvancedSearch.tsx`
- **Modificar**: `src/components/layout/AppSidebar.tsx` (nuevo item de menu)
- **Modificar**: `src/App.tsx` (nueva ruta)

