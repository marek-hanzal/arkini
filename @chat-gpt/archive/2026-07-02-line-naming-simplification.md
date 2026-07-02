# Line naming simplification

- Shortened the embedded producer-line naming layer now that line ownership is explicit through item capabilities.
- Runtime action/event/view names use `line` instead of `producer_line` / `producer.line` / `producerLines`:
  - actions: `line.start`, `line.set_default`
  - events: `line.started`, `line.completed`, `line.blocked`, `line.failed`, `line.default_changed`
  - activation view field: `lines`
- Line view fields were tightened:
  - `lineKind` -> `kind`
  - `producerQueuedJobs` -> `queueUsed`
  - `queuedJobs` -> `jobs`
  - `queueSize` -> `queueMax`
- Producer jobs now store their owning item as `itemInstanceId`; the surrounding producer job context already gives the domain.
- Kept producer/craft prefixes where they disambiguate parallel root save/action concepts, e.g. producer input state vs craft input state and producer jobs vs craft jobs.
