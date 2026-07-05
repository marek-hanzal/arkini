# Config validation helper batch pass

Continued the LLM-friendly refactor sequence from the parallel reviews. This batch focused on remaining medium-sized config validation modules that still mixed several validation/source families in one file.

Commits:

- `d7dc939e Split config effect validation helpers`
  - Split line/drop/craft effect validation and duplicate effect/grant ID validation out of `GameConfigEffectValidation.ts`.
- `71506fcc Split gameplay softlock requirement helpers`
  - Split requirement constructors, line effect requirements, output availability variants, satisfaction checks, and missing requirement formatting.
- `3502fdce Split blueprint dependency edge helpers`
  - Split blueprint edge collection by craft, line, merge, effect, grant, and collector responsibilities.
- `1fd735be Split config starting state validation helpers`
  - Split starting inventory and starting board validation from the starting-state orchestrator.

Intent: keep public entrypoints stable while making each config validation branch grep-friendly and locally understandable without reloading the entire validation subsystem into short-term memory, because apparently software still requires memory and naming, dreadful.
