# Project architecture rules

- Scope Sora and Manrope to the Operaciones → RRHH workspace via local Fontsource packages, preserving the established typography across the rest of the intranet.
- Store uniform requests inside the existing OPS-RRHH request record and workflow, because they require the same location, SLA, email, and audit trail.
- Use the shared embedded logo asset for IT form headers in React and archived HTML so printed documents remain self-contained and consistent without network access.- Link Flotilla — Mantenimiento units to Flotilla Vehicular by normalized plate (VIN/chassis fallback) and keep vehicle photos, assignment and documents only in Flotilla Vehicular, so each vehicle has a single identity record; the maintenance backend appends each expense to that vehicle's history for traceability.
- Never create or alter tables in the SafeOne database from the intranet, because Adonis reads and writes it; vehicle links for expenses live in intranet JSON, and any write must go into existing Adonis tables following Adonis numbering.
- Keep the SafeOne Explorer (`backend/routes/safeone-explorer.js`) strictly read-only: fixed SELECT statements, table names validated against the database catalog, binary columns never returned, so inspecting Adonis data can never alter it.
