## Objetivo

Hacer que la encuesta **"Encuesta de Clima 2026 (2)"** (Q2) se comporte igual (o mejor) que la Q1: aparezca en el listado, sume correctamente todas las respuestas de los usuarios, tenga fechas de vigencia editables, un overlay más insistente y un dashboard con reporte descargable.

## Cambios

### 1. Cargar encuestas reales desde el backend
`src/pages/Surveys.tsx` hoy usa solo `INITIAL_SURVEYS` (local), por eso Clima 2026 (2) no aparece como tarjeta y sus respuestas del enlace público (`/encuesta/clima-2026`) no se ven ni se suman.

- Al cargar, hacer `surveysApi.getAll()` y fusionar con la demo Q1.
- Cada tarjeta mostrará el número real de respuestas (`responses.length`) desde `surveys.json`.
- Botón "Ver resultados" habilitado para la Q2 con los mismos permisos.

### 2. Vigencia editable (fechas)
- Nueva opción en el menú de la tarjeta: **Editar vigencia** (solo HR / delegados / admin).
- Modal con `startDate`, `endDate` y checkbox "Overlay obligatorio".
- Persistido vía `surveysApi.update(id, {...})` (endpoint ya existe).
- Cuando `endDate` pase, se marca automáticamente como `cerrada`.

### 3. Overlay más insistente
En `src/components/SurveyOverlay.tsx`:
- Añadir campo `reappearMinutes` por encuesta (default configurable; para Clima 2026 se bajará a **30 min** en vez de 4 h).
- Nuevo modo **"forzoso"** (`enforced: true`): sin botón "Más tarde"; solo se cierra al completar.
- Reevaluar cada 60 s en lugar de 5 min.
- Ambos flags se editan desde el modal de vigencia.

### 4. Dashboard de resultados mejorado
En el modal "Resultados":
- Cabecera con totales: **respuestas totales**, **% de participación** (respuestas / usuarios activos), **última respuesta**.
- Gráfico por pregunta ya existente + **tabla de porcentajes** debajo (opción, conteo, %).
- Preguntas de texto: listado agrupado y buscable.
- **Segmentación por departamento** (respuesta a q1) con desglose colapsable.

### 5. Reporte descargable
Dos botones dentro del modal de resultados:
- **Exportar Excel** (`.xlsx`) usando `xlsx` (ya en el proyecto): una hoja "Resumen" (pregunta, opción, conteo, %) y una hoja "Respuestas" con filas por usuario.
- **Exportar PDF** con `jsPDF` + `jspdf-autotable` (ya usados en otros módulos): portada SafeOne, resumen, gráficos como imagen, respuestas de texto anonimizadas.

### 6. Backend
`backend/routes/surveys.js`:
- Aceptar y persistir `reappearMinutes` y `enforced` en `PUT /:id`.
- Actualizar el seed `SEED_SURVEY` para incluir `startDate`, `endDate` reales del Q2, `reappearMinutes: 30`, `enforced: true`.
- El endpoint `/public/active` ya filtra `status === 'activa'`; añadir chequeo por `endDate`.

## Detalles técnicos

- Tipo `SurveyApi` en `src/lib/api.ts`: añadir `reappearMinutes?: number` y `enforced?: boolean`.
- La página fusiona por `id` (backend gana sobre demo).
- Export usa las libs ya presentes; no se añaden dependencias.
- No se toca la lógica de eliminación, delegación ni visibilidad ya existentes.

## Fuera de alcance
- Notificaciones push nativas para recordar (se puede agregar después).
- Migrar la Q1 demo al backend (queda como demo local).
