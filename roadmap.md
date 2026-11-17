# Roadmap

- [x] Homogeneizar encabezados F-IT-01 a F-IT-04 en pantalla y documentos imprimibles.
- [x] Verificar logo, títulos y visibilidad al imprimir en A4 con documentos aislados; pendiente comprobar en el servidor real.

- [x] Agregar Uniformes como tipo de solicitud y estructura de prendas.
- [x] Crear selector visual con talla, cantidad y descripción de Otros.
- [x] Adaptar resumen, duplicación, reportes y correos.
- [x] Validar solicitudes de uniformes en cliente y servidor.
- [x] Verificar compilación y presentación adaptable; la vista autenticada requiere sesión del servidor local.

- [x] Flotilla: placas solo de unidades registradas (lista de selección) y taller desde catálogo único.
- [x] Flotilla: gráfica y filtro por mes corregidos; tablero se refresca al guardar.
- [x] Flotilla: Costo Anual con selector de año y diferencias con la hoja Excel.
- [x] Flotilla: aviso de modo local y botón para subir gastos locales al servidor.
- [ ] Flotilla: copiar `backend/routes/fleet-maintenance.js` al servidor y reiniciar `node server.js` (lo hace el equipo de TI).

- [x] Flotilla: vincular Mantenimiento con Flotilla Vehicular (fotos, ficha de trazabilidad, asignación, registro de unidades sin ficha).
- [ ] Flotilla: copiar `backend/routes/fleet-maintenance.js` actualizado al servidor y reiniciar (lo hace TI).
- [ ] Conciliación intranet vs base de datos con opción de registrar, solo para cfabian@safeone.com.do y su designado (espera la indicación del usuario para empezar).

- [x] Flotilla: talleres desde la lista de suplidores de Adonis y unificación de nombres parecidos (con respaldo).
- [x] Flotilla: ficha del vehículo con filtros por año y mes; top de unidades con año y mes.
- [x] Flotilla: vehículo con uno o varios empleados por turnos (en Flotilla Vehicular).
- [x] Flotilla: gastos eliminados quedan anulados con motivo (no se borran) y exportación CSV.
- [ ] Flotilla: copiar `backend/routes/fleet-maintenance.js`, `backend/routes/fleet-db-sync.js`, `backend/lib/fleetSuppliers.js` y `backend/lib/fleetDbSync.js` al servidor y reiniciar (lo hace TI).
- [ ] Registro de facturas en Adonis desde la intranet: espera las 5 consultas del Explorador (TransCargosCP, CargosCP606, Usuario, ClasificacionCyG, CajaChica/CajaChicaD) y una copia de prueba de SafeOne.

- [x] Análisis de facturación de clientes (SafeOne, solo lectura): resumen, clientes, precios por servicio, calidad de datos y exportación Excel.
- [x] Acceso al análisis: abierto a todos los usuarios de la intranet; el super administrador puede limitarlo a una lista de correos.
- [ ] Análisis de facturación: copiar `backend/routes/billing-analysis.js`, `backend/lib/billingAnalysis.js` y `backend/server.js` al servidor y reiniciar (lo hace TI).
- [x] Análisis con datos reales: servicio según clasificación del cliente, clientes por validar, Excel de diagnóstico.
- [ ] Copiar de nuevo `backend/lib/billingAnalysis.js` al servidor y reiniciar (lo hace TI).
- [ ] Siguiente fase: cruce con cuentas Kronos y paquetes Monitoreo + Video + VideoPortero en el catálogo (espera revisar los resultados reales).
