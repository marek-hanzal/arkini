import type { CallToolResult, McpServer } from "@modelcontextprotocol/server";
import { Effect } from "effect";
import { z } from "zod";
import { IdSchema } from "~/game-value/schema/IdSchema";
import type { Project } from "~/project-authoring/type/Project";
import type { ProjectGraph } from "~/graph/type/ProjectGraph";
import { GraphDiscoveryQuerySchema } from "~/graph/schema/GraphDiscoveryQuerySchema";
import { GraphBatchQuerySchema } from "~/graph/schema/GraphBatchQuerySchema";
import { GraphOperationReadSchema } from "~/graph/schema/GraphOperationReadSchema";
import { readItemChainQueryFn } from "~/graph/fn/readItemChainQueryFn";
import { readItemConnectionQueryFn } from "~/graph/fn/readItemConnectionQueryFn";
import { readGraphSchemaTextFn } from "./fn/readGraphSchemaTextFn";

const itemRelationInputSchemaFn = (role: "input" | "output") =>
	z
		.object({
			itemUid: IdSchema.describe("The exact root item UID returned by item_collection."),
			level: z
				.number()
				.int()
				.positive()
				.max(12)
				.default(1)
				.describe("Relationship-hop depth; defaults to 1."),
		})
		.strict()
		.meta({
			$id: `urn:serakki:schema:mcp:item-${role === "input" ? "input" : "outcome"}-relation`,
			title: `Item ${role} relation tool input`,
			description: `The root item and traversal depth for the item ${role} relation tool.`,
		});

const ItemChainInputSchema = z
	.object({
		itemUid: IdSchema.describe("The exact starting item UID returned by item_collection."),
		maxDepth: z
			.number()
			.int()
			.min(1)
			.max(12)
			.default(5)
			.describe("Maximum relationship-hop depth; defaults to 5."),
	})
	.strict()
	.meta({
		$id: "urn:serakki:schema:mcp:item-chain-input",
		title: "Item Chain tool input",
		description: "The starting item and bounded traversal depth for the Chain projection.",
	});

/** MCP exposes compact discovery and selective hydration over one graph capability. */
export const registerGraphToolsFn = ({
	server,
	graph,
	readProjectFx,
	runToolFn,
}: {
	readonly server: McpServer;
	readonly graph: ProjectGraph;
	readonly readProjectFx: () => Effect.Effect<Project, unknown>;
	readonly runToolFn: (effect: Effect.Effect<string, unknown>) => Promise<CallToolResult>;
}) => {
	server.registerTool(
		"graph_schema",
		{
			description:
				"Discover compact graph nodes, relationships and operations, query and batch schemas, revision-pinned operation hydration, pagination and limits. Available without an open project.",
			inputSchema: z.object({}).strict().meta({
				$id: "urn:serakki:schema:mcp:graph-schema-input",
				title: "Graph schema discovery input",
				description: "Graph schema discovery accepts no arguments.",
			}),
			annotations: {
				readOnlyHint: true,
			},
		},
		async () => runToolFn(Effect.succeed(readGraphSchemaTextFn())),
	);
	server.registerTool(
		"graph_query",
		{
			description:
				"Discover the authored project graph with compact titled nodes, typed edges and operation summaries. Query local connections, traversal, paths or operations directly without a root (for example kind operations with operationKinds merge). Filter operations by owner or participant and role. Read graph_schema for continuation and bounds; hydrate selected operation IDs through graph_operation_configs or use item_configs/item_line_configs. No authored configuration bodies or executable queries are returned or accepted.",
			inputSchema: GraphDiscoveryQuerySchema,
			annotations: {
				readOnlyHint: true,
			},
		},
		async (input) =>
			runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) => graph.discoveryFx(project, input)),
					Effect.map((result) => JSON.stringify(result)),
				),
			),
	);
	server.registerTool(
		"graph_query_batch",
		{
			description:
				"Run 1–8 uniquely named graph queries against one immutable project snapshot and revision. Returns one deduplicated compact node/edge/operation payload and per-query status, truncation, reasons and identity references. Use after discovery to expand several interesting branches without repeated graph payloads. Read graph_schema for bounds and continuation.",
			inputSchema: GraphBatchQuerySchema,
			annotations: {
				readOnlyHint: true,
			},
		},
		async (input) =>
			runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) => graph.batchFx(project, input)),
					Effect.map((result) => JSON.stringify(result)),
				),
			),
	);
	server.registerTool(
		"graph_operation_configs",
		{
			description:
				"Read canonical authored configurations for 1–20 graph operation IDs selected during discovery. Required revision and snapshotId must match the discovery result, including after same-revision external edits; stale requests fail. Duplicate IDs are returned once, missing IDs are reported. Prefer item_configs for complete items and item_line_configs for known item/line UID pairs.",
			inputSchema: GraphOperationReadSchema,
			annotations: {
				readOnlyHint: true,
			},
		},
		async (input) =>
			runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) => graph.readOperationsFx(project, input)),
					Effect.map((result) => JSON.stringify(result)),
				),
			),
	);
	for (const role of [
		"input",
		"output",
	] as const) {
		server.registerTool(
			role === "input" ? "item_input" : "item_outcome",
			{
				description:
					role === "input"
						? "Discover where an item is used as a line material, unit provider or unit cost. Compact outgoing input relationships; level is bounded relationship-hop depth (1–12). Hydrate only selected details with graph_operation_configs, item_configs or item_line_configs."
						: "Discover what produces an item through lines, merge outcomes/replacement, Clock or depletion. Compact incoming output relationships; level is bounded relationship-hop depth (1–12). Hydrate only selected details with graph_operation_configs, item_configs or item_line_configs.",
				inputSchema: itemRelationInputSchemaFn(role),
				annotations: {
					readOnlyHint: true,
				},
			},
			async ({ itemUid, level }) =>
				runToolFn(
					readProjectFx().pipe(
						Effect.flatMap((project) => {
							const preset = readItemConnectionQueryFn(
								itemUid,
								role === "input" ? "required-by" : "produced-by",
							);
							return graph.discoveryFx(project, {
								kind: level === 1 ? "connections" : "traverse",
								from: preset.from,
								direction: preset.direction,
								kinds: preset.kinds,
								maxDepth: level,
							});
						}),
						Effect.map((result) => JSON.stringify(result)),
					),
				),
		);
	}
	server.registerTool(
		"item_chain",
		{
			description:
				"Discover bounded outgoing authored consequences: lines, merges, Clock, depletion, spaces and templates. Returns compact graph records; maxDepth counts relationship hops (1–12, default 5). Use graph_query for other edge kinds or direction, and batch readers for selected configurations.",
			inputSchema: ItemChainInputSchema,
			annotations: {
				readOnlyHint: true,
			},
		},
		async ({ itemUid, maxDepth }) =>
			runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) => {
						const preset = readItemChainQueryFn(itemUid, maxDepth);
						return graph.discoveryFx(project, {
							kind: preset.kind,
							from: preset.from,
							direction: preset.direction,
							kinds: preset.kinds,
							maxDepth,
						});
					}),
					Effect.map((result) => JSON.stringify(result)),
				),
			),
	);
};
