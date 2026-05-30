-- ===========================================================================
-- TravelGit — trip settings + visibility
--
-- Adds:
--  * visibility: 'shared' (owner + collaborators) or 'private' (owner only)
--  * settings:   interactive "trip dials" (pace / budget / adventure) that the
--                AI uses to rework the itinerary when the traveler turns them.
-- Both default to sensible values so existing rows keep working.
-- ===========================================================================

alter table public.trips
  add column if not exists visibility text not null default 'shared';

alter table public.trips
  add column if not exists settings jsonb not null
  default '{"pace":50,"budget":50,"adventure":50}'::jsonb;
