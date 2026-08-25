import { McpServer } from "@modelcontextprotocol/server";
import { Effect } from "effect";
import { z } from "zod";

import { ArkiniAppVersion } from "../../../../shared/ArkiniAppMetadata";
import type { EditorProjectRepositoryService } from "~/editor/EditorProjectRepository";
import { EditorItemEstimateQuantitySchema } from "~/editor/estimator/EditorItemEstimateQuantitySchema";
import { IdSchema } from "~/engine/common/schema/IdSchema";
import { EditorMcpEstimateInputSchema } from "./EditorMcpEstimateInputSchema";
import { EditorMcpItemCollectionInputSchema } from "./EditorMcpItemCollectionInputSchema";
import { readEditorMcpEstimateTextFx } from "./readEditorMcpEstimateTextFx";
import { readEditorMcpItemCollectionTextFx } from "./readEditorMcpItemCollectionTextFx";
import { readEditorMcpItemDetailTextFx } from "./readEditorMcpItemDetailTextFx";
import { readEditorMcpItemEstimateTextFx } from "./readEditorMcpItemEstimateTextFx";
import { readEditorMcpItemMetaTextFx } from "./readEditorMcpItemMetaTextFx";
import { readEditorMcpItemRelationTextFx } from "./readEditorMcpItemRelationTextFx";
import { readEditorMcpProjectTextFx } from "./readEditorMcpProjectTextFx";

const errorText = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

const readCurrentProjectFx = (
	repository: EditorProjectRepositoryService,
	readProjectContext: () => string | undefined,
) =>
	Effect.gen(function* () {
		const projectId = yield* Effect.try({
			try: () => {
				const current = readProjectContext();
				if (current === undefined)
					throw new Error(
						"No editor project is currently open. Open a project in Arkini before using editor tools.",
					);
				return current;
			},
			catch: (cause) => cause,
		});
		const project = yield* repository.readProjectFx(projectId);
		if (project === null)
			return yield* Effect.fail(
				new Error(`The open editor project ${projectId} no longer exists.`),
			);
		return project;
	});

const createEditorMcpServer = (
	repository: EditorProjectRepositoryService,
	readProjectContext: () => string | undefined,
	runPromise: <Value, Error>(effect: Effect.Effect<Value, Error>) => Promise<Value>,
) => {
	const runTool = async (effect: Effect.Effect<string, unknown>) => {
		try {
			return {
				content: [
					{
						type: "text" as const,
						text: await runPromise(effect),
					},
				],
			};
		} catch (cause) {
			return {
				isError: true,
				content: [
					{
						type: "text" as const,
						text: `Editor operation failed: ${errorText(cause)}`,
					},
				],
			};
		}
	};
	const server = new McpServer(
		{
			name: "arkini-editor",
			version: ArkiniAppVersion,
		},
		{
			instructions:
				"Every tool reads only the project currently open in the Arkini editor. Tool results mirror the relevant editor UI as concise text and never dump the complete game config.",
		},
	);
	const readProjectFx = () => readCurrentProjectFx(repository, readProjectContext);
	server.registerTool(
		"project",
		{
			description:
				"Summarize the project currently open in Arkini, including its identity, version, layouts, and collection sizes.",
		},
		async () => runTool(readProjectFx().pipe(Effect.flatMap(readEditorMcpProjectTextFx))),
	);
	server.registerTool(
		"item_meta",
		{
			description: "Count items in the open project by their canonical item type.",
		},
		async () => runTool(readProjectFx().pipe(Effect.flatMap(readEditorMcpItemMetaTextFx))),
	);
	server.registerTool(
		"estimate",
		{
			description:
				"Read one page of the global Estimate view for every item at quantity one. Supports the same incomplete-only filter, fastest, slowest, and aggregate-demand ordering, and fuzzy search as the Editor UI. Use item_estimate for one item's selected route detail.",
			inputSchema: EditorMcpEstimateInputSchema,
		},
		async (input) =>
			runTool(
				readProjectFx().pipe(
					Effect.flatMap((project) => readEditorMcpEstimateTextFx(project, input)),
				),
			),
	);
	server.registerTool(
		"item_collection",
		{
			description:
				"List one page of items with collection metadata, title, ID, complete description, and type, optionally filtered by item types and the editor's fuzzy search.",
			inputSchema: EditorMcpItemCollectionInputSchema,
		},
		async (input) =>
			runTool(
				readProjectFx().pipe(
					Effect.flatMap((project) => readEditorMcpItemCollectionTextFx(project, input)),
				),
			),
	);
	server.registerTool(
		"item_detail",
		{
			description:
				"Read the simplified identity and storage detail of one item in the open project.",
			inputSchema: z
				.object({
					id: IdSchema.describe("The exact item ID returned by item_collection."),
				})
				.strict(),
		},
		async ({ id }) =>
			runTool(
				readProjectFx().pipe(
					Effect.flatMap((project) => readEditorMcpItemDetailTextFx(project, id)),
				),
			),
	);
	for (const role of [
		"input",
		"output",
	] as const) {
		const name = role === "input" ? "item_input" : "item_output";
		server.registerTool(
			name,
			{
				description:
					role === "input"
						? "Read where one item is used as an input. Level 1 returns every operation that directly uses it; higher levels repeat input lookup from each reached operation owner. Every operation lists its owner, Runtime when authored, Inputs, and all possible Outputs."
						: "Read where one item is produced as an output. Level 1 returns every operation that directly produces it; higher levels repeat output lookup from each reached operation owner. Every operation lists its owner, Runtime when authored, Inputs, and all possible Outputs.",
				inputSchema: z
					.object({
						itemId: IdSchema.describe(
							"The exact root item ID returned by item_collection.",
						),
						level: z
							.number()
							.int()
							.positive()
							.default(1)
							.describe("Relationship-hop depth; defaults to 1."),
					})
					.strict(),
			},
			async ({ itemId, level }) =>
				runTool(
					readProjectFx().pipe(
						Effect.flatMap((project) =>
							readEditorMcpItemRelationTextFx(project, {
								itemId,
								level,
								role,
							}),
						),
					),
				),
		);
	}
	server.registerTool(
		"item_estimate",
		{
			description:
				"Analyze one item against the authored dependency graph. Returns an optimistic parallel critical-path acquisition route with quantities, expected random-output economics, hard materials, owners, infrastructure, deposits, and positive enable prerequisites. Independent dependency branches may overlap without simulating runtime capacity. Rule truth, runtime rule effects, placement, charges, renewal, and finite capacity are ignored.",
			inputSchema: z
				.object({
					itemId: IdSchema.describe(
						"The exact target item ID returned by item_collection.",
					),
					quantity: EditorItemEstimateQuantitySchema.default(1),
				})
				.strict(),
		},
		async ({ itemId, quantity }) =>
			runTool(
				readProjectFx().pipe(
					Effect.flatMap((project) =>
						readEditorMcpItemEstimateTextFx(project, itemId, quantity),
					),
				),
			),
	);
	return server;
};

/** Creates the synchronous server factory required by the MCP HTTP handler. */
export const createEditorMcpServerFx = Effect.fn("createEditorMcpServerFx")(
	({
		readProjectContext,
		repository,
		runPromise,
	}: {
		readonly readProjectContext: () => string | undefined;
		readonly repository: EditorProjectRepositoryService;
		readonly runPromise: <Value, Error>(effect: Effect.Effect<Value, Error>) => Promise<Value>;
	}) =>
		Effect.succeed({
			create: () => createEditorMcpServer(repository, readProjectContext, runPromise),
		} as const),
);
