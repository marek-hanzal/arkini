import { McpServer } from "@modelcontextprotocol/server";
import { Effect, Order } from "effect";
import { z } from "zod";

import { ArkiniAppVersion } from "../../../../shared/ArkiniAppMetadata";
import type { EditorProject } from "~/project-authoring/EditorProject";
import type { EditorProjectRepositoryService } from "~/project-authoring/repository/EditorProjectRepository";
import { EditorItemEstimateQuantitySchema } from "~/estimate/domain/EditorItemEstimateQuantitySchema";
import { IdSchema } from "~/engine/common/schema/IdSchema";
import { EstimateInputSchema } from "./EstimateInputSchema";
import { CreateItemInputSchemas, type CreateItemInput } from "./CreateItemInputSchemas";
import { EditItemInputSchemas, type EditItemInput } from "./EditItemInputSchemas";
import { ItemCollectionInputSchema } from "./ItemCollectionInputSchema";
import { createItemFx } from "./createItemFx";
import { editItemFx } from "./editItemFx";
import { readEstimateTextFn } from "./fn/readEstimateTextFn";
import { readItemCollectionTextFn } from "./fn/readItemCollectionTextFn";
import { readItemEstimateTextFx } from "./readItemEstimateTextFx";
import { readItemRelationTextFx } from "./readItemRelationTextFx";
import { registerGameplayDesignTools } from "./registerGameplayDesignTools";
import { registerVersionTools } from "./registerVersionTools";

const itemTypes = [
	"simple",
	"space",
	"producer",
	"craft",
	"blueprint",
	"deposit",
	"stash",
	"temporary",
	"inventory",
] as const;

const ProjectInputSchema = z.object({}).strict().meta({
	$id: "urn:arkini:schema:mcp:project-input",
	title: "Project tool input",
	description: "The project summary tool accepts no arguments.",
});

const ItemMetaInputSchema = z.object({}).strict().meta({
	$id: "urn:arkini:schema:mcp:item-meta-input",
	title: "Item metadata tool input",
	description: "The item metadata summary tool accepts no arguments.",
});

const ItemDetailInputSchema = z
	.object({
		id: IdSchema.describe("The exact item ID returned by item_collection."),
	})
	.strict()
	.meta({
		$id: "urn:arkini:schema:mcp:item-detail-input",
		title: "Item detail tool input",
		description: "The identity of the item whose simplified detail is requested.",
	});

const ItemConfigInputSchema = z
	.object({
		itemId: IdSchema.describe("The exact item ID returned by item_collection."),
	})
	.strict()
	.meta({
		$id: "urn:arkini:schema:mcp:item-config-input",
		title: "Item configuration tool input",
		description: "The identity of the item whose canonical configuration is requested.",
	});

const itemRelationInputSchema = (role: "input" | "output") =>
	z
		.object({
			itemId: IdSchema.describe("The exact root item ID returned by item_collection."),
			level: z
				.number()
				.int()
				.positive()
				.default(1)
				.describe("Relationship-hop depth; defaults to 1."),
		})
		.strict()
		.meta({
			$id: `urn:arkini:schema:mcp:item-${role}-relation`,
			title: `Item ${role} relation tool input`,
			description: `The root item and traversal depth for the item ${role} relation tool.`,
		});

const ItemEstimateInputSchema = z
	.object({
		itemId: IdSchema.describe("The exact target item ID returned by item_collection."),
		quantity: EditorItemEstimateQuantitySchema.default(1),
	})
	.strict()
	.meta({
		$id: "urn:arkini:schema:mcp:item-estimate-input",
		title: "Item estimate tool input",
		description: "The target item and quantity for one authored dependency estimate.",
	});

const errorText = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

const readProjectTextFn = (project: EditorProject) => {
	const avatarResourceIds = Object.entries(project.config.resources)
		.filter(([role]) => role.startsWith("avatar-"))
		.map(([, resourceId]) => resourceId);
	return [
		`Title: ${project.title}`,
		`Project ID: ${project.projectId}`,
		`Game ID: ${project.config.meta.id}`,
		`Arkpack version: ${project.version}`,
		`Revision: ${project.revision}`,
		`Board: ${project.config.meta.board.width} × ${project.config.meta.board.height}`,
		`Toolbar: ${project.config.meta.toolbarSize === undefined || project.config.meta.toolbarSize === 0 ? "disabled" : `${project.config.meta.toolbarSize} slots`}`,
		`Inventory: ${project.config.meta.inventory.width} × ${project.config.meta.inventory.height}`,
		`Hero asset: ${project.config.resources.hero}`,
		...(avatarResourceIds.length === 0
			? []
			: [
					`About avatars: ${avatarResourceIds.join(", ")}`,
				]),
		`Items: ${Object.keys(project.config.items).length}`,
		`Resources: ${project.resources.length}`,
	].join("\n");
};

const readItemMetaTextFn = (project: EditorProject) => {
	const counts = new Map<string, number>();
	for (const item of Object.values(project.config.items))
		counts.set(item.type, (counts.get(item.type) ?? 0) + 1);
	return [
		`Total: ${Object.keys(project.config.items).length}`,
		...[
			...counts.entries(),
		]
			.sort(([left], [right]) => Order.String(left, right))
			.map(([type, count]) => `${type}: ${count}`),
	].join("\n");
};

const readItemDetailTextFx = Effect.fn("readItemDetailTextFx")(
	(project: EditorProject, itemId: string) =>
		Effect.gen(function* () {
			const item = project.config.items[itemId];
			if (item === undefined)
				return yield* Effect.fail(
					new Error(`Item ${itemId} does not exist in the open project.`),
				);
			return [
				`Item: ${item.title}`,
				`ID: ${item.id}`,
				`UID: ${item.uid}`,
				`Type: ${item.type}`,
				"Description:",
				...item.description.split("\n").map((line) => `  ${line}`),
				`Storage: ${item.scope}`,
				`Stack capacity: ${item.maxStackSize}`,
				...(item.maxCount === undefined
					? []
					: [
							`Game limit: ${item.maxCount}`,
						]),
			].join("\n");
		}),
);

const readItemConfigTextFx = Effect.fn("readItemConfigTextFx")(
	(project: EditorProject, itemId: string) =>
		Effect.gen(function* () {
			const item = project.config.items[itemId];
			if (item === undefined)
				return yield* Effect.fail(
					new Error(`Item ${itemId} does not exist in the open project.`),
				);
			return JSON.stringify(
				{
					revision: project.revision,
					item,
				},
				null,
				2,
			);
		}),
);

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

const createServer = (
	notifyProjectChanged: (projectId: string) => void,
	repository: EditorProjectRepositoryService,
	readProjectContext: () => string | undefined,
	requestVersionCheckoutFx: (
		projectId: string,
		versionId: string,
	) => Effect.Effect<void, unknown>,
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
				"Every tool targets only the project currently open in the Arkini editor. Results are concise plain text unless a tool explicitly promises JSON config; no tool dumps complete game configs or snapshot binaries. Create, edit, and version tools persist canonical saved editor state; version_checkout performs an explicit destructive hard reset.",
		},
	);
	const readProjectFx = () => readCurrentProjectFx(repository, readProjectContext);
	for (const type of itemTypes) {
		server.registerTool(
			`create_${type}_item`,
			{
				description: `Create and persist one ${type} item in the open project. Omitted fields use the same defaults as a new ${type}-item form in the Editor UI.`,
				inputSchema: CreateItemInputSchemas[type],
			},
			async (input: CreateItemInput) =>
				runTool(
					readProjectFx().pipe(
						Effect.flatMap((project) =>
							createItemFx({
								input,
								notifyProjectChanged,
								project,
								repository,
								type,
							}),
						),
					),
				),
		);
	}
	for (const type of itemTypes) {
		server.registerTool(
			`edit_${type}_item`,
			{
				description: `Patch one existing ${type} item. Supplied top-level fields replace their complete values, omitted fields remain unchanged, and null clears optional fields. Before replacing a structured field such as asset, charges, merge, line, lines, output, or nested rolls, read item_config and copy its revision into this request.`,
				inputSchema: EditItemInputSchemas[type],
			},
			async (input: EditItemInput) =>
				runTool(
					readProjectFx().pipe(
						Effect.flatMap((project) =>
							editItemFx({
								input,
								notifyProjectChanged,
								project,
								repository,
								type,
							}),
						),
					),
				),
		);
	}
	registerGameplayDesignTools({
		notifyProjectChanged,
		readProjectFx,
		repository,
		runTool,
		server,
	});
	server.registerTool(
		"project",
		{
			description:
				"Summarize the project currently open in Arkini, including its identity, version, layouts, and collection sizes.",
			inputSchema: ProjectInputSchema,
		},
		async () => runTool(readProjectFx().pipe(Effect.map(readProjectTextFn))),
	);
	server.registerTool(
		"item_meta",
		{
			description: "Count items in the open project by their canonical item type.",
			inputSchema: ItemMetaInputSchema,
		},
		async () => runTool(readProjectFx().pipe(Effect.map(readItemMetaTextFn))),
	);
	server.registerTool(
		"estimate",
		{
			description:
				"Read one page of the global approximate Estimate view for every item at quantity one. Supports the same incomplete-only filter, fastest, slowest, aggregate-demand ordering, and fuzzy search as the Editor UI. Use item_estimate for one item's selected route detail.",
			inputSchema: EstimateInputSchema,
		},
		async (input) =>
			runTool(
				readProjectFx().pipe(Effect.map((project) => readEstimateTextFn(project, input))),
			),
	);
	server.registerTool(
		"item_collection",
		{
			description:
				"List one page of items with collection metadata, title, ID, complete description, and type, optionally filtered by item types and the editor's fuzzy search.",
			inputSchema: ItemCollectionInputSchema,
		},
		async (input) =>
			runTool(
				readProjectFx().pipe(
					Effect.map((project) => readItemCollectionTextFn(project, input)),
				),
			),
	);
	server.registerTool(
		"item_detail",
		{
			description:
				"Read the simplified identity and storage detail of one item in the open project.",
			inputSchema: ItemDetailInputSchema,
		},
		async ({ id }) =>
			runTool(
				readProjectFx().pipe(
					Effect.flatMap((project) => readItemDetailTextFx(project, id)),
				),
			),
	);
	server.registerTool(
		"item_config",
		{
			description:
				"Read the complete canonical JSON configuration of one item and its project revision. Use this before replacing structured fields through edit_<type>_item, preserve every unchanged nested value, and copy revision into the edit request.",
			inputSchema: ItemConfigInputSchema,
		},
		async ({ itemId }) =>
			runTool(
				readProjectFx().pipe(
					Effect.flatMap((project) => readItemConfigTextFx(project, itemId)),
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
				inputSchema: itemRelationInputSchema(role),
			},
			async ({ itemId, level }) =>
				runTool(
					readProjectFx().pipe(
						Effect.flatMap((project) =>
							readItemRelationTextFx(project, {
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
				"Approximate one item against the authored dependency graph. The estimator expands from authored starting facts and records the first locally ranked route when each fact becomes reachable, using scalar action time with stable route-ID ties. Admission proves one scalar output unit; larger propagated demand can return partial without retrying quantity-specific alternatives. Demand is divided by scalar expected output yield, and the materialized witness is timed as an optimistic parallel critical path. Equivalent independent occurrences are compressed with an explicit count; shared outputs, shared finite roots, rule truth, runtime effects, placement, charges, renewal, and finite capacity are not simulated.",
			inputSchema: ItemEstimateInputSchema,
		},
		async ({ itemId, quantity }) =>
			runTool(
				readProjectFx().pipe(
					Effect.flatMap((project) => readItemEstimateTextFx(project, itemId, quantity)),
				),
			),
	);
	registerVersionTools({
		notifyProjectChanged,
		readProjectFx,
		repository,
		requestVersionCheckoutFx,
		runTool,
		server,
	});
	return server;
};

/** Creates the synchronous server factory required by the MCP HTTP handler. */
export const createServerFx = Effect.fn("createServerFx")(
	({
		notifyProjectChanged,
		readProjectContext,
		repository,
		requestVersionCheckoutFx,
		runPromise,
	}: {
		readonly notifyProjectChanged: (projectId: string) => void;
		readonly readProjectContext: () => string | undefined;
		readonly repository: EditorProjectRepositoryService;
		readonly requestVersionCheckoutFx: (
			projectId: string,
			versionId: string,
		) => Effect.Effect<void, unknown>;
		readonly runPromise: <Value, Error>(effect: Effect.Effect<Value, Error>) => Promise<Value>;
	}) =>
		Effect.succeed({
			create: () =>
				createServer(
					notifyProjectChanged,
					repository,
					readProjectContext,
					requestVersionCheckoutFx,
					runPromise,
				),
		} as const),
);
