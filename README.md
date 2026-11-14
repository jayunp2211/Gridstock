# Gridstock

A private marketplace that matches stranded data center electrical and cooling gear (new or never-energized switchgear, breakers, CDUs from cancelled or delayed projects) with builders whose energization dates are at risk.

## What works

- **Sellers** list gear privately with nameplate specs, condition, location, availability, asking price and warranty status. Each listing shows the open requests it fits, and the seller can propose an intro, withdraw the listing or list it again.
- **Buyers** post a need: spec, acceptable OEMs and conditions, site, need-by date, budget ceiling. They can close a request and reopen it.
- **Matching** (`lib/match.ts`) runs when either side posts, and again whenever a request or listing is opened, so the fit on screen always follows the current rules. Category, voltage class, minimum amps and condition are hard requirements; kAIC, schedule, quantity, OEM, enclosure and freight distance lower a 0–100 fit score and are listed as gaps. Matches under 40 are dropped. The score is a first screen on nameplate data, and it never sees price or budget.
- **Privacy:** each side sees specs only. Names, asking price, budget and notes stay hidden until both sides accept the mutual NDA in the deal room.
- **Deal rooms:** NDA → documents → offer → inspection → escrow → closed (or lost), with messages and offers. Prices are totals for the quantity in the deal, shown with the per-unit figure and the buyer-paid fee. Either side can leave before an offer is accepted. Ops moves the later stages.
- **Ops dashboard** (`/admin`): pipeline counts, deals, open requests by need-by date, sample accounts to verify, a count of real access requests, and a button that resets the demo.
- **Inbox:** in-app notifications for new matches, intros, NDA signatures, offers and messages.

## Sample data and real accounts

Accounts whose address ends in `.test` are sample accounts. They are the only ones that can sign in, through the picker on `/login`, and everything they own is demo data that `npm run db:seed` or the reset button puts back.

A real company uses **Request access** on `/login`. That stores an unverified row in `users` and nothing else: no session, no listing, no place in the picker or the Ops page. Real accounts stay locked until email sign-in exists. Sample and real accounts are never matched with each other.

The home page shows listings and requests from verified real accounts. While there are none, it shows fixed examples built in `lib/demo.ts` and labels them as samples.

## Run locally

Requires Node 22+ and Postgres.

```bash
npm install
export DATABASE_URL=postgres://user:pass@localhost:5432/gridstock
npm run db:migrate
npm run db:seed      # fictional demo companies and gear; safe to rerun, replaces sample data only
npm run dev
npm test             # matching unit tests
```

Sign in at `/login` with a demo account, such as the buyer "Alex Chen", the seller "Dana Ruiz", or "Ops Team".

## Not done yet

- **Auth:** only sample accounts can sign in. Add Supabase Auth (magic link) so verified companies can, then drop the `.test` check in `lib/auth.ts`.
- **Access requests** are stored but nobody is notified. Read them in the `users` table (unverified rows without a `.test` address) until email is wired up.
- **Hosting:** `db/*.sql` is plain Postgres, so it runs on Supabase as is. Set `DATABASE_URL` wherever the app is hosted.
- **Specs by category:** transformers, UPS and cooling are listed with volts and amps like switchgear. They need their own ratings (kVA, kW, tons).
- **Partial quantities:** an accepted offer marks the whole listing as under offer, even when the buyer takes only some of the units.
- **Email:** notifications are in-app only. Send them through Resend.
- **Documents:** file uploads (submittals, test reports, nameplate photos) and LLM spec extraction from them.
- **Payments:** escrow goes through a third-party service.
