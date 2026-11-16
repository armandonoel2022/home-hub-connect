# Project architecture rules

- Scope Sora and Manrope to the Operaciones → RRHH workspace via local Fontsource packages, preserving the established typography across the rest of the intranet.
- Store uniform requests inside the existing OPS-RRHH request record and workflow, because they require the same location, SLA, email, and audit trail.
- Use the shared embedded logo asset for IT form headers in React and archived HTML so printed documents remain self-contained and consistent without network access.- Link Flotilla — Mantenimiento units to Flotilla Vehicular by normalized plate (VIN/chassis fallback) and keep vehicle photos, assignment and documents only in Flotilla Vehicular, so each vehicle has a single identity record; the maintenance backend appends each expense to that vehicle's history for traceability.
