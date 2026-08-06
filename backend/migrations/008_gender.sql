-- Gender is only needed for one thing in this whole product: the Feng Shui
-- Kua number formula (traditional calculation genuinely differs by gender --
-- verified against the standard method already implemented in
-- backend/app/calc/feng_shui.py). Everything else -- natal charts,
-- numerology, Human Design -- is gender-neutral, pure date/time/place math.
-- Collected once here on the profile so the Feng Shui page can reuse it
-- instead of asking again, rather than adding an otherwise-unused field to
-- every intake flow.
alter table profiles
  add column if not exists gender text check (gender in ('male', 'female', 'rather_not_say'));
