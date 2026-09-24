# Authored relationship graph

The Graph Engine describes the relationships authored in a project. Its primary questions are “who produces this?”, “do A and B have a relationship?” and “which relationships?”. Editor Connections, Chain and MCP consume the same query backend. There is no acquisition planner or numeric Estimate.

## Owners

| Owner | Contract |
| --- | --- |
| [`compileGraphFactsFn`](fn/compileGraphFactsFn.ts) | Complete authored relationship occurrences and reified operations; no availability filtering |
| [`GraphFacts`](type/GraphFacts.ts) | Nodes, directional typed edges, operation identity, grouping and exact config paths |
| [`GraphQuerySchema`](schema/GraphQuerySchema.ts) | Internal Editor traversal request and rich relationship detail contract |
| [`GraphDiscoveryQuerySchema`](schema/GraphDiscoveryQuerySchema.ts), [`GraphBatchQuerySchema`](schema/GraphBatchQuerySchema.ts), [`GraphOperationReadSchema`](schema/GraphOperationReadSchema.ts) | Compact discovery, snapshot-wide batches and pinned selective hydration |
| [`GraphDiscoveryResult`](type/GraphDiscoveryResult.ts), [`readGraphDiscoveryFn`](fn/readGraphDiscoveryFn.ts) | Explicit compact scalar projection; never authored configuration bodies |
| [`readGraphOperationParticipantsFn`](fn/readGraphOperationParticipantsFn.ts) | Authored owner/target/input/output/reference membership, indexed when a snapshot is built |
| [`createProjectGraphFx`](fx/createProjectGraphFx.ts) | Session-local immutable DataScript snapshot keyed by project identity/revision; typed admission, query execution and cancellation |
| [`readItemChainQueryFn`](fn/readItemChainQueryFn.ts) | Shared consequence traversal preset for Editor Chain and MCP |
| [`createEditorGraphWorkerFx`](worker/createEditorGraphWorkerFx.ts), [`EditorGraphProvider`](ui/EditorGraphProvider.tsx) | One scoped worker shared by the open project's views, replaced on hard Refresh |
| [`useEditorGraphQuery`](ui/useEditorGraphQuery.ts) | Cancels obsolete requests and suppresses stale query/revision results |

Graph compilation reads the authored config directly. UI and MCP do not parse relationship semantics. Runtime execution, Tick, placement, persistence, Serapack encoding and project mutations remain independent; changes here do not change gameplay admission or settlement.

## Facts and identities

Nodes use `item:<exact UID>`, `template:<exact UID>`, `space:<number>` and `start`. These namespaces distinguish an item from a template with the same UID. An absent referenced item/template remains a node marked `missing`; graph inspection works on unfinished authoring projects.

Every edge is one occurrence. Parallel inputs, multiple rules and repeated outcomes remain separate, including self relationships and chance-zero outcomes. Exact `source` arrays address the current config, for example `['items', uid, 'lines', 0, 'input', 1, 'query', 'selector', 'itemUid']`. IDs are JSON tuples, so punctuation inside UIDs cannot collide with separators. Production line UIDs are immutable and unique across the project. Their operation/group/edge identities survive title changes and line reorder; source paths follow the new positions. Merges and array-only outcome slots use their authored positions; inserting/reordering these changes occurrence identities.

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

Stored facts retain complete authored data for Editor relationship details and selective hydration. MCP discovery projects an explicit compact whitelist: every node has identity, kind and title; edges retain identity, authored direction, relationship kind, operation identity and small scalar metadata. Operations carry identity, kind, title, owner and bounded semantic fields. No input, query, condition, rule, roll, set, outcome table, merge configuration or source path is embedded in discovery.

Merge discovery identifies an explicit target, replacement and action/effect, with `hasOutcomes` reporting actual authored outcome entries. Receiver-owned Space transport identifies the owner as receiver and carries its destination. Referenced owners, targets, replacements and destinations are accompanied by titled nodes even when their edges were outside the selected query. Line summaries expose `lineUid`, so owner item UID plus line UID can feed `item_line_configs`. IDs remain opaque; clients must not decode positional operation IDs to address source arrays.

## Queries

`node` looks up one exact node and its owned operations. `connections` reads direct edges, optionally restricted to a counterpart `to`. `traverse` returns a bounded reachable subgraph. `path` requires `to` and explains simple paths, preserving distinct parallel-edge alternatives. A node has a zero-hop path to itself. Traversal visits a node once but retains cycle-closing edges; path enumeration does not repeatedly expand a node already on that path.

`direction` is `out`, `in` or `both`; MCP defaults to `both` for local discovery. Edges always retain authored from/to direction, including when traversed backwards. `kinds` selects which kinds can be used at every hop; omission selects all, an empty list selects none. One hop is one typed relationship, not one operation execution. The same item pair may have both production and merge relationships; finding one never excludes the other.

For example, the single stored A → B `merge-target` edge answers both “what does A merge into?” (`out`) and “what merges into B?” (`in`). Editor exposes **Merges into** and **Accepts merge from** presets. A separately authored B → A merge is a different operation, never inferred from the first.

Connections counts relationship occurrences in each category and shows the selected category's count in the search placeholder. Counts respect the selected counterpart and use the same directional presets as the displayed rows. A separate summary query counts up to 1,000 edges independently of the 100-row detail limit; incomplete counts use `≥`, while a complete selected-category query supplies an exact count.

MCP also supports `operations` without a root node. It directly lists authored `line`, `merge`, `clock` and `depletion` operations, including operations with no relationships. Filters combine `operationKinds`, `owner`, `participant` and `role`. Owner participation is unconditional; target is the selected merge receiver (the owner for Space transport), inputs are line material/unit providers, outputs are authored results/outcomes/destinations, and rule mentions have the separate reference role. This is an index built from canonical facts once per snapshot, not a traversal from Start or repeated item-configuration reads.

Examples:

```json
{"kind":"connections","from":"item:puppy","direction":"both"}
{"kind":"operations","operationKinds":["merge"]}
{"kind":"operations","operationKinds":["merge"],"participant":"item:puppy","role":"target"}
{"kind":"path","from":"item:A","to":"item:B","direction":"out"}
```

MCP defaults/maxima: depth 1/12, result limit 50/200, expansions 10,000/100,000 and cooperative timeout 1,000/5,000 ms. Chain defaults to depth 5. Internal Editor queries retain their separate 3/12 depth and 100/1000 result defaults/maxima. Limits count unique returned edges for connection/traversal, paths for path queries, and operations for node lookup or operation listing. Path responses can include up to depth × path-limit edges. Depth-limited frontiers remain partial. Ordering is deterministic by canonical identity, with breadth-first paths and stable branch order.

Operation pages return `nextCursor` when a scan can continue. Repeat the operation query with unchanged filters, its cursor, revision and snapshotId; a cursor cannot silently continue against different content or a different filter. A bounded page that has not found a match is incomplete, not evidence that no operation exists.

`graph_query_batch` takes 1–8 uniquely named `{id, query}` entries. All subqueries run against one captured immutable snapshot. The top-level node, edge and operation collections are deduplicated by identity; each entry in `queries` contains its own status, truncation, reasons, paths, continuation and `nodeIds`/`edgeIds`/`operationIds`. A failed subquery reports its own error without replacing successful siblings. Batch revision/snapshot admission fails before any subquery when the requested snapshot is stale.

`graph_operation_configs` accepts 1–20 operation IDs and requires the discovered revision **and** snapshotId. It returns only those canonical operation records, deduplicates repeated IDs and reports missing ones. No persistent operation UID is needed: content-bound snapshot admission prevents positional merge identities from pointing at another operation after a reorder, including external changes that retain the revision marker. Snapshot tokens are session-local; after restart, rediscover. Existing `item_configs` and `item_line_configs` remain the item/line hydration layer and return their own revision, which clients must compare before combining reads.

`status` is `yes` when a match was found, `no` only after the selected scope is exhausted, or `unknown` when an incomplete search found no match. `truncated` and `reasons` also apply to positive results: a found path may coexist with omitted alternatives. A structural path explains authored relationships; it does not combine mutually exclusive branches into a single inventory or evaluate guards against Runtime.

Timeout and interruption are cooperative, checked during traversal. Synchronous snapshot compilation and a single indexed DataScript lookup are outside that timeout; it is not a hard end-to-end latency guarantee. The immutable snapshot is captured before traversal yields, so another request or revision cannot mix facts into an in-flight answer. Results are detached from cache state. Optional `revision` rejects a request for anything other than the supplied current project revision; MCP discovery also accepts the returned `snapshotId` to pin exact content. Invalid parameters and unknown nodes are typed failures; missing authored references remain inspectable nodes.

Cache lifetime follows the project session. Identical project identity/revision/content reuses the DataScript snapshot even when the repository returns a new JavaScript object. A serialized-config guard also detects hard Refresh after external edits with an unchanged on-disk revision marker. This inexpensive content comparison avoids a stale MCP cache without rebuilding the graph for every query. Expensive initial compilation is acceptable; no tight build-time target or disk snapshot persistence is imposed.

## Editor, MCP and compatibility

Editor graph work runs in a project-owned worker. Relationship details render human-readable facts and linked authored locations, never raw config paths. Production links carry the immutable line UID; configured Space links select their Board, and template placements link to the template Board with coordinates. MCP owns a session-local graph capability and publishes `graph_schema`, `graph_query`, `graph_query_batch` and `graph_operation_configs`; callers cannot submit EDN. The backend's fixed EDN queries/rules receive node IDs as data, never interpolated query source. Both surfaces execute against the same canonical facts and relationship semantics. Editor retains its rich `GraphResult` for graphical details; MCP exposes only `GraphDiscoveryResult` through discovery and returns authored data only through the explicit hydration tools.

Line tool references use `lineUid`/`lineUids`. Canonical reads include each line’s immutable UID; create/replace line authoring values omit it, creation generates it, and replacement retains the addressed UID. Item creation also gives every supplied line a fresh UID.

`estimate` and `item_estimate` are removed, with no numeric replacement. MCP `item_input` now means outgoing line material/unit-use relationships; query incoming `merge-target` explicitly to find merges targeting an item. `item_outcome` finds incoming produced/replacement item relationships. Their `level` selects bounded depth. All convenience tools use the same compact discovery projection with no configuration-detail mode. `item_chain` and Editor Chain use the same broader authored-consequence preset, including lines, merges, Clock, depletion, spaces and templates. The former specialized Chain parser and acquisition witness output are retired.

## Dependency

DataScript 1.8.1 is pinned. Its JavaScript build supports the same immutable database and EDN query/rule API in Node and the Editor worker. It has no runtime package dependencies; the distributed JavaScript is 466,978 bytes before bundler processing. Upstream uses [EPL-1.0](https://github.com/tonsky/datascript/blob/master/LICENSE); its license and attribution/source notice are included in packaged resources under `licenses/`. The application does not modify DataScript source or expose its mutation API. The complete graph worker, including Effect and schema code, is budgeted at 1 MiB raw / 256 KiB gzip; the browser-bundle parity test also runs a synthetic 2,000-item, 6,000-operation cyclic project and verifies bounded answers and snapshot reuse.

Tests use synthetic schema-valid projects, including compiler-validated pathological combinations. Graph facts and query results are asserted independently; MCP and worker tests protect surface equivalence, revision ownership and cancellation rather than repeat config parsing.
