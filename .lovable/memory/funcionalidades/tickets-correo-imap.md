---
name: Tickets IT por correo (IMAP/SMTP)
description: Buzón tecnologia@safeone.com.do conectado a Tickets IT — entrada IMAP crea tickets, SMTP envía acuses y actualizaciones
type: feature
---

Buzón de soporte: `tecnologia@safeone.com.do`
- IMAP `mail.safeone.com.do:993` (SSL) · SMTP `mail.safeone.com.do:465` (SSL)
- Credenciales SOLO en `backend/.env` (`IT_MAIL_USER`, `IT_MAIL_PASS`, `IT_IMAP_*`, `IT_SMTP_*`). Nunca en el código.
- Requiere en el servidor: `npm install imapflow mailparser nodemailer`.

Flujo bidireccional (`backend/services/mailTickets.js`):
- Correos no leídos → ticket nuevo (categoría y prioridad detectadas del texto; SLA Crítica 2h / Alta 8h / Media 24h / Baja 72h, asignado a Armando Noel).
- Asunto con referencia `[TK-XXXX]` → se agrega como comentario al ticket existente.
- Salida: acuse al crear, notificación al cambiar de estado y `POST /api/tickets/:id/reply` para responder desde la intranet.
- Polling automático cada `IT_MAIL_POLL_MINUTES` (5 por defecto) + botón "Sincronizar correo" en Tickets IT (`MailSyncPanel`, visible sólo para Tecnología).
