# Corregir el ciclo de sesión al cambiar contraseña

## Objetivo
Evitar que Chrisnel Fabian —y cualquier usuario en la misma situación— cambie su contraseña, entre brevemente y sea enviado de nuevo al inicio de sesión.

## Cambios
- Hacer que el acceso del servidor acepte exactamente los identificadores ofrecidos por la pantalla: correo, nombre, ID, código de empleado o cédula.
- Cuando la intranet está conectada al servidor, no crear una sesión local simulada si el acceso real falla; mostrar el error y mantener una única fuente de autenticación.
- Tratar una contraseña actual incorrecta como error de validación, no como token inválido, para que no se borre la sesión.
- Tras cambiar la contraseña, devolver y guardar el usuario actualizado y comprobar que `mustChangePassword` quedó desactivado.

## Verificación técnica
- Ejecutar el ciclo real en un almacén JSON aislado: acceso con contraseña temporal, cambio obligatorio, consulta autenticada posterior y nuevo acceso con la contraseña nueva.
- Probar también que una contraseña actual incorrecta no elimina el token y que credenciales incorrectas no generan una sesión local.
- Ejecutar las pruebas relevantes del frontend.
