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
				"The graph is a compact discovery index. It never includes authored input/query/rule/outcome/roll/set/merge configuration bodies. Read only selected documents after discovery.",
			direction:
				"Edges keep authored from/to direction even when traversed backwards. Local queries default to both directions; select out or in explicitly where needed. Merge-target is owner → target, not production.",
			occurrences:
				"Parallel relationships and repeated references have separate edge IDs. Never collapse edges by endpoint pair. Edges reference compact operation records by operationId where applicable.",
			operations:
				"Use kind operations without from to list operations directly. Filter by operationKinds, owner, participant and role. Owner is always a participant; target identifies an explicit merge target or the owner as receiver for Space transport; input/output identify actual providers/results and reference identifies a rule mention. Role does not reinterpret an authored edge's direction. Query operations even when they have no edges.",
			navigation:
				"Operation summaries identify owner and any explicit merge target/replacement, with titled nodes in the payload. A lineUid pairs with the owner item UID for item_line_configs. Operation IDs are exact opaque strings; do not parse them to find authored array positions.",
			paths: "Paths contain ordered node IDs and edge IDs. maxDepth counts relationship hops. Edge-kind filters apply at every hop. A structural path is not a feasible runtime execution plan.",
			results:
				"status yes means a match was found; no means the selected search scope was exhausted without a match; unknown means an incomplete search found none. Inspect truncated and reasons even for yes. Partial absence is never proof of no relationship.",
			limits: "Discovery defaults to depth 1 and 50 results, with at most depth 12 and 200 results per query. Expansion and cooperative timeout bounds apply; timeout excludes snapshot compilation and synchronous indexed lookups. Path limits count paths, whose edges can span maxDepth; operation limits count operations. Operation pages expose nextCursor when scanning can continue.",
			pagination:
				"For kind operations, repeat the same filters with nextCursor as cursor and the returned revision and snapshotId. The cursor is scoped to that immutable snapshot and filter selection; stale or incompatible continuations fail. A page limited before a match is unknown, not no.",
			revision:
				"Every response includes projectId, revision and snapshotId. Optional revision/snapshotId pin discovery; operation hydration requires both. Snapshot identity also detects external content changes that retain the on-disk revision. Snapshot tokens belong to the current graph session; rediscover after a session restart.",
			batch: "graph_query_batch accepts 1–8 uniquely identified queries and captures one immutable snapshot for the entire request. Common nodes, edges and operations are deduplicated by ID; each result carries its query ID, status, truncation reasons and references to its own records. One query's truncation does not imply another is truncated. Paths belong to their query result.",
			hydration:
				"graph_operation_configs reads only 1–20 requested operation IDs from the discovered revision and snapshot. Returns canonical configurations, deduplicates requested IDs and reports missing IDs. Use existing item_configs (itemUids) and item_line_configs (itemUid/lineUid pairs) for complete item or line documents; check their returned revision against discovery before combining data.",
		},
		examples: [
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
				tool: "graph_operation_configs",
				arguments: {
					revision: 42,
					snapshotId: "<returned snapshotId>",
					operationIds: [
						"<selected operation ID>",
					],
				},
			},
		],
	});
