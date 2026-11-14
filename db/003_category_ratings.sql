-- Ratings that suit each kind of equipment, a lineup description buyers can see, and a note on access requests.
-- Additive only: new nullable columns, and two columns that no longer have to be filled.
-- Safe to run more than once, and safe to apply before the code that uses it.

-- Transformers and UPS are sized in kVA, coolant distribution units in kW, chillers in tons.
-- The unit follows from the category, so one column holds the number.
alter table listings add column if not exists capacity integer;
alter table requests add column if not exists capacity_min integer;

-- Transformers have two voltages. voltage_v is the primary side; this is the secondary.
alter table listings add column if not exists secondary_v integer;
alter table requests add column if not exists secondary_v integer;

-- Rated current only means something for switchgear, switchboards and breakers.
alter table listings alter column amps drop not null;
alter table requests alter column amps_min drop not null;

-- What is inside the lineup (sections, breaker sizes, arrangement). Shown to matched buyers before the NDA,
-- so it must not name the seller or the site.
alter table listings add column if not exists configuration text;

-- What a company says it holds or needs when it asks for access.
alter table users add column if not exists note text;
