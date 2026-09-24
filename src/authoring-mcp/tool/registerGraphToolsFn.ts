import { EditorToolAnnotations } from "./EditorToolAnnotations";
import type { CallToolResult, McpServer } from "@modelcontextprotocol/server";
import { Effect } from "effect";
import { z } from "zod";
import type { Project } from "~/project-authoring/type/Project";
import type { ProjectGraph } from "~/graph/type/ProjectGraph";
import { GraphAuditQuerySchema } from "~/graph/schema/GraphAuditQuerySchema";
import { GraphSearchQuerySchema } from "~/graph/schema/GraphSearchQuerySchema";
import { GraphConnectionsQuerySchema } from "~/graph/schema/GraphConnectionsQuerySchema";
import { GraphOperationsQuerySchema } from "~/graph/schema/GraphOperationsQuerySchema";
import { GraphPathQuerySchema } from "~/graph/schema/GraphPathQuerySchema";
import { GraphFlowQuerySchema } from "~/graph/schema/GraphFlowQuerySchema";
import { GraphTraverseQuerySchema } from "~/graph/schema/GraphTraverseQuerySchema";
import { GraphBatchQuerySchema } from "~/graph/schema/GraphBatchQuerySchema";
import { GraphOperationReadSchema } from "~/graph/schema/GraphOperationReadSchema";
import { readGraphDiscoveryTextFn, readGraphBatchTextFn } from "./fn/readGraphDiscoveryTextFn";
import { readGraphSchemaTextFn } from "./fn/readGraphSchemaTextFn";

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
		"graph_schema_json",
		{
			description:
				"Discover compact graph nodes, relationships and operations, query and batch schemas, revision-pinned operation hydration, pagination and limits. Available without an open project.",
			inputSchema: z.object({}).strict().meta({
				$id: "urn:serakki:schema:mcp:graph-schema-json-input",
				title: "Graph schema discovery input",
				description: "Graph schema discovery accepts no arguments.",
			}),
			annotations: EditorToolAnnotations.readOnly,
		},
		async () => runToolFn(Effect.succeed(readGraphSchemaTextFn())),
	);
	server.registerTool(
		"graph_audit",
		{
			description:
				"Read authored item facts from one graph snapshot: dangling, no-producer, no-usage, no-behavior, source-only, reference-only. No gameplay evaluation or design judgment: disabled/zero-chance operations count, template placement is independent of production, and bare Clock/units configuration is not behavior. Returns independent fact counts with up to three exact sample operation/template references per group; operation references can be hydrated. Mode count returns only counts. Interrupted scans report lower bounds. Continue frozen pages with cursor and the same audit/mode plus revision/snapshotId. Read graph_schema_json for precise structural definitions.",
			inputSchema: GraphAuditQuerySchema,
			annotations: EditorToolAnnotations.readOnly,
		},
		async (input) => {
			const query = {
				...input,
				kind: "audit" as const,
			};
			return runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) => graph.discoveryFx(project, query)),
					Effect.map((result) => readGraphDiscoveryTextFn(result, query)),
				),
			);
		},
	);
	server.registerTool(
		"graph_search",
		{
			description:
				"Find a graph node by human title or exact identity using the same fuzzy search as the Editor. Returns titled node IDs and kinds, without authored configurations. Use these IDs in focused graph tools.",
			inputSchema: GraphSearchQuerySchema,
			annotations: EditorToolAnnotations.readOnly,
		},
		async (input) => {
			const query = {
				...input,
				kind: "search" as const,
			};
			return runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) => graph.discoveryFx(project, query)),
					Effect.map((result) => readGraphDiscoveryTextFn(result, query)),
				),
			);
		},
	);
	server.registerTool(
		"graph_connections",
		{
			description:
				"Read direct authored relationships of one node, optionally restricted to an exact counterpart, direction and edge kinds. Returns compact relationship-oriented text, operation references and paginated continuation. Continue with unchanged filters plus cursor and returned revision/snapshotId.",
			inputSchema: GraphConnectionsQuerySchema,
			annotations: EditorToolAnnotations.readOnly,
		},
		async (input) => {
			const query = {
				...input,
				kind: "connections" as const,
			};
			return runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) => graph.discoveryFx(project, query)),
					Effect.map((result) => readGraphDiscoveryTextFn(result, query)),
				),
			);
		},
	);
	server.registerTool(
		"graph_operations",
		{
			description:
				"Search the authored operation index without a root node: merge, line, Clock and depletion. Filter by kind, owner, participant/role and scalar properties. Search operation, owner or participant titles with canonical Editor Fuse semantics. Matching participant facts explain each result without hydration; selected operation references feed graph_operations_json. Use aggregate {mode: count} for a whole-scope count, or {mode: group, by: owner} for ranked groups (kind, owner, action, effect, ownership, lineTitle). All filters apply before aggregation; limit bounds groups, not the counted scope. Incomplete counts are explicit lower bounds. Supports pinned continuation.",
			inputSchema: GraphOperationsQuerySchema,
			annotations: EditorToolAnnotations.readOnly,
		},
		async (input) => {
			const query = {
				...input,
				kind: "operations" as const,
			};
			return runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) => graph.discoveryFx(project, query)),
					Effect.map((result) => readGraphDiscoveryTextFn(result, query)),
				),
			);
		},
	);
	server.registerTool(
		"graph_path",
		{
			description:
				"Find bounded structural/topological paths between two exact graph nodes, preserving authored edge direction. This is not a gameplay recipe or proof of runtime feasibility. With direction both, paths may pass through a shared producer, consumer or owner. Use graph_flow for authored operation paths.",
			inputSchema: GraphPathQuerySchema,
			annotations: EditorToolAnnotations.readOnly,
		},
		async (input) => {
			const query = {
				...input,
				kind: "path" as const,
			};
			return runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) => graph.discoveryFx(project, query)),
					Effect.map((result) => readGraphDiscoveryTextFn(result, query)),
				),
			);
		},
	);
	server.registerTool(
		"graph_flow",
		{
			description:
				"Find directed simple paths from A to B through authored operations, shortest first. Each step binds sources and outputs to the same operation. Returns participants, exact scoped rules and conditions, flags, inputs and stochastic output facts without evaluating them. Disabled operations, zero chances and missing references remain visible. No inventory, consumption-state or gameplay feasibility evaluation. Nodes do not repeat within a path; same-node queries return zero steps. Use operation references for further hydration. Truncated no-match results remain unknown.",
			inputSchema: GraphFlowQuerySchema,
			annotations: EditorToolAnnotations.readOnly,
		},
		async (input) => {
			const query = {
				...input,
				kind: "flow" as const,
			};
			return runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) => graph.discoveryFx(project, query)),
					Effect.map((result) => readGraphDiscoveryTextFn(result, query)),
				),
			);
		},
	);
	server.registerTool(
		"graph_traverse",
		{
			description:
				"Advanced broad structural exploration around a node across relationship hops. Depth above one requires explicit nonempty edge kinds. Prefer graph_connections for direct relationships, graph_operations for listing, graph_path for structural paths and graph_flow for authored operation paths.",
			inputSchema: GraphTraverseQuerySchema,
			annotations: EditorToolAnnotations.readOnly,
		},
		async (input) => {
			const query = {
				...input,
				kind: "traverse" as const,
			};
			return runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) => graph.discoveryFx(project, query)),
					Effect.map((result) => readGraphDiscoveryTextFn(result, query)),
				),
			);
		},
	);
	server.registerTool(
		"graph_batch",
		{
			description:
				"Run 1–8 uniquely named focused graph queries (search, connections, operations, path, flow, traverse or audit) against one immutable project snapshot and revision. Returns formatted text with common snapshot metadata and separate named query sections, each with its status, truncation, reasons and exact navigation identities. Use after discovery to expand several interesting branches without repeated graph payloads. Read graph_schema_json for bounds and continuation.",
			inputSchema: GraphBatchQuerySchema,
			annotations: EditorToolAnnotations.readOnly,
		},
		async (input) =>
			runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) => graph.batchFx(project, input)),
					Effect.map((result) => readGraphBatchTextFn(result, input.queries)),
				),
			),
	);
	server.registerTool(
		"graph_operations_json",
		{
			description:
				"Read canonical authored configurations for 1–20 graph operation IDs selected during discovery. Pass the short opaque operation references from discovery directly in operationIds. Required revision and snapshotId must match the discovery result, including after same-revision external edits; stale requests fail. Duplicate IDs are returned once, missing IDs are reported. Prefer items_json for complete items and item_lines_json for known item/line UID pairs.",
			inputSchema: GraphOperationReadSchema,
			annotations: EditorToolAnnotations.readOnly,
		},
		async (input) =>
			runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) => graph.readOperationsFx(project, input)),
					Effect.map((result) => JSON.stringify(result)),
				),
			),
	);
};
