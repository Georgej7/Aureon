# Swiss Ephemeris data files

`seas_18.se1` -- covers Chiron's position for the standard modern date range.
Unlike the Sun through Pluto (computed analytically by pyswisseph with no
external file), Chiron needs this data file.

Source: the official Swiss Ephemeris GitHub repository maintained by Alois
Treindl, downloaded from
https://raw.githubusercontent.com/aloistr/swisseph/master/ephe/seas_18.se1
on 2026-07-30. Public, free to redistribute (see the Swiss Ephemeris license
at https://www.astro.com/swisseph/).

If more minor bodies are added later (asteroids, additional centaurs), their
`.se1` files go here too -- see `app/calc/ephemeris.py`'s `EPHE_PATH`.
