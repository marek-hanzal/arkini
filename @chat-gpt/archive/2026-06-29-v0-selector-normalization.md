# Selector normalization

- Replaced the temporary effect selector shape `ids` + `all: true` with one domain selector vocabulary: `mode: "all"`, `anyOf`, `allOf`, and `noneOf`.
- Source selectors use refs shaped as `{ "id": "..." }` or `{ "tag": "..." }`; there is no legacy `ids`, `anyTags`, `allTags`, `noneTags`, or `all: true` authoring support.
- Compile resolves every id/tag ref into runtime `{ "ids": [...] }` clauses while keeping the selector predicate shape. Runtime therefore evaluates deterministic membership clauses and never reads authoring tags.
- Product-line effect targets stay domain-scoped as `producers` and/or `productLines`; item creation blocks target `items`. Multiple target dimensions are conjunctive.
