# Arkini changelog

Each `<version>.md` is the cumulative, English source for one GitHub Release.
Create it from `TEMPLATE.md` only for an explicitly chosen version.
Record material capability, gameplay semantics, compatibility, delivery, and
data-safety changes; omit implementation-only work.

Keep the audiences distinct:

- **For players:** controls, choices, and observable behavior.
- **Gameplay engine:** supported mechanics, rules, and semantic guarantees.
- **For game authors:** what the Editor can configure, inspect, test, and publish.

A cross-cutting change may appear in more than one section only when each entry
explains a different consequence. The first public release may establish a
complete engine baseline; later releases record only changed capabilities.

Write shipped end state, not commits, PRs, implementation history, refactors,
or presentation-only cleanup. Fold changes into existing prose, delete stale
claims, and remove empty sections and template comments.

Before release, verify gameplay against [`GAME.MD`](../GAME.MD), authoring
against [`CONFIG.md`](../CONFIG.md), and compatibility against
[`VERSION.md`](../VERSION.md). After release, the file is historical; subsequent
work belongs to a new explicitly selected version.
