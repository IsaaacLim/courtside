# Volleyball Payments

A small, host-only web app for tracking volleyball session attendance and player
payments. Players keep RSVPing in the Facebook group chat as usual; the host uses
this app to record who played each week and tick off payments (Beem / PayID) the
moment money lands — so the months-long manual reconciliation in Excel goes away.

**Phase 1 scope:** the host selects players manually when creating a session. (No
AI / paste parsing yet — the data model is kept AI-ready so that can be added later
without a migration.)

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- SQLite via libSQL — local file for dev, [Turso](https://turso.tech) for production
- Drizzle ORM
- Single shared-password auth via a signed, HTTP-only cookie

## Getting started (local)

```bash
npm install
npm run db:migrate         # creates local.db from the schema
npm run dev                # http://localhost:3000
```

`.env.local` already exists for dev. Log in with the value of `HOST_PASSWORD`
(default `changeme`).

### Environment variables (`.env.local`)

| Variable               | Purpose                                                        |
| ---------------------- | -------------------------------------------------------------- |
| `DATABASE_URL`         | `file:./local.db` for dev; Turso `libsql://…` URL in prod      |
| `DATABASE_AUTH_TOKEN`  | empty for the local file; Turso auth token in prod             |
| `HOST_PASSWORD`        | the single login password for the host                         |
| `AUTH_SECRET`          | long random string used to sign the session cookie             |

## Screens

- `/` — Overview: total outstanding / collected, who owes, recent sessions.
- `/sessions/new` — Create a session: date, rate (defaults to the last session's
  rate), and a searchable player checklist with inline "add new player".
- `/payments` — Search a player → tap **Paid** on unpaid sessions; multi-select for
  a lump-sum payment covering several weeks; **Undo** to reverse.
- `/players` — Manage the roster: add, rename, deactivate, merge duplicates.

## Data model

- `players` — roster (`aliases` reserved for future AI matching).
- `sessions` — one game; `rate` in integer cents.
- `attendances` — a player at a session; `amountDue` is **snapshotted** from the
  session rate at creation, so editing a rate later never rewrites past balances.

Money is stored as integer cents throughout.

## Deploy (Vercel + Turso)

1. Create a Turso database and grab its URL + auth token:
   ```bash
   turso db create volleyball
   turso db show volleyball --url
   turso db tokens create volleyball
   ```
2. Apply the schema to it:
   ```bash
   DATABASE_URL="libsql://…" DATABASE_AUTH_TOKEN="…" npm run db:migrate
   ```
3. Import the repo into Vercel and set the four env vars above (use a strong
   `HOST_PASSWORD` and a long random `AUTH_SECRET`). Deploy.

## Scripts

- `npm run dev` / `build` / `start`
- `npm run db:generate` — generate a new migration after editing `src/db/schema.ts`
- `npm run db:migrate` — apply migrations
- `npm run db:studio` — open Drizzle Studio

---
## Temp

- UI Reference: https://dribbble.com/shots/27532960-Finance-Mobile-App-UI-UX-Design

todo
- New feature
  - Make Jiunn as paid by default
  - Arrange player paid history by 3 months ago, 6 months ago, 9 months ago, more than 1 year ago; have tabs to filter by the year (gotta figure out UI, can't have to tabs)
  - I need a page where I can find the players. (players who have all session paid for can't be found easily)
  - add new session. rate and player names should come out immediately all the time. After some time, the player list refetches (what triggers it?)
  - Add new session. How to handle players that are accidentally added?
- Pages
  - restyle the modal that opens up when a session is selected from a selected player, and vice versa
- Deactivate players
  - How should I treat sessions with unpaid deactivated players? Currently they are still shown there with a button to pay and badge of inactive
  - how should I treat sessions with only one player which is unpaid but get's deactivated. 
- Permanently delete players
  - Give option for inactive player to be permanently deleted
  - Deleted players should be removed from all session histories, including paid and unpaid. (affecting the total)
  - How should I treat empty sessions. Sessions with only the player that got deleted.
- Optimise
  - Fetch the last-rate quicker
  - What causes certain pages to reload again upon revisit?
  - How to handle data fetching & rendering when we start having lots of data
  - In player page, clicking "show inactive" causes the page to load (initial)... quite unecessary to refetch. just gotta do a quick filter. Also, it should it's own tab?
  - clean the tab component to remove unused styles
  - Fetch individual player and session data. opening each one takes sometime
- Style
  - The Player / Session secondary modal need a clear UI to indicate that this is just information, and cannot be selected.
  - Persist scroll position. It works on dev but not on staging and prod
  - Add an animated icon on the Home page to signify 'collect money now'
  - Update Dark mode
- Bug
  - New session modal after keyboard is closed, modal doesn't adjust back down properly. Only way to get that behaviour is if the keyboard is manually closed
  - Mark a player with multipe sessions as all paid, then undo one of them. The background will be transparent until another session is "undo" (same with sessions)