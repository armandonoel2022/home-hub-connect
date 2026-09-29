# Solicitudes de uniformes — Operaciones a RRHH

## Objetivo
Agregar **Uniformes** como un nuevo tipo de solicitud dentro del centro de gestión Operaciones → RRHH, conservando el flujo, seguimiento, correos, SLA e historial existentes.

## Cambios
- Incorporar el tipo **Uniformes** en formularios, listados, filtros, plantillas, reportes y correos.
- Mostrar un selector visual de prendas con iconos claros para: camisas manga larga, camisas manga corta, T-shirts, holster, pantalón cargo, pantalón, zapatos, botas militares, gorras, correas, jackets, linternas y otros.
- Permitir agregar varias prendas en una misma solicitud, indicando cantidad y talla cuando corresponda.
- Exigir una descripción manual cuando se elija **Otros**.
- Identificar al agente que recibirá el uniforme, usando la asignación del puesto o entrada manual cuando no figure en gSafeOne.
- Adaptar el resumen de la solicitud para mostrar beneficiario y detalle de prendas, ocultando campos de movimientos de personal que no aplican.
- Mantener Cliente → Localidad → Puesto → Turno para saber dónde se requiere la indumentaria.
- Validar los nuevos datos tanto en la pantalla como en el servidor para evitar solicitudes incompletas.

## Diseño
- Tarjetas compactas con iconos lineales de cada categoría, selección visible y controles simples de talla/cantidad.
- Misma identidad moderna carbón, dorado y azul del espacio Operaciones → RRHH.
- Diseño adaptable para computadora y celular, sin imágenes externas ni datos sintéticos.

## Verificación
- Crear una solicitud con varias prendas y otra con **Otros**.
- Confirmar guardado, apertura desde listado, duplicación, filtros, reportes y contenido enviado por correo.
- Revisar visualmente la pantalla en escritorio y móvil.
