## Contexto

El formulario de **Familia** (`EditFamily.tsx`) es estático y no tiene campos marcados como `required` configurables (a diferencia de Estudiante y Representante, que sí los tienen en `form_fields`). Por eso no podemos validar "faltantes" de Familia desde la base de datos.

Pero la familia debe poder editarse siempre desde el modal de inscripción.

## Cambio

En `src/components/enrollments/EnrollStudentModal.tsx`, ajustar el `DialogFooter`:

- **Siempre mostrar** los tres botones: "Modificar Estudiante", "Modificar Representante" y "Modificar Familia" (este último ya no condicionado a `hasFamilyMissing`).
- El botón **"Inscribir"** (o "Actualizar Inscripción") solo aparece cuando `isDataComplete` es `true` (ningún required de Estudiante/Representante vacío).
- La alerta naranja "Faltan datos…" sigue mostrando solamente Estudiante y Representante (los únicos con `required` real). La sección Familia ya no se lista como faltante.

Esto deja:
- Validación: solo campos `is_required = true` de `form_fields` (Estudiante + Representante).
- Acceso: el usuario siempre puede entrar a editar Estudiante, Representante **o Familia** desde el modal.
