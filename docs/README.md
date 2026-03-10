# QSOlive Documentation

This folder contains the core documentation for QSOlive, organized into four main documents.

---

## 1. [Architecture](architecture.md)

**System design, data flow, and technology choices.**

- Overview and architecture diagram
- Data flow (contact submission, query, real-time)
- Components: Windows client, Supabase backend, web frontend
- Database schema summary and indexes
- Security, performance, and future enhancements

*Read this first for a high-level understanding of how QSOlive works.*

---

## 2. [Client setup](client-setup.md)

**Installing and configuring the Windows client.**

- Prerequisites and development setup (Python, venv, dependencies)
- Configuration (`config.json`, built-in Supabase for distribution)
- Running the client and configuring your logger (UDP port 2237, ADIF)
- Packaging: PyInstaller executable and Inno Setup Windows installer
- Troubleshooting and security practices

*Use this to get the client running and to build/distribute the installer.*

---

## 3. [Database setup](database-setup.md)

**Setting up the Supabase/PostgreSQL database.**

- Creating a Supabase project and enabling PostGIS
- Full schema: contacts, profiles, clubs, club_roster, RLS, functions
- Migration order (client SQL files) and verification
- RPCs: `get_display_logs`, `get_display_logs_clubs`, `get_club_by_name`
- Backups and next steps

*Use this to create and maintain the database for a new deployment.*

---

## 4. [Deployment](deployment.md)

**Dev vs prod, Vercel, and Supabase CLI.**

- Dev: local + Vercel preview (one Supabase project)
- Prod: Vercel production + separate Supabase project; schema via Supabase CLI
- Release process for 1.0 and beyond; environment summary

*Use this when setting up or updating dev/prod deployments and cutting releases.*

---

## How the docs fit together

1. **Architecture** – describes the system; references client and database at a high level.
2. **Database setup** – run first when standing up a new instance (schema, RLS, functions).
3. **Client setup** – configure and run the client (and optionally the frontend) against that database.
4. **Deployment** – dev (local + Vercel) vs prod; Supabase CLI for prod schema; release process.

---

All previous requirements, specs, and editor-setup content (Settings & Club Admin, request to join a club, club uniqueness, VS Code) are folded into the three main documents above.
