# reference/ — local copies of other people's drawings

Everything in this folder except this file is gitignored. The hotels' floor plans and Dragon Con's
maps are theirs; we keep copies here for placing our own drawings and never commit them (DECISIONS #28).

Layout:

    reference/
      plans/      the hotels' floor plans, PDFs and pictures, named <hotel>-<source>-<year>, a picture of one level
                  with the level after it (paths are recorded in docs/venues/README.md)
      shots/      screenshots of single levels, named <hotel>-<level>.png, for use as a drawing underlay
      dragoncon/  the official app's maps: one PNG per venue with every floor on it, and maps.json, which records
                  where the app outlines each room (Dragon Con's room name, polygon in image pixels, door points,
                  2026 event count). Its own README.md says what was captured and how. maps.json's outlines, or
                  the picture's labels where it outlines none, say which rooms the con uses and their names, and
                  place a hotel with no plan of its own; the PNGs are for the eye only.

.gitignore carries these two lines:

    reference/*
    !reference/README.md

A new clone has none of it. To rebuild: the plans are linked from docs/venues/README.md; the con's maps are at
app.core-apps.com/dragoncon26/maps, and reference/dragoncon/README.md describes the capture.
