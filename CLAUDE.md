# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Commands

```bash
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production build
npm run lint     # ESLint check
npm run seed     # Seed database (tsx lib/seed.ts)
```

Database schema changes:
```bash
npx prisma migrate dev --name <description>   # Create and apply migration
npx prisma generate                            # Regenerate Prisma client
npx prisma studio                              # Browse database
```

## Architecture

This is a **delivery dispatch platform** for a courier company in Bizerte, Tunisia. The Next.js app serves two audiences: an admin dashboard and a courier-facing mobile interface (PWA).

### Key directories

- `app/api/` — REST API routes (auth, couriers, deliveries, tracking, alerts, stats)
- `app/page.tsx` — Admin dashboard (live map + dispatch UI)
- `app/[courier]/[id]/` — Courier-facing PWA (receives jobs, updates status)
- `components/` — UI split into `courier/`, `delivery/`, `map/`, `ui/`
- `lib/` — Shared utilities (see below)
- `prisma/` — Schema and migrations

### lib/ modules

| File | Purpose |
|------|---------|
| `openapi.ts` | OpenAPI 3.0 spec — **single source of truth** for all API shapes. Edit here; Swagger UI at `/api-docs` auto-reflects changes |
| `types.ts` | TypeScript interfaces shared across client and server |
| `pusher.ts` | Pusher channel/event name constants (server) |
| `pusher-client.ts` | Client-side Pusher subscription hook |
| `db.ts` | Prisma client with cold-start retry logic for Neon serverless |
| `auth.ts` | HMAC-signed session cookie helpers |
| `geo.ts` | Geographic distance/bearing calculations |
| `osrm.ts` | OSRM routing API client for route optimization |
| `useGpsTracking.ts` | React hook for GPS polling |
| `useWebPush.ts` | Web Push subscription hook (client) |
| `web-push.ts` | Server-side Web Push helpers |
| `firebase-admin.ts` | Firebase Admin SDK init for FCM |
| `seed.ts` | Database seed script |

### Data flow

1. **GPS tracking**: Flutter mobile app → `POST /api/tracking` → Prisma (CourierLocation) → Pusher broadcast → admin dashboard map updates in real time
2. **Dispatch**: Admin assigns delivery via dashboard → `PATCH /api/deliveries/[id]` → Pusher event to courier channel → courier app receives job
3. **Status updates**: Courier taps status → `PATCH /api/deliveries/[id]` → Pusher event → admin dashboard update

### Auth model

- **Admins**: HMAC-signed `lakou_admin_session` cookie (set by `POST /api/auth/login`)
- **Couriers**: Access key stored in `Courier.accessKey`, validated by `POST /api/auth/courier-login`
- Public endpoints (`GET /api/docs`, login routes) carry `security: []` in the OpenAPI spec

### Real-time (Pusher)

Channel names and event names are defined as constants in `lib/pusher.ts`. All real-time logic goes through Pusher Channels — there are no WebSocket routes in Next.js.

### Database

PostgreSQL on Neon (serverless). Two connection strings required in `.env`:
- `DATABASE_URL` — pooled (pgbouncer) for runtime queries
- `DIRECT_URL` — direct for Prisma migrations

Delivery statuses: `pending` → `assigned` → `picked_up` → `delivered` (or `cancelled`).

### API documentation

- `/api-docs` — Swagger UI (try-it-out; authenticate via `POST /api/auth/login` first)
- `/api/docs` — Raw OpenAPI 3.0 JSON

When adding or modifying endpoints, update `lib/openapi.ts` alongside the route handler.

## Companion app

`../LakoudCourssierApp/` is a Flutter app for couriers. It communicates exclusively via the REST API defined above. Run with `flutter run` from that directory.
