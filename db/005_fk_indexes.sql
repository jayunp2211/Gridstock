-- Indexes on foreign keys, as the Supabase performance advisor asks.
-- Postgres indexes the referenced side of a foreign key but not the referencing column, so without these
-- every lookup by owner (a seller's listings, a user's inbox, a deal's messages) reads the whole table,
-- and deleting a user or a listing scans each table that points at it.
-- At demo size this changes nothing that can be measured; it keeps the pages fast once real data arrives.
-- Every statement is safe to run again.

create index if not exists listings_seller_id_idx on listings (seller_id);
create index if not exists requests_buyer_id_idx on requests (buyer_id);
-- matches (request_id, listing_id) is already covered by its unique constraint; this covers lookups by listing.
create index if not exists matches_listing_id_idx on matches (listing_id);
create index if not exists deals_offer_by_idx on deals (offer_by);
-- The deal room reads a deal's messages in order.
create index if not exists deal_messages_deal_id_idx on deal_messages (deal_id, created_at);
create index if not exists deal_messages_author_id_idx on deal_messages (author_id);
-- The inbox lists a user's newest notifications, and every page counts the unread ones.
create index if not exists notifications_user_id_idx on notifications (user_id, created_at desc);
create index if not exists deal_files_uploaded_by_idx on deal_files (uploaded_by);
