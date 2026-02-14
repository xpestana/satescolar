

# Paginacion y Botones de Descarga - Plan

## Resumen
Agregar paginacion visible siempre (ya existe pero solo aparece con mas de 1 pagina) y tres botones de descarga (PDF, Excel, CSV) con un selector de columnas independiente para exportar.

## Cambios a realizar

### 1. Paginacion siempre visible
La paginacion ya funciona correctamente con el componente `data-pagination`. Solo se necesita asegurar que siempre se muestre el conteo de resultados y la paginacion cuando haya datos.

### 2. Botones de descarga (PDF, Excel, CSV)
Agregar tres botones en la barra de controles:
- **CSV**: Genera archivo `.csv` con los datos filtrados
- **Excel**: Genera archivo `.xlsx` usando los datos filtrados
- **PDF**: Genera archivo `.pdf` con tabla formateada

### 3. Selector de columnas independiente para exportacion
Un segundo popover (junto a los botones de descarga) que permite elegir que columnas incluir en la exportacion, sin afectar las columnas visibles en la tabla de busqueda. Por defecto, hereda las columnas activas de la tabla, pero se pueden modificar de forma independiente. Este estado se mantiene en memoria (no se persiste).

### 4. Dependencias nuevas
- **jspdf** + **jspdf-autotable**: Para generar PDFs con tablas
- **xlsx**: Para generar archivos Excel

---

## Detalles Tecnicos

### Archivos a modificar
- `src/pages/school/AdvancedSearch.tsx` - Agregar botones de descarga, popover de columnas de exportacion, y logica de generacion de archivos

### Nuevo estado
```typescript
// Columnas seleccionadas para exportar (null = usar las mismas de la tabla)
const [exportColumns, setExportColumns] = useState<string[] | null>(null);
// Las columnas efectivas de exportacion
const effectiveExportColumns = exportColumns ?? activeColumnKeys;
```

### Estructura de botones
```text
[Tabs] [Busqueda...] [Columnas] [Exportar ▾ (columnas)] [CSV] [Excel] [PDF]
```

El boton "Exportar" abre un popover con checkboxes para elegir las columnas de exportacion. Los botones CSV/Excel/PDF ejecutan la descarga con esas columnas.

### Logica de exportacion
- Se excluye la columna `photo_url` de las exportaciones (no tiene sentido en archivos)
- Se usa `filtered` (todos los resultados filtrados, no solo la pagina actual) para exportar
- Se obtiene el valor de texto de cada celda reutilizando la logica de `getCellValue` pero retornando solo texto plano

### Generacion CSV
Generacion manual sin dependencia externa: construir string con separador `,` y descargar como blob.

### Generacion Excel
Usar la libreria `xlsx` (SheetJS) para crear un workbook con los datos y descargarlo.

### Generacion PDF
Usar `jspdf` con el plugin `jspdf-autotable` para crear una tabla formateada en PDF.
