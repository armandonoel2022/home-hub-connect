---
name: Bóveda de Armas
description: Módulo de bóveda que extiende el Expediente de Clientes solo con armamento, movimientos con empleados activos y escena animada
type: feature
---
Ruta `/operaciones/boveda` (`src/pages/WeaponVault.tsx`).

- Fuente de datos: misma que Expediente de Clientes — `generalSqlApi.expediente()`, `generalSqlApi.weapons()`, `expedienteOverlayApi.list()`; se arman filas con `buildArmaRows` (ArmasGlobalView) y se filtra solo armamento.
- `src/lib/vaultWeapons.ts`: clasifica escopeta/revólver/pistola, calcula estado (bóveda vs puesto) aplicando el último movimiento, conteos por tipo y validaciones (no entregar arma ya asignada, no devolver arma que no está asignada a ese empleado).
- Movimientos en `opsExpediente` (localStorage + backend `vault_movements.json`), con `empleadoCodigo`/`empleadoOid` de `generalSqlApi.employeesActive()`.
- UI: `src/components/vault/VaultRoom.tsx` (puerta acorazada framer-motion, rack vertical de escopetas y estantes horizontales para armas cortas) y `WeaponSvgs.tsx` (SVGs de escopeta/pistola/revólver).
