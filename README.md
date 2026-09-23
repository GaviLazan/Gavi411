# Gavi411

Digitizes an informal concierge service — friends and family ask for travel
rescue, product research, middleman purchases, tech support, or general
info requests; an admin picks them up and handles them over a shared thread.

## Setup

```bash
git clone git@github.com:GaviLazan/Gavi411.git
cd Gavi411
npm install
cd client && npm install && cd ..
npx prisma generate
```

Copy `.env.example` to `.env` (root) and `client/.env.example` to
`client/.env.local`, then fill in real values — see **Environment
variables** below for what each one is for.

Apply the database schema:

```bash
npx prisma migrate deploy
```

## Environment variables

Names only — no real values belong in version control. See `.env.example`
(root) and `client/.env.example` for the exact files to copy.

**Server (`.env`)**
| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (Neon) |
| `CLERK_SECRET_KEY` / `CLERK_PUBLISHABLE_KEY` | Clerk auth |
| `PORT` | Express server port |
| `CLERK_TEST_EMAIL` / `CLERK_TEST_PASSWORD` / `CLERK_TEST_OTP` | Scripted Playwright sign-in checks only |
| `CLOUDINARY_URL` | Image uploads |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web Push |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | Admin's secondary Telegram notification channel |
| `FRONTEND_URL` | Builds permalinks embedded in Telegram notifications |

**Client (`.env.local`)**
| Variable | Purpose |
| --- | --- |
| `VITE_CLERK_PUBLISHABLE_KEY` | Same Clerk app as the server, publishable key only |
| `VITE_VAPID_PUBLIC_KEY` | Same VAPID public key as the server |

## Running it

```bash
npm run dev      # server, with reload (root)
cd client && npm run dev   # client dev server (Vite)

npm test          # server tests (Vitest)
cd client && npm run build   # production client build
cd client && npm run lint    # oxlint
```

## Architecture

- **Client**: React (Vite), plain JavaScript — no TypeScript.
- **Server**: Node.js + Express, ES modules.
- **Database**: PostgreSQL via Neon, accessed through Prisma
  (`prisma/schema.prisma`) — models `User`, `Request`, `Message`,
  `CreditTransaction`, `Notification`, `Device`/`ConversationDeviceKey`
  (multi-device E2E key distribution), `PendingInvite`,
  `PushSubscription`.
- **Auth**: Clerk (OAuth), invite-gated — new accounts can only be created
  via a one-time invite link.
- **Images**: Cloudinary, URL stored on the row.
- **Notifications**: Web Push is primary for everyone; Telegram is a
  secondary, admin-only channel.
- **Deploy**: Vercel (client) + Render (server, free tier — cold start on
  first request).

Folders are `server/` and `client/`, not `backend`/`frontend`.

## Walkthrough

A friend signs up through an invite link, then submits a request through a
short guided intake (travel / purchase / tech support / general). That
opens a thread between the friend and the admin — the admin's cockpit
lists every open request, and messages flow both ways like a support
chat. Each request consumes one of the friend's monthly credits (shown as
a ring in the app bar); the admin can grant an overdraft exception per
cycle. Status changes and new messages trigger a notification (Web Push
to everyone, Telegram as a secondary channel for the admin) that deep-links
back into the relevant request.

Message content is currently stored as plaintext in the database — true
end-to-end encryption was scoped and partially built but is paused as an
optional stretch goal; see `gavi411-e2e-encryption-plan.md`.
