# AGENTS.md

PWA de partes de trabajo y control de horas. Reglas detalladas por área en `.github/skills/`; funciones en `FEATURES.md`.

## Stack

- React 19 + Vite 8 (JavaScript), React Compiler activo.
- Supabase: Auth, Postgres con RLS y Storage (bucket privado `job-pdfs`).
- jsPDF (PDF en cliente), vite-plugin-pwa (Workbox, autoUpdate).
- Despliegue en Vercel desde `main`.

## Comandos

- `npm run dev`, `npm run build`, `npm run lint`, `npm test` (cálculo de horas).
- Verificar siempre con `npm run build` antes de dar un cambio por bueno.

## Skills

Cargar el skill antes de tocar su área:

- `horas-trabajo`: `HoursView.jsx`, `workHours.js`, `workLogsSupabaseStore.js`.
- `pdf-parte`: `jobPdf.js`, subida y borrado de PDFs.
- `supabase-rls`: tablas, permisos, Storage y `scripts/*.sql`.

## Estructura

- `src/App.jsx`: vistas `new`, `list`, `hours`; flujo de trabajos y PDF.
- `src/components/`: un componente por archivo, con su `.css`.
- `src/utils/`: acceso a Supabase (`*SupabaseStore.js`), `workHours.js`, `jobPdf.js`, `useAuth.js`.
- `scripts/*.sql`: esquema y políticas de Supabase.

## Seguridad

- Roles en `profiles.role`: `user` y `admin`.
- Los permisos se aplican con RLS, no solo en la interfaz. Todo permiso nuevo lleva su política en `scripts/`.
- Nunca exponer claves `service_role` en el cliente. El bucket de PDFs es privado y se accede con URL firmada.

## Convenciones

- Interfaz en español; cambios mínimos y localizados.
- Consultas a Supabase solo desde `src/utils/*SupabaseStore.js`.
- Errores de usuario con `Toast`; técnicos con `console.error`.
- Móvil primero; selección y estados activos en ámbar; sin depender del foco por defecto del navegador.
- Hooks antes de cualquier `return` condicional.
- Sin dependencias nuevas salvo necesidad clara.

## Flujo

1. Leer el código afectado antes de editar.
2. Cambios de datos: actualizar `scripts/*.sql` y avisar de que hay que ejecutarlo en Supabase.
3. Commit y push solo si el usuario lo pide. No incluir `.github/` ni archivos ajenos al cambio.
4. No borrar datos reales ni forzar pushes sin confirmación.
