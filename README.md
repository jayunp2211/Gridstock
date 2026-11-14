# Gridstock

A private marketplace that matches stranded data center electrical and cooling gear (new or never-energized switchgear, breakers, CDUs from cancelled or delayed projects) with builders whose energization dates are at risk.

## What works

- **Sellers** list gear privately with nameplate ratings, a short description of the configuration, condition, location, availability, asking price and warranty status. Each listing shows the open requests it fits, and the seller can propose an intro, withdraw the listing or list it again.
- **Buyers** post a need: spec, acceptable OEMs and conditions, site, need-by date, budget ceiling. They can close a request and reopen it.
- **Ratings follow the category.** Switchgear, switchboards and breakers are described by voltage, rated current and interrupting rating. Transformers are described by kVA and by primary and secondary voltage, a UPS by kVA, a generator or a CDU by kW and a chiller by tons. The forms ask only for what applies (`components/spec-fields.tsx`), and the server stores only that.
- **Matching** (`lib/match.ts`) runs when either side posts, and again whenever a request or listing is opened, so the fit on screen always follows the current rules. Category, voltage, minimum size and condition are hard requirements; kAIC, schedule, quantity, OEM, enclosure and freight distance lower a 0–100 fit score and are listed as gaps. Matches under 40 are dropped. The score is a first screen on nameplate data, and it never sees price or budget.
- **Voltage is judged by what the equipment is.** Distribution gear matches by class: 600 V gear can serve a 480 V system, and a 15 kV lineup serves 13.8 kV. A transformer reaches a neighbouring primary voltage only within its taps (5%), and its secondary must be the one asked for. A UPS, generator, CDU or chiller must match on voltage exactly.
- **Privacy:** each side sees ratings and the configuration only. Names, asking price, budget and notes stay hidden until both sides accept the mutual NDA in the deal room.
- **The NDA has a text.** `lib/nda.ts` holds the agreement, with a version. Anyone can read it at `/nda`, the deal room shows it in full before a side accepts, and each deal records the version its two sides accepted. The text is a draft that no lawyer has reviewed and it names no governing law, which the page says.
- **Deal rooms:** NDA → documents → offer → inspection → escrow → closed (or lost), with messages and offers. An offer names a price and a number of units, and either side can accept the other's. Prices are totals for the units in the deal, shown with the per-unit figure and the buyer-paid fee. Either side can leave before an offer is accepted.
- **Units:** a deal can cover part of a listing. An accepted offer holds only its own units (`lib/units.ts`), so a seller with ten units can run several deals at once. A listing is under offer only when every unit is held, and a request is in a deal only when its whole need is covered. Every step that moves units locks the listing and the request first, so two acceptances cannot take the same unit.
- **Documents:** after the NDA, either side adds submittals, factory test reports, nameplate photos or a spec, up to 15 MB each. Files live in Postgres (`lib/deal-files.ts`) and are sent in 3 MB parts, because the host limits the size of a request. Only the two sides and operations can open them, and they are always served as downloads. After a deal ends each side keeps only its own.
- **Inspection and escrow are run by the two sides** and recorded in the deal room (`app/(app)/deals/[id]/steps.tsx`). The buyer appoints an independent testing firm and records the result, or waives it. The buyer then deposits the price with an escrow agent both sides choose, the seller confirms with that agent before shipping, and the buyer confirms delivery, which closes the deal. Gridstock does not inspect equipment and never holds the money. Ops can still move a stage by hand.
- **About** (`/about`): who runs Gridstock, what it does and does not do in a deal, the fee, and a contact form.
- **Ops dashboard** (`/admin`): pipeline counts, earnings, deals, open requests by need-by date, sample accounts to verify, counts of real access requests and contact messages, and a button that resets the demo.
- **Earnings** (`lib/earnings.ts`): the fee on every closed deal, for this month, this year and all time, with one line for each month a deal closed in. Months and years start at midnight in `BOOKS_TZ` (America/Toronto). These are fees that fell due, since invoices are sent by hand and payments are not recorded. The sample operations account counts sample deals only.
- **Inbox:** in-app notifications for new matches, intros, NDA signatures, offers, messages, documents and each inspection and escrow step.

## Sample data and real accounts

Accounts whose address ends in `.test` are sample accounts. They are the only ones that can sign in, through the picker on `/login`, and everything they own is demo data that `npm run db:seed` or the reset button puts back.

A real company uses **Request access** on `/login`, and can say what it holds or needs. That stores an unverified row in `users` and nothing else: no session, no listing, no place in the picker or the Ops page. Real accounts stay locked until email sign-in exists. Sample and real accounts are never matched with each other.

The home page shows listings and requests from verified real accounts. While there are none, it shows fixed examples built in `lib/demo.ts` and labels them as samples.

Every visitor can use the sample accounts, so a document added from one is tied to the browser that added it. No other visitor can open it or see its name, whichever account they pick. Demo documents share a 150 MB allowance and are deleted after 24 hours.

## Run locally

Requires Node 22+ and Postgres.

```bash
npm install
export DATABASE_URL=postgres://user:pass@localhost:5432/gridstock
npm run db:migrate
npm run db:seed      # fictional demo companies and gear; safe to rerun, replaces sample data only
npm run dev
npm test             # unit tests for matching, units, files and earnings
```

Sign in at `/login` with a demo account, such as the buyer "Alex Chen", the seller "Dana Ruiz", or "Ops Team".

## Not done yet

- **Auth:** only sample accounts can sign in. Add Supabase Auth (magic link) so verified companies can, then drop the `.test` check in `lib/auth.ts`.
- **Access requests and contact messages** are stored but nobody is notified. Read access requests in the `users` table (unverified rows without a `.test` address, with what they wrote in `note`) and messages from the about page in `contact_messages`, until email is wired up.
- **Hosting:** `db/*.sql` is plain Postgres, so it runs on Supabase as is. Set `DATABASE_URL` wherever the app is hosted.
- **The NDA** needs a lawyer's review and a governing law before a real deal relies on it.
- **Inspection and escrow partners:** the two sides choose their own testing firm and escrow agent. Gridstock has no agreement with either kind of firm yet.
- **The fee** is recorded when a deal closes and invoiced by hand.
- **Email:** notifications are in-app only. Send them through Resend.
- **Documents** are stored in Postgres, which suits small volumes. Move them to object storage before files grow large or many, and add LLM spec extraction from them.
