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
				"Every node carries id, kind and a required human-readable title. Missing authored references remain inspectable. Node identity is distinct from operation identity. Titles travel with references so discovery needs no item lookup just to name an entity.",
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
			graph_audit: "Snapshot-native design audits with reasons, counts and pinned pages.",
			graph_search:
				"Find a node by title or identity; returns title, exact node ID and kind.",
			graph_connections:
				"Read direct authored relationships of one node, optionally against an exact counterpart.",
			graph_operations: "List, count or group authored operations without a root node.",
			graph_path: "Find structural paths between two nodes; not gameplay recipes.",
			graph_flow:
				"Find directed authored operation paths with explicit rules and stochastic facts; no gameplay evaluation.",
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
			audit: {
				input: "graph_audit requires audit, with optional mode list/count, limit, cursor, revision, snapshotId, maxExpansions and timeoutMs. Only present authored items are audited. Reports facts, never design correctness or gameplay feasibility. All authored outputs count regardless of enable flags, chance, weight, quantity, rules or missing participants.",
				kinds: {
					dangling:
						"No authored relationship of any kind and no configured behavior. Bare Clock/units configuration or an empty simple line does not prevent this match.",
					"no-producer":
						"No authored operation output for this item. Template placements are independent facts and never suppress this match.",
					"no-usage":
						"No actual line input/unit payer or merge source/target/receiver participation. Mere line/Clock/depletion ownership, outputs, references and templates are not usage.",
					"no-behavior":
						"No configured behavior: merge interaction; line with an output, non-simple input or unit cost; Clock/depletion with an output. Item/space/template outputs all count. No rule or availability evaluation.",
					"source-only":
						"Appears in an authored template and has no authored producer. Unassigned templates count.",
					"reference-only":
						"Has rule-reference edges but no other edge or configured behavior.",
				},
				evidence:
					"Each match reports six independent groups: producer, usage, behavior, configuration-only, reference, template. Counts are distinct operations or distinct templates, not edge/placement occurrences. Each group carries up to three deterministic sample identities with the full count. Operation samples include authored scalar summaries and exact references for graph_operations_json. Templates include node identities. configuration-only includes Clock/units without outputs and simple lines without outputs or unit costs. Such presence is not interpreted as behavior. Further relationships are queryable via graph_operations or graph_connections. Count mode returns no rows/evidence.",
				pagination:
					"Audit scans the snapshot item index and pages a frozen result in exact node-ID order. Cursor binds snapshot, audit kind and mode. Continuation does not recompute the analysis. Interrupted scans report lower bounds; retry without cursor and with larger safety bounds for a new scan. limit bounds returned rows, never the analyzed scope; count mode returns no rows. Completed scans have exact totals even while their result pages are truncated.",
			},
			search: "graph_search requires query and optionally nodeKinds (item, template, space, start). It searches human titles and node identities with the canonical Editor exact-first Fuse logic, returning relevance-ordered titled identities. It can inspect unfinished projects with missing referenced nodes. No item_collection lookup is needed before graph navigation.",
			connections:
				"graph_connections requires from, optionally to as an exact direct counterpart. direction defaults both; kinds restricts relationship occurrences. Results are relationship-oriented and may group occurrences belonging to the same authored operation without losing distinct facts. limit counts relationship occurrences, not visual groups. Pages may return Cursor for remaining relationships.",
			operations:
				"graph_operations has no root node. Combine operationKinds, owner, participant, role, search and filter. Search scopes title, owner, participant or all (default) reuse the Editor exact-first Fuse configuration; matching is fuzzy, not a strict substring predicate, and relevance order persists across pages. Scalar filters combine with AND: hasOutcomes; merge action/effect/ownership; line clock/default/show; line or Clock enable; runtimeMs, clockWeight, durationMs and intervalMs ranges (min/max inclusive, gt/lt exclusive). A missing property never matches, including false. Operations with no edges remain discoverable.",
			aggregation:
				"graph_operations.aggregate selects {mode: count} or {mode: group, by: kind|owner|action|effect|ownership|lineTitle}. The same kind/owner/participant/role/Fuse/scalar filters apply before aggregation. Count returns no operation records. Grouping counts the whole filtered index before applying limit to groups, sorted by count descending then exact group key. Owner groups include title and exact node ID; absent properties form a Not applicable group. Complete counts remain exact even when group pages are truncated. Expansion/timeout interruption yields only explicit lower bounds, no definitive total or stable ranked continuation: retry the original query with larger bounds. Completed grouped scans return snapshot-bound cursors for remaining groups. Aggregation is available unchanged in graph_batch.",
			participants:
				"Owner is always a participant; target identifies an explicit merge target or the owner as receiver for Space transport. Inputs identify material/unit providers, outputs identify actual authored results, and reference identifies a rule mention. Participant/role filters include occurrence-level match evidence: titled input with quantity, consume/reserve, distance and unit cost; output with quantity; target or rule reference. Repeated and alternative outcomes remain separate; exclusive outcomes are never summed.",
			path: "graph_path requires from and to. It finds structural/topological paths, not gameplay recipes or proof of runtime feasibility. With direction both (default), a path can pass through a shared producer, consumer or owner. Ordered steps preserve authored edge direction even when traversed backwards. maxDepth counts relationship hops; kinds applies at every hop. A same-node query returns only the zero-hop identity, never a return cycle.",
			flow: "graph_flow requires from and to. Each directed step binds sources and output occurrences to the same authored operation. operationKinds selects line, merge, clock or depletion; maxDepth counts operation steps. Rule references, shared-owner proximity and reversed production edges are not steps. Disabled operations, zero-chance rolls, zero-quantity outcomes and missing references remain inspectable. No availability, inventory, consumption, unit-balance, co-product compatibility or rule evaluation occurs. Facts expose actual scoped rules and conditions, flags, inputs/costs, selected set weight and alternative position, roll type/chance and output quantity/placement. Values are authored, not a computed path probability. Other branches can be hydrated using the operation reference. Paths are shortest first with stable occurrence order, never repeat a node and have no continuation cursor. Same-node queries return zero steps. Space/template outputs are terminal steps; Start/template placement and receiver-to-space transport are not transformations. No match after complete exploration means no simple authored path in the selected scope; interrupted absence remains unknown. It says nothing about gameplay feasibility.",
			traverse:
				"graph_traverse is advanced broad structural exploration, not operation listing, a path or an operation flow. It requires from and defaults to direction out and depth 1. Depth above one requires an explicit nonempty kinds list to avoid accidental unrestricted expansion. maxDepth counts relationship hops; edge directions remain authored even during reverse exploration.",
			direction:
				"Connections/path default both, traverse defaults out. Choose out or in explicitly where appropriate. Every displayed relationship retains authored from/to direction. Merge-target is owner → target, not production. An empty kinds list selects no relationships where accepted.",
			text: "Titles are primary. Exact node IDs, short opaque operation references, line UIDs, revision, snapshot and compact Cursor tokens remain reusable. Ordinary identities are bare, for example Puppy [item:puppy]. Only identities containing whitespace, delimiters or control characters use lossless JSON string quoting; decode those quoted values before reuse. Internal edge IDs are never printed. No internal node/edge storage tables are rendered.",
			timing: "Authored seconds are exact, without rounding: line runtimeSeconds; Clock intervalSeconds/durationSeconds; item node clock.intervalSeconds/clock.durationSeconds; rule-reference adjustSeconds and flow rule adjustments. Missing timing stays absent. Text uses seconds; operation hydration retains authored milliseconds. Filters accept runtimeSeconds, intervalSeconds and durationSeconds as well as the original millisecond fields. No effective runtime or path duration is calculated.",
			metadata:
				"Compact edge metadata omits source paths, set/roll IDs and indices, outcome indices and rule/condition bookkeeping. It preserves meaningful scalar facts: quantity, consume/reserve, distance, unit source/cost, input index, participant role, probability, alternatives, board-local semantics and template position. Flow evidence additionally identifies its selected set/roll/outcome positions and scoped rules. Full alternative branches remain in operation hydration.",
			navigation:
				"Operation references are short, opaque and bound to the captured snapshot. Pass them unchanged in graph_operations_json.operationIds; never decode them or submit internal tuple IDs. A lineUid pairs with its owner item UID for item_lines_json. Summaries carry human names and exact node identities for owners and relevant participants.",
			results:
				"status yes means a match was found; no means the selected scope was exhausted without a match; unknown means incomplete exploration found none. Inspect truncated and reasons even when status is yes, because omitted alternatives may exist. Depth, result, expansion and timeout limits can make search incomplete; partial absence is not proof of no relationship or no flow.",
			limits: "Result limit defaults 50, maximum 200. Path/flow depth defaults 5, traverse depth 1; depth maximum 12. Expansion defaults 10000, maximum 100000; cooperative timeout defaults 1000 ms, maximum 5000 ms. Search only exposes result bounds; connections are direct. Limit counts relationships for connections/traverse, operations for listing or groups for grouping (count ignores result limit), nodes for search, paths for path and transformation sequences for flow. Paths and flows may contain up to maxDepth steps per result. Timeout excludes synchronous snapshot compilation, index lookups, Fuse search and scalar candidate filtering; it is not an end-to-end deadline.",
			continuation:
				"Connections and operations may return a compact Cursor. Repeat the same focused query and filters with cursor and returned revision/snapshotId. Tokens bind snapshot, normalized filters, aggregation mode/group key and continuation position; unknown, stale or incompatible tokens fail. The session retains at most 1024 issued continuations in FIFO order; rediscover after expiry. A page with no match but remaining scan is unknown.",
			revision:
				"Each response carries project ID, revision and snapshot ID. Optional revision/snapshotId pin discovery; hydration requires both. Snapshot identity detects external content changes even with an unchanged revision. Session-local tokens expire on graph session restart; rediscover then.",
			batch: "graph_batch captures one immutable snapshot and accepts 1–8 uniquely named focused queries. Each query object is admitted separately, so invalid fields produce an error only for that query. Text renders shared project/revision/snapshot once, then one query-ID section with that query's audit/discovery presentation, status, truncation, reasons, continuation and match evidence. Internally deduplicated storage never appears as tables. One query's failure or truncation does not contaminate siblings. Batch-level stale revision/snapshot admission fails before queries run.",
			hydration:
				"graph_operations_json requires revision and snapshotId and reads only 1–20 selected operation references. It returns canonical operation configurations, deduplicates repeated references and reports missing ones. items_json and item_lines_json remain available for complete item/line documents; compare their revision before combining reads.",
		},
		examples: [
			{
				tool: "graph_audit",
				arguments: {
					audit: "dangling",
				},
			},
			{
				tool: "graph_audit",
				arguments: {
					audit: "dangling",
					mode: "count",
				},
			},
			{
				tool: "graph_audit",
				arguments: {
					audit: "source-only",
				},
			},
			{
				tool: "graph_flow",
				arguments: {
					from: "item:A",
					to: "item:C",
				},
			},

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
