# Stall Booking Manager

Admin-only internal tool for managing trade fair stall bookings: a visual floor
map, offline payment tracking, and reporting. Built for Chamber Trade Fair
2026, designed to be reused for future events.

## Stack

- `server/` — Node.js + Express + TypeScript + Prisma + PostgreSQL
- `client/` — React + TypeScript + Vite + Tailwind

## First-time setup

```bash
# 1. Database (requires PostgreSQL running locally)
createdb stall_booking

# 2. Backend
cd server
cp .env.example .env   # edit DATABASE_URL if needed
npm install
npx prisma migrate dev
npm run seed            # creates the Chamber Trade Fair 2026 event + admin login
npm run dev              # http://localhost:4000

# 3. Frontend (separate terminal)
cd client
npm install
npm run dev              # http://localhost:5173 (proxies /api to :4000)
```

Seeded admin login: `admin@stallbooking.com` / `changeme123` (override via
`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` env vars before seeding — recommended
for any real deployment).

## What's built (MVP)

- Admin login (JWT)
- Events: create/list, each with its own categories, stalls, and bookings
- Floor map — schematic grid, stalls grouped by category row. Click an
  available stall to select/book it, a booked one to view/manage it.
- **View layout photo** — a button opens the actual uploaded layout image in
  an overlay for reference (not interactive), closes back to the exact same
  screen. Upload/replace it from the Setup tab.
- **Blocking** — "Block / unblock stalls" mode: select available stalls, fill
  in who/why they're held and an optional auto-release date, and they're
  taken off the market. Clicking a blocked stall shows those details with
  **Confirm as booking** (converts it into a real booking, exhibitor
  name/phone carried over) or **Release now**. Auto-release happens next time
  the floor map loads, once the release date has passed.
- Bookings: create (multi-stall), search/filter, add payments (with a
  reference field for non-cash modes), cancel (releases stalls back to
  available), and a "Booked by" (MEC / Chamber of Commerce) tag
- Reports: occupancy + revenue by category, CSV export of exhibitors
- Setup tab: add categories, bulk-generate stalls (e.g. "B1 to B41"), upload
  the layout photo
- User access — under the profile menu (Super Admin only): create/remove
  admin logins. Every account has the same access except managing users.

UI is built on shadcn/ui (Radix + Tailwind v4).

## Not built yet

Online payments, an audit log, exhibitor self-service portal, waitlisting.
