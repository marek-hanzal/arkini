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
		"Initial configuration → current initial space and every configured initial space; distinct occurrences keep distinct edge IDs.",
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
		semantics: {
			purpose:
				"graph_query, graph_query_batch and convenience tools return compact formatted text, not JSON graph dumps. Structured readers end in _json and return one JSON document, including plural batch reads. No JSONL readers are exposed. The graph is a discovery index; read only selected authored documents after discovery.",
			metadata:
				"Discovery omits set/roll IDs and indices, outcome indices and rule/condition bookkeeping. Meaningful scalar facts remain: quantities, consume/reserve, distance, unit source/cost, input index, participant role, probability, alternative branches, board-local semantics and template position. Exact authored grouping belongs to graph_operations_json.",
			text: "Titles are primary; node IDs, short opaque operation references, line UIDs, revision, snapshot and compact continuation tokens stay available. Ordinary identities are bare, for example Puppy [item:puppy] and operationId=op_abc. Only identities containing whitespace, delimiters or control characters use JSON string quoting; decode those quoted values before reuse. Internal edge IDs are never printed. Participant/role-filtered operations include occurrence-level match evidence directly below their summary.",
			direction:
				"Edges keep authored from/to direction even when traversed backwards. Local queries default to both directions; select out or in explicitly where needed. Merge-target is owner → target, not production.",
			occurrences:
				"Parallel relationships and repeated references stay separate internally. Never collapse relationships by endpoint pair. Text omits their internal edge IDs and carries short operation references where applicable.",
			operations:
				"Use kind operations without from to list operations directly. Combine operationKinds, owner, participant, role, search and filter. Search uses the same exact-first Fuse configuration as the Editor, with scope title, owner, participant or all (default). It is fuzzy matching, not an exact substring predicate; search results retain relevance order across pages. Scalar filters are AND-combined: hasOutcomes; merge action/effect/ownership; line clock/default/show; line or Clock enable; runtimeMs, clockWeight, durationMs and intervalMs numeric ranges (min/max inclusive, gt/lt exclusive). A missing property never matches, including false. Owner is always a participant; target identifies an explicit merge target or the owner as receiver for Space transport; input/output identify actual providers/results and reference identifies a rule mention. Role does not reinterpret an authored edge's direction. Query operations even when they have no edges.",
			navigation:
				"Operation summaries identify owner and any explicit merge target/replacement, with human-readable names and exact node IDs in the text. A lineUid pairs with the owner item UID for item_lines_json. operationIds accepts the short opaque references returned in text directly. References are scoped to the captured snapshot; never decode them or submit internal tuple IDs. Matching input/output/reference details preserve each authored occurrence, quantities, mode, distance, unit cost and chance/alternatives without combining mutually exclusive outcomes.",
			paths: "Paths render ordered steps with node identities and short operation references, retaining authored edge direction including backwards traversal. Edge identities remain internal. maxDepth counts relationship hops. Edge-kind filters apply at every hop. A structural path is not a feasible runtime execution plan.",
			results:
				"status yes means a match was found; no means the selected search scope was exhausted without a match; unknown means an incomplete search found none. Inspect truncated and reasons even for yes. Partial absence is never proof of no relationship.",
			limits: "Discovery defaults to depth 1 and 50 results, with at most depth 12 and 200 results per query. Expansion and cooperative timeout bounds apply; timeout excludes snapshot compilation and synchronous indexed lookups. Path limits count paths, whose edges can span maxDepth; operation limits count operations. Operation pages expose nextCursor when scanning can continue.",
			pagination:
				"For kind operations, pass the compact Cursor token back as cursor with the same search/filter/participant selection and the returned revision and snapshotId. Tokens bind the immutable snapshot, normalized filters and continuation position; stale, unknown or incompatible continuations fail. The session retains at most 1024 issued continuations; rediscover when an old token has expired. A page limited before a match is unknown, not no.",
			revision:
				"Every response displays project ID, revision and snapshot ID. Optional revision/snapshotId pin discovery; operation hydration requires both. Snapshot identity also detects external content changes that retain the on-disk revision. Snapshot tokens belong to the current graph session; rediscover after a session restart.",
			batch: "graph_query_batch accepts 1–8 uniquely identified queries and captures one immutable snapshot for the entire request. Nodes, edges and operations are internally deduplicated by ID. Text starts with common project, revision and snapshot, then separate query-ID sections with their own status, truncation, reasons and exact identities; storage tables are not rendered. One query's truncation does not imply another is truncated. Paths, relevance ordering and participant match evidence belong to their own query result, even when queries share the same operation.",
			hydration:
				"graph_operations_json reads only 1–20 requested operation IDs from the discovered revision and snapshot. Returns canonical configurations, deduplicates requested IDs and reports missing IDs. Use existing items_json (itemUids) and item_lines_json (itemUid/lineUid pairs) for complete item or line documents; check their returned revision against discovery before combining data.",
		},
		examples: [
			{
				tool: "graph_query",
				arguments: {
					kind: "operations",
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
				tool: "graph_query",
				arguments: {
					kind: "connections",
					from: "item:puppy",
					direction: "both",
				},
			},
			{
				tool: "graph_query",
				arguments: {
					kind: "operations",
					operationKinds: [
						"merge",
					],
				},
			},
			{
				tool: "graph_query",
				arguments: {
					kind: "operations",
					operationKinds: [
						"merge",
					],
					participant: "item:puppy",
					role: "target",
				},
			},
			{
				tool: "graph_query",
				arguments: {
					kind: "connections",
					from: "item:puppy",
					direction: "in",
					kinds: [
						"merge-target",
					],
				},
			},
			{
				tool: "graph_query_batch",
				arguments: {
					queries: [
						{
							id: "pillow",
							query: {
								kind: "connections",
								from: "item:pillow",
							},
						},
						{
							id: "sword",
							query: {
								kind: "connections",
								from: "item:sword",
							},
						},
						{
							id: "fawn",
							query: {
								kind: "connections",
								from: "item:fawn",
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
