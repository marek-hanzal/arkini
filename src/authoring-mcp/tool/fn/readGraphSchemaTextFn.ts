import { z } from "zod";
import { GraphDiscoveryQuerySchema } from "~/graph/schema/GraphDiscoveryQuerySchema";
import { GraphBatchQuerySchema } from "~/graph/schema/GraphBatchQuerySchema";
import { GraphOperationReadSchema } from "~/graph/schema/GraphOperationReadSchema";
import type { GraphEdgeKindSchema } from "~/graph/schema/GraphEdgeKindSchema";

const edgeKinds: Record<GraphEdgeKindSchema.Type, string> = {
	"line-material":
		"Selected material item → line owner; compact metadata identifies quantity and consume/reserve mode.",
	"line-unit-selector":
		"Selected unit provider item → line owner; does not mean the provider item is consumed.",
	"line-unit-cost":
		"Unit-paying owner or selected provider → line owner; annotations retain whether units come from self or target.",
	"line-item-outcome": "Line owner → item outcome; includes outcomes of Clock-selected lines.",
	"merge-target": "Merge owner → selected merge target; distinct from produced-item edges.",
	"merge-replacement": "Merge owner → replacement item; distinct from a production line outcome.",
	"merge-target-replacement":
		"Selected merge target → replacement item; the referenced operation identifies the directional merge source.",
	"merge-item-outcome": "Merge owner → item outcome from the merge outcome table.",
	"merge-space": "Merge owner → referenced space.",
	"merge-source-spend":
		"Merge source participant spending relation; inspect operation action and edge role.",
	"merge-target-spend":
		"Merge target participant spending relation; inspect operation effect and edge role.",
	"clock-item-outcome": "Clock owner → expiry item outcome.",
	"depletion-item-outcome": "Unit owner → depletion item outcome.",
	"rule-reference":
		"Rule owner → referenced item; a condition reference is not a production or consumption relation.",
	"space-outcome": "Outcome owner → affected space.",
	"template-outcome": "Outcome owner → selected Board template.",
	"template-item":
		"Board template → initially placed item; repeated placements remain separate edges.",
	"start-template": "Initial space → assigned template.",
	"start-space":
		"Initial configuration → current initial space and every configured initial space; distinct authored occurrences remain separate.",
};

/** The advertised request schemas are the exact compact discovery and hydration contracts. */
export const readGraphSchemaTextFn = () =>
	JSON.stringify({
		nodes: {
			item: "item:<exact item UID>",
			template: "template:<exact template UID>",
			space: "space:<space number>",
			start: "start",
			semantics:
				"Every node carries id, kind and a required human-readable title; missing authored references remain inspectable. Node identity is distinct from operation identity. Titles travel with references so discovery needs no item lookup just to name an entity.",
		},
		edgeKinds,
		operationKinds: {
			line: "One authored production line. Carries owner, immutable lineUid, title and small behavioral scalars. Clock-selected lines remain line operations.",
			merge: "One authored player-triggered merge, including receiver-owned Space transport. Carries owner, explicit target when present, replacement when present, action/effect and hasOutcomes. This is not inferred from production edges.",
			clock: "The owner's authored Clock scheduling/expiry operation. Its configuration is available through selective operation hydration.",
			depletion:
				"The owner's authored unit/depletion operation, independent of current live state.",
		},
		querySchema: z.toJSONSchema(GraphDiscoveryQuerySchema),
		batchSchema: z.toJSONSchema(GraphBatchQuerySchema),
		operationReadSchema: z.toJSONSchema(GraphOperationReadSchema),
		tools: {
			graph_search:
				"Find a node by title or identity; returns title, exact node ID and kind.",
			graph_connections:
				"Read direct authored relationships of one node, optionally against an exact counterpart.",
			graph_operations: "List, count or group authored operations without a root node.",
			graph_path: "Find structural paths between two nodes; not gameplay recipes.",
			graph_flow: "Find potential causal transformations through atomic authored operations.",
			graph_traverse:
				"Advanced broad structural exploration across explicitly bounded relationship hops.",
			graph_batch: "Ask 1–8 named focused questions against one immutable snapshot.",
			graph_operations_json:
				"Hydrate only selected operation references at the discovered revision and snapshot.",
		},
		semantics: {
			inputs: "querySchema is the discriminated union for graph_batch entries and backend dispatch. Each focused tool accepts only its matching variant fields with kind omitted. Batch entries are {id, query:{kind, ...focusedFields}}. Unknown fields are rejected; no generic graph_query tool or compatibility aliases exist.",
			purpose:
				"Unsuffixed discovery tools return compact formatted text. graph_schema_json and graph_operations_json return one JSON document. Discovery never returns authored configuration bodies; hydrate selected operations only after discovering their references.",
			search: "graph_search requires query and optionally nodeKinds (item, template, space, start). It searches human titles and node identities with the canonical Editor exact-first Fuse logic, returning relevance-ordered titled identities. It can inspect unfinished projects with missing referenced nodes. No item_collection lookup is needed before graph navigation.",
			connections:
				"graph_connections requires from, optionally to as an exact direct counterpart. direction defaults both; kinds restricts relationship occurrences. Results are relationship-oriented and may group occurrences belonging to the same authored operation without losing distinct facts. limit counts relationship occurrences, not visual groups. Pages may return Cursor for remaining relationships.",
			operations:
				"graph_operations has no root node. Combine operationKinds, owner, participant, role, search and filter. Search scopes title, owner, participant or all (default) reuse the Editor exact-first Fuse configuration; matching is fuzzy, not a strict substring predicate, and relevance order persists across pages. Scalar filters combine with AND: hasOutcomes; merge action/effect/ownership; line clock/default/show; line or Clock enable; runtimeMs, clockWeight, durationMs and intervalMs ranges (min/max inclusive, gt/lt exclusive). A missing property never matches, including false. Operations with no edges remain discoverable.",
			aggregation:
				"graph_operations.aggregate selects {mode: count} or {mode: group, by: kind|owner|action|effect|ownership|lineTitle}. The same kind/owner/participant/role/Fuse/scalar filters apply before aggregation. Count returns no operation records. Grouping counts the whole filtered index before applying limit to groups, sorted by count descending then exact group key. Owner groups include title and exact node ID; absent properties form a Not applicable group. Complete counts remain exact even when group pages are truncated. Expansion/timeout interruption yields only explicit lower bounds, no definitive total or stable ranked continuation: retry the original query with larger bounds. Completed grouped scans return snapshot-bound cursors for remaining groups. Aggregation is available unchanged in graph_batch.",
			participants:
				"Owner is always a participant; target identifies an explicit merge target or the owner as receiver for Space transport. Inputs identify material/unit providers, outputs identify actual authored results, and reference identifies a rule mention. Participant/role filters include occurrence-level match evidence: titled input with quantity, consume/reserve, distance and unit cost; output with quantity; target or rule reference. Repeated and alternative outcomes remain separate; exclusive outcomes are never summed.",
			path: "graph_path requires from and to. It finds structural/topological paths, not gameplay recipes or proof of runtime feasibility. With direction both (default), a path can pass through a shared producer, consumer or owner. Ordered steps preserve authored edge direction even when traversed backwards. maxDepth counts relationship hops; kinds applies at every hop. A node has a zero-hop structural path to itself.",
			flow: "graph_flow requires from and to. It follows potential causal transitions belonging to one atomic authored operation at a time. maxDepth counts operation steps; operationKinds optionally restricts line, merge, clock and depletion. A line input cannot lead to an output of another line sharing its owner. Rule references, structural proximity and reversed production edges never form flow steps. Authored potential does not prove runtime feasibility, inventory, guards or simultaneous outcomes. Space/template outcomes are terminal operation effects; Start/template placement edges are not additional transformation steps. Receiver-owned Space transport requires an unspecified incoming item and never converts the receiver into its destination space. Flow maintains branch-local participant state across atomic operations: consumed, replaced, removed or spent states cannot be reused until explicitly recreated. Preserved states and compatible guaranteed co-products remain available; mutually exclusive outcomes are never pooled. Spend retires the prior state conservatively without simulating remaining units. Results prefer fewer operations, fewer external prerequisite identities, fewer side outputs and direct replacement. Cycles require a changed causal context and remain bounded. Text presents ordered transformations, state effects and external prerequisites; no result after incomplete exploration is unknown, never definitive absence.",
			traverse:
				"graph_traverse is advanced broad structural exploration, not operation listing, a path or a causal flow. It requires from and defaults to direction out and depth 1. Depth above one requires an explicit nonempty kinds list to avoid accidental unrestricted expansion. maxDepth counts relationship hops; edge directions remain authored even during reverse exploration.",
			direction:
				"Connections/path default both, traverse defaults out. Choose out or in explicitly where appropriate. Every displayed relationship retains authored from/to direction. Merge-target is owner → target, not production. An empty kinds list selects no relationships where accepted.",
			text: "Titles are primary. Exact node IDs, short opaque operation references, line UIDs, revision, snapshot and compact Cursor tokens remain reusable. Ordinary identities are bare, for example Puppy [item:puppy]. Only identities containing whitespace, delimiters or control characters use lossless JSON string quoting; decode those quoted values before reuse. Internal edge IDs are never printed. No internal node/edge storage tables are rendered.",
			metadata:
				"Compact output omits source paths, set/roll IDs and indices, outcome indices and rule/condition bookkeeping. It preserves meaningful scalar facts: quantity, consume/reserve, distance, unit source/cost, input index, participant role, probability, alternatives, board-local semantics and template position. Exact authored grouping belongs to operation hydration.",
			navigation:
				"Operation references are short, opaque and bound to the captured snapshot. Pass them unchanged in graph_operations_json.operationIds; never decode them or submit internal tuple IDs. A lineUid pairs with its owner item UID for item_lines_json. Summaries carry human names and exact node identities for owners and relevant participants.",
			results:
				"status yes means a match was found; no means the selected scope was exhausted without a match; unknown means incomplete exploration found none. Inspect truncated and reasons even when status is yes, because omitted alternatives may exist. Depth, result, expansion and timeout limits can make search incomplete; partial absence is not proof of no relationship or no flow.",
			limits: "Result limit defaults 50, maximum 200. Path/flow depth defaults 5, traverse depth 1; depth maximum 12. Expansion defaults 10000, maximum 100000; cooperative timeout defaults 1000 ms, maximum 5000 ms. Search only exposes result bounds; connections are direct. Limit counts relationships for connections/traverse, operations for listing or groups for grouping (count ignores result limit), nodes for search, paths for path and transformation sequences for flow. Paths and flows may contain up to maxDepth steps per result. Timeout excludes synchronous snapshot compilation, index lookups, Fuse search and scalar candidate filtering; it is not an end-to-end deadline.",
			continuation:
				"Connections and operations may return a compact Cursor. Repeat the same focused query and filters with cursor and returned revision/snapshotId. Tokens bind snapshot, normalized filters including aggregation mode/group key and continuation position; unknown, stale or incompatible tokens fail. The session retains at most 1024 issued continuations in FIFO order; rediscover after expiry. A page with no match but remaining scan is unknown.",
			revision:
				"Each response carries project ID, revision and snapshot ID. Optional revision/snapshotId pin discovery; hydration requires both. Snapshot identity detects external content changes even with an unchanged revision. Session-local tokens expire on graph session restart; rediscover then.",
			batch: "graph_batch captures one immutable snapshot and accepts 1–8 uniquely named focused queries. Each query object is admitted separately, so invalid fields produce an error only for that query. Text renders shared project/revision/snapshot once, then one query-ID section with that query's presentation, status, truncation, reasons, continuation and match evidence. Internally deduplicated storage never appears as tables. One query's failure or truncation does not contaminate siblings. Batch-level stale revision/snapshot admission fails before queries run.",
			hydration:
				"graph_operations_json requires revision and snapshotId and reads only 1–20 selected operation references. It returns canonical operation configurations, deduplicates repeated references and reports missing ones. items_json and item_lines_json remain available for complete item/line documents; compare their revision before combining reads.",
		},
		examples: [
			{
				tool: "graph_operations",
				arguments: {
					operationKinds: [
						"merge",
					],
					aggregate: {
						mode: "count",
					},
				},
			},
			{
				tool: "graph_operations",
				arguments: {
					operationKinds: [
						"merge",
					],
					aggregate: {
						mode: "group",
						by: "owner",
					},
					limit: 10,
				},
			},
			{
				tool: "graph_operations",
				arguments: {
					operationKinds: [
						"line",
					],
					aggregate: {
						mode: "group",
						by: "lineTitle",
					},
				},
			},
			{
				tool: "graph_search",
				arguments: {
					query: "Candle",
					nodeKinds: [
						"item",
					],
				},
			},
			{
				tool: "graph_connections",
				arguments: {
					from: "item:candle",
					direction: "in",
					kinds: [
						"line-item-outcome",
						"merge-replacement",
					],
				},
			},
			{
				tool: "graph_operations",
				arguments: {
					operationKinds: [
						"line",
					],
					search: {
						text: "Digest",
						scope: "title",
					},
					filter: {
						clock: true,
						show: false,
						enable: true,
						clockWeight: {
							gt: 15,
						},
					},
				},
			},
			{
				tool: "graph_operations",
				arguments: {
					operationKinds: [
						"merge",
					],
					participant: "item:puppy",
					role: "target",
				},
			},
			{
				tool: "graph_path",
				arguments: {
					from: "item:unlit-candle",
					to: "item:candle",
					direction: "both",
				},
			},
			{
				tool: "graph_flow",
				arguments: {
					from: "item:unlit-candle",
					to: "item:candle",
					maxDepth: 5,
				},
			},
			{
				tool: "graph_traverse",
				arguments: {
					from: "item:candle",
					maxDepth: 2,
					kinds: [
						"line-material",
						"line-item-outcome",
					],
				},
			},
			{
				tool: "graph_batch",
				arguments: {
					queries: [
						{
							id: "puppy-merges",
							query: {
								kind: "operations",
								operationKinds: [
									"merge",
								],
								participant: "item:puppy",
								role: "target",
							},
						},
						{
							id: "candle-flow",
							query: {
								kind: "flow",
								from: "item:unlit-candle",
								to: "item:candle",
							},
						},
					],
				},
			},
			{
				tool: "graph_operations_json",
				arguments: {
					revision: 42,
					snapshotId: "<returned snapshotId>",
					operationIds: [
						"<selected opaque operation reference>",
					],
				},
			},
		],
	});
