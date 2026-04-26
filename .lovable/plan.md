

# Estado actual: la UI ya está implementada

Revisé `src/pages/representative/ChildClassroom.tsx` y `src/components/classroom/StudentSubmissionPanel.tsx` — todo lo que pides ya está construido en el paso anterior. No se necesitan cambios.

## Lo que ya tiene la pestaña "Actividades" del aula del estudiante

Para cada actividad evaluable (`task`, `quiz`, `forum`, `evaluated`) se renderiza el panel `StudentSubmissionPanel` debajo del enunciado. El panel incluye:

1. **Textarea** para escribir la respuesta o comentario (opcional).
2. **Botón "Adjuntar archivo"** (componente `S3AttachmentInput`) que sube directo a S3 al prefijo `schools/<school_id>/submissions/<student_id>/`.
3. **Chips** con cada archivo subido (nombre, tamaño, ícono según tipo, botón quitar).
4. **Botón "Enviar entrega"** / **"Reenviar entrega"** según corresponda.

## Estados visuales según permisos del docente

| Situación | Lo que ve el estudiante |
|---|---|
| Sin entrega + a tiempo | Formulario completo + botón **"Enviar entrega"** |
| Ya enviado + `allow_resubmission = true` | Badge "Enviado" + fecha + formulario + botón **"Reenviar entrega"** |
| Ya enviado + `allow_resubmission = false` | Badge "Enviado" + mensaje *"Ya enviaste esta actividad. El docente no permite reenvíos."* |
| Vencido + `allow_late_submission = true` | Formulario habilitado, al enviar marca status `submitted_late` |
| Vencido + `allow_late_submission = false` | Mensaje *"El plazo de entrega ya venció y no se permiten entregas tardías."* |
| Calificado | Badge verde con `score/max_score` + comentarios del docente |

Además, en la lista de actividades cada tarjeta muestra un badge de estado: **Pendiente / Entregado / Vencido / Calificado**, y la pestaña **"Calificaciones"** muestra una tabla resumen con la nota de cada actividad evaluable.

## Adjuntos enviados visibles

Si el estudiante ya envió archivos, aparecen listados como enlaces descargables (con ícono y nombre) dentro del panel, leídos desde `classroom_submission_attachments`.

## Conclusión

El flujo solicitado está completo y funcional. Puedes probarlo entrando como representante en `/representative/estudiantes` → seleccionar un hijo → "Aula Virtual" → introducir el código de acceso → elegir una materia → pestaña **Actividades**.

Si al probarlo notas algún detalle visual que quieras ajustar (por ejemplo: mover el panel a un modal, cambiar textos, agregar confirmación antes de reenviar, mostrar contador de caracteres, etc.), dímelo y lo afino.

