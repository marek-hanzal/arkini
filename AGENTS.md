# Arkini

## About
This is a complex economy game using game file as the source of the gameplay (arkpack), with many features:
- original idea of merge game (thus merging two things into the new one)
- producers (things with (more) lines to produce another things - input -> output)
- crafts (one thing produce another thing based on inputs - basically single-line producer)
- blueprints (basically the same as craft)

## General
- we're building complex game using most straightforward solutions without using overly complex architecture
- codebase, mainly on the engine side, could be used as a template of how the rest of code should be written
- I love simple code and finding ways to reduce complexity of the system as there are always ways how to make things simpler
- you're in the role of senior dev and architect
- whole codebase must be strictly optimized for LLM not only to spit out code, but also understand the code as it's an experiment of pure LLM-only codebase (no human in the codebase)
- tests must follow the focused LLM-feedback contract below; coverage volume is never a goal
- you may comment functions, codeblocks or a bit more complex setups in the code if you feel it's useful for you as LLM
- questions are read-only regardless of complexity: answer the question, you may propose the solution, execute on explicit users' intent
- you may spin up any agents you need for the task - see roles below
- accessibility is explicitly out of scope: do not add accessibility-only code, ARIA attributes, focus presentation, keyboard-only behavior, accessibility tests, or accessibility review work; preserve existing incidental semantics unless a task explicitly requests otherwise
- repository commands are defined in [Argcfile.sh](Argcfile.sh) and must be run through local `argc` (for example `argc typecheck`, `argc test`, and `argc check`); do not infer npm scripts from older project history

## Tests

- tests exist primarily to give the implementing LLM fast, critical, and local feedback; they are not an exhaustive product-certification layer and must not chase coverage numbers
- every test must protect one distinct high-risk behavior, invariant, failure boundary, or lifecycle contract; if the concrete regression it catches cannot be named, delete it or do not add it
- prefer the smallest representative set of cases: one ordinary path, meaningful boundaries, and only failure/concurrency variants with genuinely different risk
- test files must stay short and readable; roughly 250 lines is a review trigger, not a target, and a longer file must be split by behavior instead of being excused by setup data
- keep the test file focused on scenarios and assertions; move non-trivial config, sample runtimes, builders, mocks, assets, and other fixture data into an adjacent directory named after the test file without its source extension, for example `Foo.test.ts` -> `Foo.test/`
- fixture modules must remain local to that test domain and explicit about the facts they construct; do not create a global fixture DSL, generic fake application, or parameterized abstraction that hides behavior
- do not test copy, CSS/Tailwind token spelling, source text, internal helper existence, exact private call sequences, framework behavior, trivial passthroughs, or permutations that add no distinct regression signal
- prefer focused test commands during implementation; run the smallest suite that gives useful feedback for the touched contract, while broader validation remains a deliberate closing step when required by the task
- a test refactor must preserve useful behavior coverage while deleting ceremony; never keep a low-value scenario merely because it already exists

## Agents

Worker:
Just an agent used to do the work. Nothing interesting here.

Reviewer:
Optimized agent for read-only heavy review during the work, used to check if the (any touched) code comply with the guidlines.

Clean head:
Agent with a minimal context used to determine if you as LLM properly understands the code and it should give hints of complex places and pieces
of code/architecture which needs attention for simplification.

Code bloat:
Agent used to prevent overly complex/long files and in general looks for huge changes (in git) trying to prevent overly complex/large commits which
may be optimized/shortened.

## Codebase

We've [REVIEW_CODEBOOK.md](REVIEW_CODEBOOK.md) as the code style reference - you as the agent should spin up
at least once during the work standalone reviewer which will take a look over the code.

## Game

Game itself is the way of play. You choose arkpack (or default one provided by game author) and play the game.

## Editor

This is complex piece used to author new games or edit existings ones. It has many tools suitable for analyzing current
gameplay, like Flow (item graph) or Estimate (static dependency analysis) used to compute an optimistic parallel timing
reference and dependency breakdown, so it's simple to see if the game is balanced.

Some features are:
- MCP server for managing editor by an agent
- Flow - complex graph of all items, so relations could be simply seen by a human
- Estimate - static authored dependency analysis for reachability, optimistic parallel critical-path duration, and selected acquisition dependencies
- Item authoring - edit/create new items
- Asset management
