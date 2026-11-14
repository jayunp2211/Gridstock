# Gridstock

A private marketplace that matches stranded data center electrical and cooling gear (new or never-energized switchgear, breakers, CDUs from cancelled or delayed projects) with builders whose energization dates are at risk.

## What works

- **Sellers** list gear privately with nameplate specs, condition, location, availability, asking price and warranty status.
- **Buyers** post a need: spec, acceptable OEMs and conditions, site, need-by date, budget ceiling.
- **Matching** (`lib/match.ts`) runs whenever either side posts. Voltage, minimum amps, category and condition are hard requirements; kAIC, schedule, quantity, OEM, enclosure, budget and freight distance lower a 0–100 fit score and are listed as gaps. Matches under 40 are dropped.
- **Privacy:** buyers see specs only. Seller identity, asking price and notes stay hidden until both sides accept the mutual NDA in the deal room.
- **Deal rooms:** NDA → documents → offer → inspection → escrow → closed (or lost), with messages and offers. Ops moves stages.
- **Ops dashboard** (`/admin`): pipeline counts, deals, open requests by need-by date, and accounts to verify.
- **Inbox:** in-app notifications for new matches, intro requests and messages.

## Run locally

Requires Node 22+ and Postgres.

```bash
npm install
export DATABASE_URL=postgres://user:pass@localhost:5432/gridstock
npm run db:migrate
npm run db:seed      # fictional demo companies and gear
npm run dev
npm test             # matching unit tests
```

Sign in at `/login` with a demo account, such as the buyer "Alex Chen", the seller "Dana Ruiz", or "Ops Team".

## Not done yet

- **Auth:** the prototype uses a cookie with a user id and a demo picker. Replace it with Supabase Auth (magic link) before real users touch it.
- **Hosting:** `db/*.sql` is plain Postgres, so it runs on Supabase as is. Set `DATABASE_URL` and deploy to Vercel.
- **Email:** notifications are in-app only. Send them through Resend.
- **Documents:** file uploads (submittals, test reports, nameplate photos) and LLM spec extraction from them.
- **Payments:** escrow goes through a third-party service.
