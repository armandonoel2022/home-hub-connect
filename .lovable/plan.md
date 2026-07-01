# Seguimiento Clientes Monitoreo — Comparación día a día, Punches automáticos e Incidencias vivas

Tres mejoras conectadas dentro de **Seguimiento Clientes Monitoreo**, todas apoyadas en los reportes Kronos que ya se cargan y guardan por fecha.

## 1. Actividad Kronos — Cambios de un día para otro
Cuando se selecciona/carga un reporte, se compara automáticamente contra el reporte Kronos **inmediatamente anterior** (por fecha, del historial ya guardado).

- Nuevo panel/KPI **"Cambios vs. día anterior"** con contadores clic-filtrables:
  - **Empeoraron** (criticidad subió, p.ej. Al día → Sin señal).
  - **Mejoraron / recuperaron** (volvieron a reportar).
  - **Nuevas cuentas** (aparecen hoy y no ayer).
  - **Dejaron de aparecer** (estaban ayer, no hoy).
  - **Cambios de energía** (perdió/recuperó CA, batería baja nueva).
- En la tabla, cada fila muestra una columna/badge **Δ** ("Δ" con flecha ↑ empeoró en rojo, ↓ mejoró en verde, ● nueva) con tooltip del estado anterior → actual.
- Selector para elegir contra qué reporte comparar (por defecto el anterior).

Implementación: helper `src/lib/kronosDiff.ts` con `diffKronosReports(prev, curr)` que devuelve un mapa por `accountCode` con `{ prevCrit, currCrit, direction, prevPowerOk, currPowerOk, isNew, disappeared }` y totales. En `KronosActivityTab` se carga el reporte anterior del historial y se calcula el diff con `useMemo`.

## 2. Punches alimentado por dispositivos Active Track del reporte Kronos
Hoy la pestaña Punches solo vive de un `.htm` Active Track aparte. Se agregará una fuente automática: las cuentas marcadas como **Active Track** (por `serviceType` o por cliente con bastón, misma lógica `batonCodes` ya existente) que aparecen en el **reporte Kronos cargado**.

- Al no haber (o además del) reporte de punches subido, la pestaña listará las cuentas Active Track tomadas del último reporte Kronos, mostrando última señal, días sin señal y criticidad, con aviso "Derivado de Actividad Kronos".
- Estas filas permiten definir/evaluar reglas de rondas igual que las cargadas por `.htm` (cuando aplica), y se marcan con origen `kronos` vs `punch-report`.
- Un banner indica cuántas cuentas Active Track hay en Kronos vs cuántas tienen reporte de punches propio, para detectar bastones sin datos de rondas.

Implementación: `PunchActivityTab` carga el último reporte Kronos (`monitoringReportsApi.list/get("kronos")`) + settings, deriva las cuentas Active Track y las fusiona con los clientes del reporte de punches (dedupe por `accountCode`).

## 3. Incidencias contrastadas con Actividad Kronos
Cada incidencia se cruza por `accountCode` contra el **último reporte Kronos** para inferir si el problema persiste o se resolvió.

- Badge por incidencia:
  - **Sigue ocurriendo** (rojo): la cuenta sigue sin señal / criticidad alta / sin cierre, coherente con la incidencia.
  - **Posiblemente resuelta** (verde): la cuenta ya reporta señal reciente (o ciclo apertura/cierre) después de creada la incidencia.
  - **Sin datos Kronos** (gris): la cuenta no está en el reporte.
- Se muestra la **última señal** de Kronos junto a la incidencia y la fecha del reporte usado.
- Botón contextual "Marcar como resuelta" resaltado cuando Kronos sugiere recuperación (no cambia el estado solo; lo sugiere al operador).

Implementación: helper `src/lib/incidentKronosCheck.ts` con `assessIncidentVsKronos(incident, kronosRow)`. En la vista de Incidencias (dentro de `ClientTracking.tsx`) se carga el último reporte Kronos y se calcula el estado por incidencia.

## Notas técnicas
- Todo se apoya en el almacenamiento existente por fecha (`monitoring_reports.json`, `kind="kronos"|"punches"`) y en `monitoringAccountSettingsApi`; **no** se toca gSafeOne (solo lectura) ni se agregan tablas.
- Sin cambios de backend salvo que haga falta; la comparación y el cruce ocurren en el cliente con los reportes ya persistidos.
- Se respeta la terminología y los tokens de diseño existentes; se reutilizan `batonCodes`, criticidad y parser actuales.

¿Apruebas este alcance? Al aprobar implemento en el orden 1 → 2 → 3.