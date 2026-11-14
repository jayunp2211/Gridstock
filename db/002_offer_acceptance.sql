-- Who made the standing offer, and when the other side accepted it.
alter table deals add column if not exists offer_by uuid references users(id);
alter table deals add column if not exists offer_accepted_at timestamptz;

-- Offers made before this change: the offer message records who made it.
update deals d set offer_by = (
  select dm.author_id from deal_messages dm
  where dm.deal_id = d.id and dm.body like 'Offer: $%' and dm.author_id is not null
  order by dm.created_at desc limit 1
) where d.offer_price is not null and d.offer_by is null;
