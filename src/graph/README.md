# Authored relationship graph

The Graph Engine describes the relationships authored in a project. Its primary questions are “who produces this?”, “do A and B have a relationship?” and “which relationships?”. Editor Connections, Chain and MCP consume the same query backend. Query semantics, audit calculations and snapshot caches belong to this internal Editor core; MCP validates calls and presents its results. All graph answers describe authored facts. They do not evaluate gameplay feasibility, rule satisfaction, usefulness or design correctness. There is no numeric acquisition Estimate.

## Owners

| Owner | Contract |
| --- | --- |
| [`compileGraphFactsFn`](fn/compileGraphFactsFn.ts) | Complete authored relationship occurrences and reified operations; no availability filtering |
| [`GraphFacts`](type/GraphFacts.ts) | Nodes, directional typed edges, operation identity, grouping and exact config paths |
| [`GraphQuerySchema`](schema/GraphQuerySchema.ts) | Internal Editor traversal request and rich relationship detail contract |
| [`GraphDiscoveryQuerySchema`](schema/GraphDiscoveryQuerySchema.ts), [`GraphBatchQuerySchema`](schema/GraphBatchQuerySchema.ts), [`GraphOperationReadSchema`](schema/GraphOperationReadSchema.ts) | Focused discovery dispatch, snapshot-wide batches and pinned selective hydration |
| [`GraphDiscoveryResult`](type/GraphDiscoveryResult.ts), [`readGraphDiscoveryFn`](fn/readGraphDiscoveryFn.ts) | Explicit compact scalar projection; never authored configuration bodies |
| [`compileGraphOperationIndexFn`](fn/compileGraphOperationIndexFn.ts), [`GraphOperationIndex`](type/GraphOperationIndex.ts) | One normalized operation index: authored role occurrences, source participants and output occurrences |
| [`createProjectGraphFx`](fx/createProjectGraphFx.ts) | Session-local immutable DataScript snapshot and reusable projection/search indexes; typed admission, pins, continuation and query dispatch |
| [`queryGraphStructureFx`](fx/queryGraphStructureFx.ts) | Bounded structural lookup/traversal/simple paths; receives indexed adjacency from the snapshot |
| [`queryGraphFlowFx`](fx/queryGraphFlowFx.ts), [`readGraphFlowEvidenceFn`](fn/readGraphFlowEvidenceFn.ts), [`GraphFlow`](type/GraphFlow.ts) | Bounded simple paths over authored operations; shortest first, no gameplay evaluation |
| [`aggregateGraphOperationsFx`](fx/aggregateGraphOperationsFx.ts) | Whole filtered operation counts and ranked group pages; explicit lower bounds on interrupted scans |
| [`compileGraphAuditFn`](fn/compileGraphAuditFn.ts), [`queryGraphAuditFx`](fx/queryGraphAuditFx.ts) | Snapshot item-role indexes, explained design audits, bounded counts and frozen pages |
| [`readItemChainQueryFn`](fn/readItemChainQueryFn.ts) | Consequence traversal preset for Editor Chain |
| [`createEditorGraphWorkerFx`](worker/createEditorGraphWorkerFx.ts), [`EditorGraphProvider`](ui/EditorGraphProvider.tsx) | One scoped worker shared by the open project's views, replaced on hard Refresh |
| [`useEditorGraphQuery`](ui/useEditorGraphQuery.ts) | Cancels obsolete requests and suppresses stale query/revision results |

Graph compilation reads the authored config directly. UI and MCP do not parse relationship semantics. Runtime execution, Tick, placement, persistence, Serapack encoding and project mutations remain independent; changes here do not change gameplay admission or settlement.

## Facts and identities

Nodes use `item:<exact UID>`, `template:<exact UID>`, `space:<number>`, `space:previous` and `start`. `space:previous` is an authored dynamic destination, never a guessed numeric space or a missing reference; graph queries do not resolve navigation history. These namespaces distinguish an item from a template with the same UID. An absent referenced item/template remains a node marked `missing`; graph inspection works on unfinished authoring projects.

Every edge is one occurrence. Parallel inputs, multiple rules and repeated outcomes remain separate, including self relationships and chance-zero outcomes. Exact `source` arrays address the current config, for example `['items', uid, 'lines', 0, 'input', 1, 'query', 'selector', 'itemUid']`. Internal edge and operation IDs are JSON tuples, so punctuation inside UIDs cannot collide with separators. MCP discovery substitutes short opaque operation references bound to the session and exact snapshot; these are accepted directly by `graph_operations_json` in `operationIds`. Internal Editor identities remain unchanged. Production line UIDs are immutable and unique across the project. Their operation/group/edge identities survive title changes and line reorder; source paths follow the new positions. Merges and array-only outcome slots use their authored positions; inserting/reordering these changes occurrence identities.

Edges reference reified operation records. Full operation data preserves line inputs and flags, Clock scheduling, rules, unit costs, merge source actions, target effects and the entire set/roll/outcome hierarchy. A line or operation with no outgoing relationships is still discoverable through its owner's node lookup. Set and roll IDs on edges distinguish mutually exclusive sets from rolls that coexist within a selected set. Weights are authored weights, not normalized probabilities; chance is the authored roll probability, including zero.

| Edge kinds | Direction and meaning |
| --- | --- |
| `line-material`, `line-unit-selector`, `line-unit-cost` | Selected material/provider or self payer → line owner. Input data keeps consume/reserve, quantity, cost and query distance. A simple input can also pay self units. |
| `line-item-outcome` | Line owner → outcome item; Clock-selected and manual lines share this kind and preserve their flags. |
| `merge-target` | Source-owned merge owner → selected target. Never a claim of production. |
| `merge-replacement` | Merge owner → replacement; operation and role identify whose instance is replaced. |
| `merge-target-replacement` | Directional merge target → replacement, with the source-owned operation attached. |
| `merge-item-outcome` | Merge owner → additional outcome item. |
| `merge-source-spend`, `merge-target-spend` | Owner → spending participant. Keep source versus target/receiver roles distinct. |
| `merge-space` | Receiver → destination space; the transported incoming item has no exact authored identity. |
| `clock-item-outcome`, `depletion-item-outcome` | Owner → expiry/depletion item outcome, regardless of whether a live instance can currently trigger it. |
| `rule-reference` | Operation owner → item mentioned by a condition, including Count 0, show/hide and runtime rules. This is not material consumption. |
| `space-outcome`, `template-outcome` | Outcome owner → navigation space or applied template. A template applies to the operation's origin space, even after a Space outcome in the same roll. |
| `template-item` | Template → each placement occurrence, with x/y. |
| `start-space`, `start-template` | Start → current/configured spaces; each configured space → assigned template. |

Stored facts retain complete authored data for Editor relationship details and selective hydration. MCP discovery projects an explicit compact whitelist: every node has identity, kind and title; edges retain identity, authored direction, relationship kind, operation identity and small scalar metadata. Operations carry identity, kind, title, owner and bounded semantic fields. No input, query, condition, rule, roll, set, outcome table, merge configuration or source path is embedded in discovery. Discovery edge metadata also omits set/roll identities and indices, outcome indices and rule/condition bookkeeping. It keeps only meaningful scalars such as quantity, reserve/consume, distance, unit source/cost, input index, probability, alternatives, participant role and placement coordinates.

Merge discovery identifies an explicit target, replacement and action/effect, with `hasOutcomes` reporting actual authored outcome entries. Receiver-owned Space transport identifies the owner as receiver and carries its destination. Referenced owners, targets, replacements and destinations are accompanied by titled nodes even when their edges were outside the selected query. Line summaries expose `lineUid`, so owner item UID plus line UID can feed `item_lines_json`. Operation references are opaque; clients must not decode them to address source arrays.

Authored time values are also available as exact seconds, without rounding: line summaries expose `runtimeSeconds`; Clock summaries expose optional `intervalSeconds` and `durationSeconds`; item nodes carry those optional values under `clock`. Rule-reference metadata exposes signed `adjustSeconds` for a runtime-adjustment rule. Text and flow evidence use seconds, including negative rule adjustments. Missing values stay absent rather than becoming zero. Source operation bodies and existing millisecond filters retain their authored units; second-based operation filters use the same scalar index. These are independent authored values, never an effective runtime, combined path duration or gameplay estimate.

The snapshot indexes authored operation membership once, preserving parallel role/output occurrences and disabled or outputless operations. Flow follows source-to-output adjacency within the same operation; audits classify the same authored records by explicit structural presence. Structural alias edges remain inspectable but never create duplicate operation outputs. The index references canonical operation records and edges instead of copying configuration or expanding the participant/output Cartesian product. There is no inventory, participant-state tracking, quantity planner, remaining-unit simulation or start-reachability solver.

## MCP presentation

Tools without a format suffix return readable text. `graph_search` presents titled nodes, `graph_operations` presents operations and match evidence, `graph_connections` groups related occurrences by operation, `graph_traverse` presents directed relationships, `graph_path` presents ordered structural paths, and `graph_flow` presents authored operation paths and factual step evidence. Names are primary; reusable node identities, line UIDs and short operation references remain available for follow-up calls. Text never prints internal edge IDs. Ordinary identities appear without JSON quotes, for example `Beagle Puppy [item:abc]`; unusual delimiters/control characters retain lossless JSON string quoting. A merge row can directly explain owner + target → replacement, action/effect, receiver ownership and additional outcomes, without a redundant node table. Lines retain their immutable UID.

Every result carries project, revision and snapshot, plus status and truncation semantics. Continuation is preserved exactly; no-match after a truncated search remains unknown. Text formatting does not reinterpret graph direction, evaluate runtime state or alter the query engine. `graph_batch` renders separate named query sections from its deduplicated internal payload.

`graph_schema_json` is the structured vocabulary/query contract and `schema_json` reads registered JSON Schemas. `graph_operations_json` is one structured batch document, not JSONL. The workflow is **text discovery → exact identities → selective JSON hydration**.

## Queries

`graph_search` uses the canonical Editor fuzzy search over titles, graph node IDs and unprefixed identities, with optional `nodeKinds` and a bounded result count. Exact matches precede fuzzy matches. Results include item, template, space and start nodes without authored bodies; missing references are marked. Internal Editor `node` queries remain separate. `graph_connections` reads direct edges, optionally restricted to an exact counterpart `to`. `graph_traverse` returns a bounded reachable subgraph and requires explicit nonempty `kinds` above depth 1. `graph_path` requires both `from` and `to` and explains simple structural paths, preserving distinct parallel-edge alternatives. A same-node path query returns only the zero-hop identity, without enumerating return cycles. Traversal visits a node once but retains cycle-closing edges; path enumeration does not repeatedly expand a node already on that path.

`direction` is `out`, `in` or `both`; Connections and path default to `both`; traverse defaults to `out`. Edges always retain authored from/to direction, including when traversed backwards. `kinds` selects which kinds can be used at every hop; omission selects all, an empty list selects none. One hop is one typed relationship, not one operation execution. The same item pair may have both production and merge relationships; finding one never excludes the other.

For example, the single stored A → B `merge-target` edge answers both “what does A merge into?” (`out`) and “what merges into B?” (`in`). Editor exposes **Merges into** and **Accepts merge from** presets. A separately authored B → A merge is a different operation, never inferred from the first.

Connections counts relationship occurrences in each category and shows the selected category's count in the search placeholder. Counts respect the selected counterpart and use the same directional presets as the displayed rows. A separate summary query counts up to 1,000 edges independently of the 100-row detail limit; incomplete counts use `≥`, while a complete selected-category query supplies an exact count.

`graph_operations` requires no root node. It directly lists authored `line`, `merge`, `clock` and `depletion` operations, including operations with no relationships. Filters combine `operationKinds`, `owner`, `participant` and `role`. Owner participation is unconditional; target is the selected merge receiver (the owner for Space transport), inputs are line material/unit providers, outputs are authored results/outcomes/destinations, and rule mentions have the separate reference role. Participant/role queries include occurrence-level match evidence: the titled participant and role, output quantity, input quantity/mode/distance/unit cost, or referenced item. Repeated and alternative outcomes remain separate, with authored chance and alternative flags; evidence never sums exclusive outcomes. This is an index built from canonical facts once per snapshot, not a traversal from Start or repeated item-configuration reads.

`search: {text, scope}` searches operation titles, owner titles, participant titles or `all` (the default). Snapshot-cached indexes reuse the Editor's canonical `createFuzzySearchFn`, including token matching, threshold and exact-match priority. This is fuzzy search, not strict substring matching. Search results retain relevance order through projection, batches and continuation. `filter` combines scalar predicates with AND: `hasOutcomes`, merge `action/effect/ownership`, line `clock/default/show/enable`, and numeric `runtimeMs/runtimeSeconds/clockWeight/durationMs/durationSeconds/intervalMs/intervalSeconds` ranges. Clock operations also expose `enable`, duration and interval. An absent property never matches, including `false`; ranges use inclusive `min/max` and exclusive `gt/lt`. Empty or impossible ranges are rejected. These filters apply only to operation discovery.

`graph_operations` also accepts `aggregate: {mode: "count"}` or `{mode: "group", by: "kind" | "owner" | "action" | "effect" | "ownership" | "lineTitle"}`. Both use the exact same filtered operation index as listing, including participant roles, Fuse search and scalar filters. Count returns only a count, never operation records. Grouping counts the entire filtered scope before paging groups; owner groups contain the human title and exact node ID. Missing properties form a distinct `Not applicable` group, so mixed-kind scopes never silently lose operations. Groups sort by count descending, then exact key. `limit` bounds returned groups, never the aggregate's operation scope. Complete counts remain exact when the group page has further pages. A safety-interrupted scan explicitly returns lower bounds (`complete: false`), not totals; partial ranked groups have no continuation because their ordering may change as the scope is scanned. Retry with larger scan bounds. Completed group scans use ordinary opaque snapshot/filter-bound continuation, including aggregation mode and group key in that binding. Pages recompute the aggregation over the immutable snapshot; no persistent aggregate cache or client scan is required. Batch supports the same aggregation and keeps payloads query-local.

`graph_flow` requires `from` and `to` and enumerates directed simple paths through authored operations. A line source (owner or input) connects only to outputs of that same line, never to a different line through their shared owner. Merges connect concrete source/target participants to replacement or additional outcomes. Clock expiry and depletion connect the owner to their authored outputs. Rule references, reversed edges and shared-owner proximity are not steps. Receiver-owned Space transport does not identify its incoming item, so flow cannot invent that item or turn the receiver into the destination space. Real Space/template outcomes can be terminal steps; Start and template placement edges are not transformations.

Flow never evaluates gameplay rules or availability. Disabled operations, zero-chance rolls, zero-quantity outcomes and missing referenced items remain visible. It does not track inventories, consumed states, unit balances, compatible co-products or externally acquired prerequisites. A returned path demonstrates an authored connection only; readers assess feasibility using its facts and selective operation hydration.

Every step includes the operation reference, entry role, participants and explicit authored facts produced by the internal Editor graph projection. Facts describe operation flags, inputs and unit costs, merge action/effect, scheduling, selected set weight and alternative-group position, selected roll type/chance, output quantity/placement and actual scoped operation/set/outcome rules with their conditions and parameters. Weights and chances remain authored values, never a calculated path probability. Showing a rule does not claim that it passes. Other branches remain available through the operation reference rather than being combined into a synthetic result.

Search is breadth-first and deterministic, ordered only by number of operations and canonical occurrence order. Parallel operations and output occurrences remain separate paths. A path never repeats a node, which prevents cycles without a gameplay state machine; `from === to` is a zero-step identity, not an enumerated cycle. Optional `operationKinds`, depth, expansion, time and result limits bound exploration. There is no cursor. `no` means no simple authored path in the selected scope after complete exploration, not gameplay impossibility. A safety-limited no-match remains `unknown`; positive results can also be incomplete.

By contrast, `graph_path` is purely structural: with `direction=both`, it may connect nodes through a common producer, consumer or owner. Such a path is not a gameplay recipe or a flow.

Examples (focused tools omit the batch dispatch `kind`):

```text
graph_search({query: "Candle", nodeKinds: ["item"]})
graph_connections({from: "item:puppy", direction: "both"})
graph_operations({operationKinds: ["merge"], filter: {action: "spend"}})
graph_operations({operationKinds: ["merge"], aggregate: {mode: "count"}})
graph_operations({operationKinds: ["merge"], aggregate: {mode: "group", by: "owner"}, limit: 10})
graph_operations({operationKinds: ["line"], aggregate: {mode: "group", by: "lineTitle"}})
graph_operations({search: {text: "Digest", scope: "title"}, filter: {clock: true, show: false, clockWeight: {gt: 15}}})
graph_path({from: "item:A", to: "item:B", direction: "both"})
graph_flow({from: "item:A", to: "item:B", maxDepth: 5})
```

MCP defaults/maxima: depth 1/12 for traverse and 5/12 for path/flow, result limit 50/200, expansions 10,000/100,000 and cooperative timeout 1,000/5,000 ms. Editor Chain defaults to depth 5. Internal Editor queries retain their separate 3/12 depth and 100/1000 result defaults/maxima. Limits count unique returned edges for connection/traversal, paths for path queries, operations for operation listing, groups for grouping (count ignores result limit), nodes for search, and flows for operation-path search. Flow depth counts operations; structural depth counts relationships. Path responses can include up to depth × path-limit edges. Depth-limited frontiers remain partial. Ordering is deterministic by canonical identity except for node and operation search, which use stable relevance order; paths use breadth-first traversal and stable branch order.

Connections and operation pages return a compact opaque `nextCursor` when a scan can continue. The session retains at most 1,024 issued continuation tokens in FIFO order; expired tokens require rediscovery. Repeat the same focused query class with unchanged root/counterpart/direction/search/filters/aggregation, its cursor, revision and snapshotId; a cursor cannot silently continue against different content or a different filter. A bounded page that has not found a match is incomplete, not evidence that no operation exists.

`graph_batch` takes 1–8 uniquely named `{id, query}` entries. Each `query` is an object with `kind: search | connections | operations | path | flow | traverse | audit` and the corresponding focused fields; its fields are validated independently so malformed query fields remain per-entry errors. All subqueries run against one captured immutable snapshot. Internally, node, edge and operation collections are deduplicated by identity and each query keeps references to its own records. MCP presents common project/revision/snapshot metadata once, then a readable section per query ID with its own status, truncation, reasons, paths, flows, ordered nodes/operations, match evidence and continuation; it does not expose the storage tables. A failed subquery reports its own error without replacing successful siblings. Batch revision/snapshot admission fails before any subquery when the requested snapshot is stale.

`graph_operations_json` accepts 1–20 short opaque operation references in `operationIds` and requires the discovered revision **and** snapshotId. It returns only those canonical operation bodies under the requested short references, deduplicates repeated references and reports missing ones. No persistent operation UID is needed: content-bound snapshot admission prevents positional merge identities from pointing at another operation after a reorder, including external changes that retain the revision marker. Snapshot tokens are session-local; after restart, rediscover. Existing `items_json` and `item_lines_json` remain the item/line hydration layer and return their own revision, which clients must compare before combining reads.

`status` is `yes` when a match was found, `no` only after the selected scope is exhausted, or `unknown` when an incomplete search found no match. `truncated` and `reasons` also apply to positive results: a found path may coexist with omitted alternatives. A structural path explains authored relationships; it does not combine mutually exclusive branches into a single inventory or evaluate guards against Runtime.

Timeout and interruption are cooperative, checked during structural/flow traversal and paged result emission. Synchronous snapshot compilation and a single indexed DataScript lookup, Fuse search and scalar candidate filtering are outside that timeout; it is not a hard end-to-end latency guarantee. The immutable snapshot is captured before traversal yields, so another request or revision cannot mix facts into an in-flight answer. Results are detached from cache state. Optional `revision` rejects a request for anything other than the supplied current project revision; MCP discovery also accepts the returned `snapshotId` to pin exact content. Invalid parameters and unknown nodes are typed failures; missing authored references remain inspectable nodes.

Cache lifetime follows the project session. Identical project identity/revision/content reuses the DataScript snapshot even when the repository returns a new JavaScript object. A serialized-config guard also detects hard Refresh after external edits with an unchanged on-disk revision marker. This inexpensive content comparison avoids a stale MCP cache without rebuilding the graph for every query. Expensive initial compilation is acceptable; no tight build-time target or disk snapshot persistence is imposed.

## Design audits

`graph_audit` reads a captured snapshot's item-role index, not a loop over connection queries. It accepts `audit`, `mode: list | count`, normal safety budgets, limit and snapshot-bound cursor. Only present authored items are audited; missing references remain visible in their relationships. Audits report structural facts, never defects, usefulness, reachability or runtime availability. Disabled operations, zero-chance rolls, zero-quantity outputs and missing participants remain authored producers and interactions. No rule is evaluated.

| Audit | Exact match |
| --- | --- |
| `dangling` | No authored edge of any kind (including references and template placement), and no configured behavior. Bare Clock/units or an empty simple line do not prevent this match. |
| `no-producer` | No authored operation output providing this item. Template placement is separate and never suppresses this match. |
| `no-usage` | No line input/unit-payer role or explicit merge source/target/receiver participation. Mere ownership of a line, Clock or depletion operation, outputs, references and template placement do not count as usage. |
| `no-behavior` | No configured behavior under the structural definition below. This is independent of use by other operations. |
| `source-only` | Present in an authored template and has no authored producer; templates may be unassigned. |
| `reference-only` | Has rule-reference edges but no other edge or configured behavior. |

Configured behavior means a merge interaction; a line with an authored output, non-simple input or unit cost; or a Clock/depletion operation with an authored output. Item, space and template outputs all count, without evaluating flags, rules or quantities. A Clock-selected line contributes its own line behavior. Clock/units configurations without outputs and simple lines without outputs or unit costs are reported separately as `configuration-only`. The word behavior describes these fields, not a prediction that anything executes. A produced item without further usage or behavior still has its incoming production relationship and is not dangling. There is no dead-end/sink judgment.

Each match returns six independent fact groups: `producer`, `usage`, `behavior`, `configuration-only`, `reference`, and `template`. Operation groups count distinct operation identities; template groups count distinct templates, not placement occurrences. Each group includes its full count and up to three deterministic sample references, including explicit zero counts. Samples carry exact snapshot-bound operation references usable by `graph_operations_json`, with titled owners and authored scalar summaries. Template samples carry exact titled node IDs. The displayed sample count never masquerades as the full relationship count; further relationships remain queryable through `graph_operations` and `graph_connections`. Count mode emits no match rows or evidence.

An audit freezes one bounded scan, then pages matches in stable node-ID order; continuation reuses that exact result, including partial scans. Tokens bind snapshot, audit kind and mode. `limit` bounds rows, not scope. Count mode returns the count over the requested scope without rows. A completed scan gives an exact count; interrupted scans give explicit lower bounds and expansion/timeout reasons. Retry without a cursor and with larger bounds for a new scan. Batch preserves each audit's results, counts, reasons and continuation over its common immutable snapshot.

```text
graph_audit({audit: "dangling"})
graph_audit({audit: "dangling", mode: "count"})
graph_audit({audit: "source-only"})
graph_flow({from: "item:A", to: "item:C"})
```

## Editor, MCP and compatibility

Editor graph work runs in a project-owned worker. Relationship details render human-readable facts and linked authored locations, never raw config paths. Production links carry the immutable line UID; configured Space links select their Board, and template placements link to the template Board with coordinates. MCP owns a session-local graph capability and publishes the focused discovery tools and `graph_audit`, `graph_batch`, `graph_schema_json` and `graph_operations_json`; callers cannot submit EDN. The backend's fixed EDN queries/rules receive node IDs as data, never interpolated query source. Both surfaces execute against the same canonical facts and relationship semantics. Editor retains its rich `GraphResult` for graphical details; MCP formats the compact `GraphDiscoveryResult` as text and returns authored data only through the explicitly named `_json` hydration tools.

Line tool references use `lineUid`/`lineUids`. Canonical reads include each line’s immutable UID; create/replace line authoring values omit it, creation generates it, and replacement retains the addressed UID. Item creation also gives every supplied line a fresh UID.

MCP relationship discovery uses focused tools and `graph_batch`. Select relationship kinds and direction for connections or traversal, or participant roles for operation discovery. Editor Chain retains its authored-consequence preset, including lines, merges, Clock, depletion, spaces and templates; this preset is not a separate MCP tool. Item counts are part of the `project` summary.

## Dependency

DataScript stores only edge endpoint/index datoms used by structural adjacency lookup. Node lookup uses the shared operation index. Canonical records, operation summaries and their reusable projection maps stay in the immutable snapshot. DataScript 1.8.1 is pinned. Its JavaScript build supports the same immutable database and EDN query/rule API in Node and the Editor worker. It has no runtime package dependencies; the distributed JavaScript is 466,978 bytes before bundler processing. Upstream uses [EPL-1.0](https://github.com/tonsky/datascript/blob/master/LICENSE); its license and attribution/source notice are included in packaged resources under `licenses/`. The application does not modify DataScript source or expose its mutation API. The complete graph worker, including Effect and schema code, is budgeted at 1 MiB raw / 256 KiB gzip; the browser-bundle parity test also runs a synthetic 2,000-item, 6,000-operation cyclic project and verifies bounded answers and snapshot reuse.

Tests use synthetic schema-valid projects, including compiler-validated pathological combinations. Graph facts and query results are asserted independently; MCP and worker tests protect surface equivalence, revision ownership and cancellation rather than repeat config parsing.
