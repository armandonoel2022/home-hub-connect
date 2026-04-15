---
name: Vinculación Armas-Activo Fijo
description: Sistema de vinculación automática entre registros de Personal Armado y Activo Fijo (tipo ARM) por serial de arma. Remit Lopez ve datos de inventario sin acceder al módulo de Activo Fijo de Chrisnel.
type: feature
---
Las armas registradas en Personal Armado se vinculan automáticamente con registros de Activo Fijo (tipo=ARM) comparando seriales normalizados (sin ceros iniciales, case-insensitive).

- `src/lib/weaponAssetLinking.ts`: Utilidades de vinculación (findLinkedAsset, buildWeaponAssetMap, getLinkingStats)
- En la vista de lista se muestra columna "Activo Fijo" con el código SSC-ARM-XXXXX (verde si vinculado, amarillo si no)
- En el modal de detalle se muestra sección completa con código, descripción, estado, condición, fecha de adquisición
- Dashboard muestra estadísticas de cobertura de vinculación
- Activo Fijo es de acceso exclusivo para Chrisnel Fabian (Administración)
- Personal Armado es de acceso para Operaciones (Remit Lopez)
