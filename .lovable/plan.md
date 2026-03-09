

## Plan: Botón "Guardar Todos" e indicador de notas no guardadas

### Problema
Actualmente las notas finales solo se guardan individualmente con onBlur. No hay forma de guardar todas de una vez, ni indicador visual de cuáles notas no han sido persistidas en la base de datos.

### Cambios en `src/components/grades/FinalGradesTab.tsx`

1. **Tracking de notas guardadas en BD**: Crear un `Set` o `Record` llamado `savedInDb` que registre qué keys (`studentId-momento`) tienen registro en `final_grades`. Se construye a partir de `existingFinalGrades` y se actualiza tras cada guardado exitoso (individual o masivo).

2. **Detección de "dirty" (no guardado)**: Para cada celda, comparar si el valor actual en `editedGrades[key]` difiere de lo que está en BD, o si tiene valor pero no existe registro en BD. Mostrar un indicador visual (punto naranja o texto "Sin guardar") junto al input cuando la nota no está sincronizada.

3. **Botón "Guardar Todos"**: Agregar un `Button` en la barra superior que:
   - Itere sobre todos los estudiantes y momentos (1, 2, 3)
   - Para cada nota con valor no vacío que no esté guardada en BD (o difiera), ejecute el upsert
   - Para notas vacías con registro en BD, ejecute delete
   - Muestre estado de carga durante el proceso
   - Al finalizar, actualice el tracking de `savedInDb` y muestre toast de éxito
   - Se deshabilite cuando no hay notas pendientes por guardar

4. **Indicador por momento en header**: En cada columna de Momento, mostrar un badge/contador de cuántas notas de ese momento no están guardadas (ej: "3 sin guardar").

### Flujo
- Al cargar, `savedInDb` se construye desde `existingFinalGrades`
- Al editar un input, la celda se marca como "dirty" (borde naranja + indicador)
- onBlur sigue guardando individualmente y actualiza `savedInDb`
- El botón "Guardar Todos" procesa todas las notas dirty en batch
- Cada momento muestra cuántas notas pendientes tiene

### UI
- Botón "Guardar Todos" con icono `Save` al lado de los badges existentes, deshabilitado si no hay cambios pendientes
- Indicador en cada input: borde naranja + punto cuando dirty
- Bajo cada header de Momento: texto pequeño "(X sin guardar)" en naranja cuando hay pendientes

