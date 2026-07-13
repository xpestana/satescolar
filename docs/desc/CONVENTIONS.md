# Convenciones de desarrollo (léelo antes de implementar cualquier tema)

> Este archivo **conecta con todos** los `desc/`. Cuando tomes el contexto de un tema para
> desarrollar, aplica **siempre** estas convenciones. Son de cumplimiento obligatorio.

## 0. Regla de oro
Código **en inglés**, interfaz de usuario **en español**. Una responsabilidad por archivo.
Tipado estricto. Con pruebas. Formateado y consistente. Multi-tenant seguro.

---

## 1. Idioma: nombres en inglés (obligatorio)
Todo **identificador de código** va en **inglés**: variables, funciones, tipos/interfaces,
componentes, hooks, nombres de archivo, tablas y columnas de base de datos, Edge Functions,
ramas y mensajes de commit.

- ✅ `studentBalance`, `getActiveSchoolYear()`, `PaymentLedgerTable`, `invoice_templates`
- ❌ `saldoEstudiante`, `obtenerAnioActivo()`, `tablaMorosos`, `plantillas_factura`

**Única excepción:** los **textos visibles al usuario** (labels, botones, mensajes, toasts)
van en **español**, porque la app es en español. Idealmente centralizados para poder
internacionalizar después. Nunca mezcles idioma en un identificador (`fetchMorosos` ❌).

> Nota: hoy existen nombres mixtos heredados (p. ej. `BolletasFormatTab`). No los repliques;
> el estándar para código nuevo es inglés correcto.

## 2. SOLID aplicado al stack (React + TS + Supabase)
- **S — Single Responsibility:** un archivo = una responsabilidad. Separa **UI** (componente
  presentacional), **estado/datos** (hook con React Query), y **lógica de negocio/formato**
  (`src/lib/*` puro y testeable). Un componente que hace fetch + calcula + renderiza + exporta
  PDF debe partirse.
- **O — Open/Closed:** extiende por composición/props/config, no editando el núcleo. Ej.: los
  formatos de boleta/factura se extienden con nuevas plantillas (`config`), no tocando el
  render base.
- **L — Liskov:** los componentes/variantes deben ser intercambiables sin romper contratos
  (mismas props/estados esperados).
- **I — Interface Segregation:** props y tipos pequeños y específicos; evita "prop-drilling"
  de objetos gigantes. Prefiere tipos por caso de uso.
- **D — Dependency Inversion:** la UI depende de abstracciones (hooks/servicios), no de
  `supabase` directamente en el JSX. El acceso a datos vive en hooks/`lib`, no en componentes.

## 3. Responsabilidad por archivo (organización)
- `src/pages/**` — vistas enrutadas (composición, poca lógica).
- `src/components/<dominio>/**` — componentes de UI reutilizables por dominio.
- `src/hooks/**` — estado y acceso a datos (React Query, sesión, permisos).
- `src/lib/**` — lógica pura, formato, generación de documentos (sin React, testeable).
- `src/integrations/supabase/**` — cliente y tipos generados (no editar tipos a mano).
- `supabase/functions/<name>/**` — Edge Functions (Deno) para lógica privilegiada.
- `supabase/migrations/**` — esquema (idempotente, revisado).

Un componente/hook/util **por archivo**, con nombre igual al export principal. Si un archivo
supera ~300–400 líneas o mezcla temas, divídelo.

## 4. Pruebas (obligatorias para lógica)
- Runner: **Vitest** (`npm test` → `vitest run`; `npm run test:watch`). RTL + jest-dom
  disponibles para componentes.
- **Obligatorio** cubrir con tests toda la lógica de `src/lib/**` (cálculos de saldo/notas,
  formato de documentos, parsers de import). Referencia existente:
  `src/lib/gradeLiteral.test.ts`.
- Tests junto al archivo: `<name>.test.ts(x)`. Prueba **casos borde** (montos 0/negativos,
  año sin activar, campos opcionales, listas vacías).
- No hagas merge de lógica de negocio nueva sin su prueba.

## 5. Formato y estilo (Prettier / indentación)
- Mantén el estilo del repo: **2 espacios**, comillas dobles, punto y coma, `import` con alias
  `@/`. Respeta ESLint: **`npm run lint` sin errores** antes de terminar.
- ⚠️ Hoy **no hay Prettier configurado** en el repo. Formatea manualmente de forma consistente
  con el archivo que edites. *Mejora sugerida:* añadir Prettier + `.editorconfig` y un script
  `format` para automatizar (evita ruido de estilo en los diffs).
- Nada de código muerto, `console.log` olvidados ni imports sin usar.

## 6. Buenas prácticas adicionales (las que faltaban)
- **Tipado estricto:** evita `any`. Hoy hay `from("tabla" as any)` para tablas sin tipar;
  para código nuevo, regenera/усa los tipos de `src/integrations/supabase/types.ts` en vez de
  castear a `any`.
- **Multi-tenant / seguridad:** **siempre** acota por `school_id` y confía en RLS; nunca
  expongas datos de otro colegio. La `service_role` solo vive en Edge Functions, jamás en el
  cliente. Secretos en variables de entorno, no en el bundle.
- **Operaciones privilegiadas → Edge Function:** altas de usuarios, cambios de contraseña,
  importaciones, envíos de correo y firmas S3 van por `supabase/functions/**`, no por el cliente.
- **Datos con React Query:** usa `queryKey` consistentes e `invalidateQueries` tras mutaciones;
  no dupliques fetching en componentes.
- **Validación con zod:** valida formularios/entradas (react-hook-form + zod ya están en el stack).
- **Dinero:** montos en **VES** con conversión por `exchange_rate`/`bcv_rates`; el estado de
  cuenta se calcula sobre `student_concept_balances`, no sobre `payments`. Cuidado con
  redondeos. Ver [12-pagos](12-pagos.md).
- **No hardcodear formatos:** boleta/factura se leen de `/formatos`
  (`boleta_templates`/`invoice_templates`). Ver [09-notas](09-notas-y-boletas.md) y [12-pagos](12-pagos.md).
- **Año activo:** resuelve el año escolar por `school_years.is_active`, no por constantes.
- **Eje académico:** lo académico cuelga de `subject_teacher_assignments`. Ver [06-areas-materias](06-areas-materias.md).
- **Accesibilidad:** usa los componentes `shadcn/ui` (Radix) con labels y roles correctos.
- **Errores:** maneja y muestra errores al usuario (toasts) sin tragarlos; loguea lo útil.
- **Migraciones idempotentes y revisadas;** nunca edites tipos generados a mano.
- **Commits:** Conventional Commits (`feat(...)`, `fix(...)`) como ya usa el repo.

---

## Cómo se conecta con los demás `desc/`
Todos los archivos de temas enlazan aquí. Al implementar cambios de un tema, primero lee su
`desc` (contexto funcional + tablas) y **después** aplica estas convenciones (cómo escribir el
código). Índice general en [README](README.md).
