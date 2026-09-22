# reference/ — local copies of other people's drawings

Everything in this folder except this file is gitignored. The hotels' floor plans and Dragon Con's
maps are theirs; we keep copies here for tracing placement and never commit them.

Layout:

    reference/
      plans/      hotel floor-plan PDFs, named <hotel>-<source>-<year>.pdf (paths are recorded in docs/venues/registry.json)
      shots/      screenshots of single levels, named <hotel>-<level>.png, for use as a drawing underlay
      dragoncon/  the con's own maps, if we ever get them

.gitignore carries these two lines:

    reference/*
    !reference/README.md
