import { z } from "zod";
import { GraphQuerySchema } from "~/graph/schema/GraphQuerySchema";
import type { GraphEdgeKindSchema } from "~/graph/schema/GraphEdgeKindSchema";

const edgeKinds: Record<GraphEdgeKindSchema.Type, string> = {
	"line-material":
		"Selected material item → line owner; input annotation retains quantity, consume/reserve mode and spatial query.",
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
		"Initial configuration → current initial space and every configured initial space; occurrences retain their source paths.",
};

/** Discovery is derived from the same admitted query schema used by the graph backend. */
export const readGraphSchemaTextFn = () =>
	JSON.stringify({
		nodes: {
			item: "item:<exact item UID>",
			template: "template:<exact template UID>",
			space: "space:<space number>",
			start: "start",
		},
		edgeKinds,
		querySchema: z.toJSONSchema(GraphQuerySchema),
		semantics: {
			direction:
				"Edges keep authored from/to direction even when a query follows incoming edges. Both follows either direction.",
			occurrences:
				"Parallel relationships and repeated references have separate edge IDs and exact config source paths. Do not collapse edges by endpoint pair.",
			operations:
				"Edges reference operationId where applicable. Full reified operation records preserve exact authored data: inputs, rules, timing, merge action/effect, alternative sets and outcomes. Node lookup includes owned operations even when they have no item edges. Edge annotations retain set/roll identity, weights, chance, quantity and participant role. Summary connections/traverse retains edges and operation IDs but omits operation records and paths. Summary path is an existence query and omits nodes, edges, operations and paths.",
			paths: "Paths contain ordered node IDs and edge IDs. maxDepth counts relationship hops. Edge kind filters apply to every hop.",
			results:
				"Results include projectId, revision, status, nodes, edges, operations, paths, expansions, truncated and reasons. A found match is yes; no means no match in a completely searched scope; unknown reports an incomplete search without a match. Inspect truncated and reasons even for yes.",
			limits: "Depth, result count and expansions bound traversal; timeout is checked cooperatively during traversal and excludes snapshot compilation. A truncated result is partial; omitted edges must not be treated as absent.",
			revision:
				"Optional revision pins the query to the current project revision; stale requests fail. Every result comes from one immutable snapshot.",
		},
		examples: [
			{
				kind: "connections",
				from: "item:target",
				direction: "in",
				kinds: [
					"line-item-outcome",
				],
			},
			{
				kind: "connections",
				from: "item:A",
				to: "item:B",
				direction: "both",
			},
			{
				kind: "path",
				from: "item:A",
				to: "item:B",
				kinds: [
					"merge-replacement",
					"merge-item-outcome",
				],
			},
		],
	});
