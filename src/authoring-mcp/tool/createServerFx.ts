import { McpServer } from "@modelcontextprotocol/server";
import { Effect, Order } from "effect";
import { z } from "zod";

import { ArkiniAppVersion } from "~shared/ArkiniAppMetadata";
import type { Project } from "~/project-authoring/type/Project";
import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import { ItemEstimateQuantitySchema } from "~/estimate/schema/ItemEstimateQuantitySchema";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { AssetCollectionInputSchema } from "./AssetCollectionInputSchema";
import { EstimateInputSchema } from "./EstimateInputSchema";
import { CreateItemInputSchemas } from "./CreateItemInputSchemas";
import { EditItemInputSchemas } from "./EditItemInputSchemas";
import { ItemCollectionInputSchema } from "./ItemCollectionInputSchema";
import { JsonToolInputSchema } from "./JsonToolInputSchema";
import { createItemFx } from "./createItemFx";
import { editItemFx } from "./editItemFx";
import { readAssetCollectionTextFn } from "./fn/readAssetCollectionTextFn";
import { readEstimateTextFn } from "./fn/readEstimateTextFn";
import { readItemCollectionTextFn } from "./fn/readItemCollectionTextFn";
import { readItemEstimateTextFx } from "./readItemEstimateTextFx";
import { readItemRelationTextFx } from "./readItemRelationTextFx";
import { readSchemaDetailTextFx } from "./readSchemaDetailTextFx";
import { registerGameplayDesignToolsFn } from "./registerGameplayDesignTools";
import { registerVersionToolsFn } from "./registerVersionTools";
import { resolveSchemaId } from "./resolveSchemaId";
import { parseToolInputJsonFx } from "./parseToolInputJsonFx";

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
		quantity: ItemEstimateQuantitySchema.default(1),
	})
	.strict()
	.meta({
		$id: "urn:arkini:schema:mcp:item-estimate-input",
		title: "Item estimate tool input",
		description: "The target item and quantity for one authored dependency estimate.",
	});

const SchemaDetailInputSchema = z
	.object({
		id: z
			.string()
			.min(1)
			.describe(
				"The exact case-sensitive schema ID named by a tool description or a returned $ref.",
			),
	})
	.strict()
	.meta({
		$id: "urn:arkini:schema:mcp:schema-detail-input",
		title: "Schema detail tool input",
		description: "The exact registered schema identity to read.",
	});

const errorTextFn = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

const readProjectTextFn = (project: Project) => {
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

const readItemMetaTextFn = (project: Project) => {
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

const readItemDetailTextFx = Effect.fn("readItemDetailTextFx")((project: Project, itemId: string) =>
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

const readItemConfigTextFx = Effect.fn("readItemConfigTextFx")((project: Project, itemId: string) =>
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
	repository: ProjectRepositoryService,
	readProjectContextFn: () => string | undefined,
) =>
	Effect.gen(function* () {
		const projectId = yield* Effect.try({
			try: () => {
				const current = readProjectContextFn();
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

const createServerFn = (
	notifyProjectChangedFn: (projectId: string) => void,
	repository: ProjectRepositoryService,
	readProjectContextFn: () => string | undefined,
	requestVersionCheckoutFx: (
		projectId: string,
		versionId: string,
	) => Effect.Effect<void, unknown, never>,
	runPromiseFn: <Value, Error>(effect: Effect.Effect<Value, Error, never>) => Promise<Value>,
) => {
	const runToolFn = async (effect: Effect.Effect<string, unknown, never>) => {
		try {
			return {
				content: [
					{
						type: "text" as const,
						text: await runPromiseFn(effect),
					},
				],
			};
		} catch (cause) {
			return {
				isError: true,
				content: [
					{
						type: "text" as const,
						text: `Editor operation failed: ${errorTextFn(cause)}`,
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
				"Every project tool targets only the project currently open in the Arkini editor. Results are concise plain text unless a tool explicitly promises JSON. Structurally large create and edit inputs are serialized JSON strings: retrieve the exact schema named by their tool description through schema_detail and resolve each returned $ref through schema_detail again. Create, edit, and version tools persist canonical saved editor state; version_checkout performs an explicit destructive hard reset.",
		},
	);
	const readProjectFx = () => readCurrentProjectFx(repository, readProjectContextFn);
	server.registerTool(
		"schema_detail",
		{
			description:
				"Read one JSON Schema by its exact case-sensitive Zod registry ID. A returned $ref is another exact ID that can be read through schema_detail. This tool does not require an open project.",
			inputSchema: SchemaDetailInputSchema,
		},
		async ({ id }) => runToolFn(readSchemaDetailTextFx(id)),
	);
	for (const type of itemTypes) {
		const schemaId = resolveSchemaId(CreateItemInputSchemas[type]);
		server.registerTool(
			`create_${type}_item`,
			{
				description: `Create and persist one ${type} item in the open project. Pass input as a serialized JSON object matching schema ${JSON.stringify(schemaId)}; retrieve it and each returned $ref through schema_detail. Omitted fields use the same defaults as a new ${type}-item form in the Editor UI.`,
				inputSchema: JsonToolInputSchema,
			},
			async ({ input }) =>
				runToolFn(
					parseToolInputJsonFx(input, CreateItemInputSchemas[type]).pipe(
						Effect.flatMap((decodedInput) =>
							readProjectFx().pipe(
								Effect.flatMap((project) =>
									createItemFx({
										input: decodedInput,
										notifyProjectChangedFn,
										project,
										repository,
										type,
									}),
								),
							),
						),
					),
				),
		);
	}
	for (const type of itemTypes) {
		const schemaId = resolveSchemaId(EditItemInputSchemas[type]);
		server.registerTool(
			`edit_${type}_item`,
			{
				description: `Patch one existing ${type} item. Pass input as a serialized JSON object matching schema ${JSON.stringify(schemaId)}; retrieve it and each returned $ref through schema_detail. Supplied top-level fields replace their complete values, omitted fields remain unchanged, and null clears optional fields. Before replacing a structured field such as asset, charges, merge, line, lines, output, or nested rolls, read item_config and copy its revision into this request.`,
				inputSchema: JsonToolInputSchema,
			},
			async ({ input }) =>
				runToolFn(
					parseToolInputJsonFx(input, EditItemInputSchemas[type]).pipe(
						Effect.flatMap((decodedInput) =>
							readProjectFx().pipe(
								Effect.flatMap((project) =>
									editItemFx({
										input: decodedInput,
										notifyProjectChangedFn,
										project,
										repository,
										type,
									}),
								),
							),
						),
					),
				),
		);
	}
	registerGameplayDesignToolsFn({
		notifyProjectChangedFn,
		readProjectFx,
		repository,
		runToolFn,
		server,
	});
	server.registerTool(
		"project",
		{
			description:
				"Summarize the project currently open in Arkini, including its identity, version, layouts, and collection sizes.",
			inputSchema: ProjectInputSchema,
		},
		async () => runToolFn(readProjectFx().pipe(Effect.map(readProjectTextFn))),
	);
	server.registerTool(
		"item_meta",
		{
			description: "Count items in the open project by their canonical item type.",
			inputSchema: ItemMetaInputSchema,
		},
		async () => runToolFn(readProjectFx().pipe(Effect.map(readItemMetaTextFn))),
	);
	server.registerTool(
		"estimate",
		{
			description:
				"Read one page of the global approximate Estimate view for every item at quantity one. Supports the same mutually exclusive fastest, slowest, aggregate-demand, and incomplete display modes plus fuzzy search as the Editor UI. Use item_estimate for one item's selected route detail.",
			inputSchema: EstimateInputSchema,
		},
		async (input) =>
			runToolFn(
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
			runToolFn(
				readProjectFx().pipe(
					Effect.map((project) => readItemCollectionTextFn(project, input)),
				),
			),
	);
	server.registerTool(
		"asset_collection",
		{
			description:
				"List one page of assets by type and the Editor Asset library's fuzzy search. Each result contains only its public type and exact ID.",
			inputSchema: AssetCollectionInputSchema,
		},
		async (input) =>
			runToolFn(
				readProjectFx().pipe(
					Effect.map((project) => readAssetCollectionTextFn(project, input)),
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
			runToolFn(
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
			runToolFn(
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
				runToolFn(
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
				"Approximate one item against the authored dependency graph. The estimator uses bounded per-output and correlated joint-output distributions to compute expected first-hitting time, ranks complete quantity-aware routes with stable route-ID ties, and times the selected-fact witness as an optimistic parallel critical path. Demand uses the larger of additive consumption and each selected route's simultaneous consumed-plus-reusable need; finite authored roots and jointly selected co-products are shared. Unsupported bounded state space returns partial. Runtime rule truth, concrete item identity packing, placement, renewable capacity, and engine execution are not simulated.",
			inputSchema: ItemEstimateInputSchema,
		},
		async ({ itemId, quantity }) =>
			runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) => readItemEstimateTextFx(project, itemId, quantity)),
				),
			),
	);
	registerVersionToolsFn({
		notifyProjectChangedFn,
		readProjectFx,
		repository,
		requestVersionCheckoutFx,
		runToolFn,
		server,
	});
	return server;
};

/** Creates the synchronous server factory required by the MCP HTTP handler. */
export const createServerFx = Effect.fn("createServerFx")(
	({
		notifyProjectChangedFn,
		readProjectContextFn,
		repository,
		requestVersionCheckoutFx,
		runPromiseFn,
	}: {
		readonly notifyProjectChangedFn: (projectId: string) => void;
		readonly readProjectContextFn: () => string | undefined;
		readonly repository: ProjectRepositoryService;
		readonly requestVersionCheckoutFx: (
			projectId: string,
			versionId: string,
		) => Effect.Effect<void, unknown, never>;
		readonly runPromiseFn: <Value, Error>(
			effect: Effect.Effect<Value, Error, never>,
		) => Promise<Value>;
	}) =>
		Effect.succeed({
			create: () =>
				createServerFn(
					notifyProjectChangedFn,
					repository,
					readProjectContextFn,
					requestVersionCheckoutFx,
					runPromiseFn,
				),
		} as const),
);
