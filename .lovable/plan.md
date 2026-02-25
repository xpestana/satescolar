
# Mover columna "Estado" al lado de "Acciones"

## Cambio

Reordenar las columnas de la tabla en `src/pages/school/EnrollmentsList.tsx` para que "Estado" aparezca inmediatamente despues de "Acciones", antes de "Foto".

### Encabezados (TableHeader)
Orden actual: Acciones | Foto | Nombre | Cedula | Familia | [dinamicas] | Grado | Estado

Orden nuevo: Acciones | Estado | Foto | Nombre | Cedula | Familia | [dinamicas] | Grado

### Cuerpo (TableBody)
Mover la celda del Badge de estado (lineas 590-596) para que aparezca justo despues de la celda de Acciones (linea 573), antes de la celda de Foto.

### Archivo a modificar
- `src/pages/school/EnrollmentsList.tsx`
  - Linea 514: mover `<TableHead className="text-center">Estado</TableHead>` despues de la linea 505 (Acciones)
  - Lineas 590-596: mover el bloque `<TableCell>` del estado despues del cierre de la celda de Acciones (linea 573)
