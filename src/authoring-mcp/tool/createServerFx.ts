import { formatVersionFn } from "~/game-version/fn/formatVersionFn";
import { McpServer } from "@modelcontextprotocol/server";
import { Effect } from "effect";
import { z } from "zod";

import { SerakkiAppVersion } from "~shared/SerakkiAppMetadata";
import type { Project } from "~/project-authoring/type/Project";
import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import { ItemEstimateQuantitySchema } from "~/estimate/schema/ItemEstimateQuantitySchema";
import { IdSchema } from "~/game-value/schema/IdSchema";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import { ArtworkCollectionInputSchema } from "./ArtworkCollectionInputSchema";
import { GraphDetailSchema } from "./GraphDetailSchema";
import { EstimateInputSchema } from "./EstimateInputSchema";
import { CreateItemInputSchema } from "./CreateItemInputSchema";
import { EditItemLinesInputSchema } from "./EditItemLinesInputSchema";
import { editLinesFx } from "~/item-authoring/fx/editLinesFx";
import { EditItemInputSchema } from "./EditItemInputSchema";
import { CreateItemLineInputSchema } from "./CreateItemLineInputSchema";
import { DeleteItemLineInputSchema } from "./DeleteItemLineInputSchema";
import { ReplaceItemLineInputSchema } from "./ReplaceItemLineInputSchema";
import { ItemCollectionInputSchema } from "./ItemCollectionInputSchema";
import { JsonToolInputSchema } from "./JsonToolInputSchema";
import { createItemFx } from "./createItemFx";
import { editItemFx } from "./editItemFx";
import { orderLinesFx } from "~/item-authoring/fx/orderLinesFx";
import { ItemLineOrderInputSchema } from "./ItemLineOrderInputSchema";
import { notifyProjectChangedFx } from "./notifyProjectChangedFx";
import { mutateItemLineFx } from "./mutateItemLineFx";
import { readArtworkCollectionTextFn } from "./fn/readArtworkCollectionTextFn";
import { readEstimateTextFn } from "./fn/readEstimateTextFn";
import { readItemCollectionTextFn } from "./fn/readItemCollectionTextFn";
import { readDraftFn } from "~/item-authoring/fn/readDraftFn";
import { readItemChainTextFx } from "./readItemChainTextFx";
import { readItemEstimateTextFx } from "./readItemEstimateTextFx";
import { readItemRelationTextFx } from "./readItemRelationTextFx";
import { readSchemaDetailTextFx } from "./readSchemaDetailTextFx";
import { registerGameplayDesignToolsFn } from "./registerGameplayDesignTools";
import { registerNoteToolsFn } from "./registerNoteTools";
import { resolveSchemaId } from "./resolveSchemaId";
import { parseToolInputJsonFx } from "./parseToolInputJsonFx";

const ProjectInputSchema = z.object({}).strict().meta({
	$id: "urn:serakki:schema:mcp:project-input",
	title: "Project tool input",
	description: "The project summary tool accepts no arguments.",
});

const ItemMetaInputSchema = z.object({}).strict().meta({
	$id: "urn:serakki:schema:mcp:item-meta-input",
	title: "Item metadata tool input",
	description: "The item metadata summary tool accepts no arguments.",
});

const ItemDetailInputSchema = z
	.object({
		id: IdSchema.describe("The exact item ID returned by item_collection."),
	})
	.strict()
	.meta({
		$id: "urn:serakki:schema:mcp:item-detail-input",
		title: "Item detail tool input",
		description: "The identity of the item whose simplified detail is requested.",
	});

const ItemConfigInputSchema = z
	.object({
		itemId: IdSchema.describe("The exact item ID returned by item_collection."),
	})
	.strict()
	.meta({
		$id: "urn:serakki:schema:mcp:item-config-input",
		title: "Item configuration tool input",
		description: "The identity of the item whose canonical configuration is requested.",
	});

const ItemLineConfigInputSchema = z
	.object({
		itemId: IdSchema.describe("The exact item ID returned by item_collection."),
		lineId: IdSchema.describe("The exact line ID returned by item_lines or item_config."),
	})
	.strict()
	.meta({
		$id: "urn:serakki:schema:mcp:item-line-config-input",
		title: "Item line configuration tool input",
		description: "The item and production-line identities whose canonical config is requested.",
	});

const ItemLinesInputSchema = z
	.object({
		itemId: IdSchema,
	})
	.strict()
	.meta({
		$id: "urn:serakki:schema:mcp:item-lines-input",
		title: "Item line summaries tool input",
		description: "Read authored line identities and behavior in their existing order.",
	});

interface ItemLineReference {
	readonly itemId: string;
	readonly lineId: string;
}

const lineReferenceKeyFn = ({ itemId, lineId }: ItemLineReference) =>
	JSON.stringify([
		itemId,
		lineId,
	]);

const ItemLineConfigsInputSchema = z
	.object({
		lines: z
			.array(z.object(ItemLineConfigInputSchema.shape).strict())
			.min(1)
			.refine(
				(lines) => new Set(lines.map(lineReferenceKeyFn)).size <= 50,
				"Request at most 50 unique item and line pairs.",
			)
			.describe(
				"Up to 50 unique item and line pairs; duplicates are read once in request order.",
			),
	})
	.strict()
	.meta({
		$id: "urn:serakki:schema:mcp:item-line-configs-input",
		title: "Item line configurations tool input",
		description: "Read canonical line configurations from one project snapshot and revision.",
	});

const ItemConfigsInputSchema = z
	.object({
		itemIds: z
			.array(IdSchema)
			.min(1)
			.refine((itemIds) => new Set(itemIds).size <= 50, "Request at most 50 unique item IDs.")
			.describe(
				"Up to 50 unique item IDs; duplicate IDs are read only once, in request order.",
			),
	})
	.strict()
	.meta({
		$id: "urn:serakki:schema:mcp:item-configs-input",
		title: "Item configurations tool input",
		description: "Read canonical item configurations from one project snapshot and revision.",
	});

const itemRelationInputSchema = (role: "input" | "output") =>
	z
		.object({
			itemId: IdSchema.describe("The exact root item ID returned by item_collection."),
			detail: GraphDetailSchema.default("full"),
			level: z
				.number()
				.int()
				.positive()
				.default(1)
				.describe("Relationship-hop depth; defaults to 1."),
		})
		.strict()
		.meta({
			$id: `urn:serakki:schema:mcp:item-${role}-relation`,
			title: `Item ${role} relation tool input`,
			description: `The root item and traversal depth for the item ${role} relation tool.`,
		});

const ItemChainInputSchema = z
	.object({
		itemId: IdSchema.describe("The exact starting item ID returned by item_collection."),
		detail: GraphDetailSchema.default("full").describe(
			"Summary keeps starting operations, their immediate branches and all outcome states; full includes the complete bounded Details tree.",
		),
		maxDepth: z
			.number()
			.int()
			.min(1)
			.max(12)
			.default(5)
			.describe("Maximum operation depth; defaults to 5, matching Item → Chain."),
	})
	.strict()
	.meta({
		$id: "urn:serakki:schema:mcp:item-chain-input",
		title: "Item Chain tool input",
		description:
			"The starting item, detail level and bounded traversal depth for the Chain projection.",
	});

const ItemEstimateInputSchema = z
	.object({
		itemId: IdSchema.describe("The exact target item ID returned by item_collection."),
		quantity: ItemEstimateQuantitySchema.default(1),
		detail: GraphDetailSchema.default("full"),
	})
	.strict()
	.meta({
		$id: "urn:serakki:schema:mcp:item-estimate-input",
		title: "Item estimate tool input",
		description: "The target item and quantity for one authored dependency estimate.",
	});

const SchemaDetailInputSchema = z
	.object({
		resolveDepth: z
			.number()
			.int()
			.min(0)
			.max(256)
			.default(0)
			.describe(
				"Registered $ref expansion depth, 0–256. Zero preserves references; cycles and references at the depth limit remain unresolved.",
			),
		id: z
			.string()
			.min(1)
			.describe(
				"The exact case-sensitive schema ID named by a tool description or a returned $ref.",
			),
	})
	.strict()
	.meta({
		$id: "urn:serakki:schema:mcp:schema-detail-input",
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
		`Serapack version: ${formatVersionFn(project.version)}`,
		`Revision: ${project.revision}`,
		`Board: ${project.config.meta.board.width} × ${project.config.meta.board.height}`,
		`Hero artwork: ${project.config.resources.hero}`,
		...(avatarResourceIds.length === 0
			? []
			: [
					`About avatars: ${avatarResourceIds.join(", ")}`,
				]),
		`Items: ${Object.keys(project.config.items).length}`,
		`Resources: ${project.resources.length}`,
	].join("\n");
};

const readItemMetaTextFn = (project: Project) =>
	`Total: ${Object.keys(project.config.items).length}`;

const readItemDetailTextFx = Effect.fn("readItemDetailTextFx")((project: Project, itemId: string) =>
	Effect.gen(function* () {
		const item = project.config.items[itemId];
		if (item === undefined)
			return yield* Effect.fail(
				new Error(`Item ${itemId} does not exist in the open project.`),
			);
		return [
			`Item: ${item.title}`,
			`Revision: ${project.revision}`,
			`ID: ${item.id}`,
			`UID: ${item.uid}`,
			`Draft: ${readDraftFn(item)}`,
			`UI: ${item.ui}`,
			...(item.description === undefined
				? []
				: [
						"Description:",
						...item.description.split("\n").map((line) => `  ${line}`),
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

const readItemLineConfigTextFx = Effect.fn("readItemLineConfigTextFx")(
	(project: Project, itemId: string, lineId: string) =>
		Effect.gen(function* () {
			const item = project.config.items[itemId];
			if (item === undefined)
				return yield* Effect.fail(
					new Error(`Item ${itemId} does not exist in the open project.`),
				);
			const matchingLines = item.lines.filter(({ id }) => id === lineId);
			if (matchingLines.length === 0)
				return yield* Effect.fail(
					new Error(`Line ${lineId} does not exist on item ${itemId}.`),
				);
			if (matchingLines.length > 1)
				return yield* Effect.fail(
					new Error(
						`Line ${lineId} is ambiguous on item ${itemId}; fix its duplicate line IDs before reading it.`,
					),
				);
			return JSON.stringify(
				{
					revision: project.revision,
					itemId,
					line: matchingLines[0],
				},
				null,
				2,
			);
		}),
);

const readItemLinesTextFx = Effect.fn("readItemLinesTextFx")((project: Project, itemId: string) =>
	Effect.gen(function* () {
		const item = project.config.items[itemId];
		if (item === undefined)
			return yield* Effect.fail(
				new Error(`Item ${itemId} does not exist in the open project.`),
			);
		return JSON.stringify(
			{
				revision: project.revision,
				itemId,
				lines: item.lines.map(
					({ id, title, default: isDefault, clock, clockWeight, show, enable }) => ({
						id,
						title,
						default: isDefault,
						clock: clock === true,
						clockWeight,
						show,
						enable,
					}),
				),
			},
			null,
			2,
		);
	}),
);

const readItemLineConfigsTextFn = (
	project: Project,
	references: ReadonlyArray<ItemLineReference>,
) => {
	const seen = new Set<string>();
	const lines: Array<{
		itemId: string;
		line: LineSchema.Type;
	}> = [];
	const issues: Array<
		ItemLineReference & {
			reason: "item-not-found" | "line-not-found" | "ambiguous-line";
		}
	> = [];
	for (const reference of references) {
		const key = lineReferenceKeyFn(reference);
		if (seen.has(key)) continue;
		seen.add(key);
		const item = project.config.items[reference.itemId];
		if (item === undefined) {
			issues.push({
				...reference,
				reason: "item-not-found",
			});
			continue;
		}
		const matches = item.lines.filter(({ id }) => id === reference.lineId);
		if (matches.length !== 1) {
			issues.push({
				...reference,
				reason: matches.length === 0 ? "line-not-found" : "ambiguous-line",
			});
			continue;
		}
		lines.push({
			itemId: reference.itemId,
			line: matches[0]!,
		});
	}
	return JSON.stringify(
		{
			revision: project.revision,
			lines,
			issues,
		},
		null,
		2,
	);
};

const readItemConfigsTextFn = (project: Project, itemIds: ReadonlyArray<string>) => {
	const uniqueItemIds = [
		...new Set(itemIds),
	];
	return JSON.stringify(
		{
			revision: project.revision,
			items: uniqueItemIds.flatMap((itemId) => {
				const item = project.config.items[itemId];
				return item === undefined
					? []
					: [
							item,
						];
			}),
			missingItemIds: uniqueItemIds.filter(
				(itemId) => project.config.items[itemId] === undefined,
			),
		},
		null,
		2,
	);
};

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
						"No editor project is currently open. Open a project in Serakki before using editor tools.",
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
			name: "serakki-editor",
			version: SerakkiAppVersion,
		},
		{
			instructions:
				"Every project tool targets only the project currently open in the Serakki editor. Results are concise plain text unless a tool explicitly promises JSON. Structurally large create and edit inputs are serialized JSON strings: retrieve the exact schema named by their tool description through schema_detail with optional resolveDepth (0–256) to inline registered references. Remaining $refs can be read through schema_detail again. Create and edit tools persist canonical saved editor state.",
		},
	);
	const readProjectFx = () => readCurrentProjectFx(repository, readProjectContextFn);
	server.registerTool(
		"schema_detail",
		{
			description:
				"Read one JSON Schema by its exact case-sensitive Zod registry ID. Optional resolveDepth (integer 0–256, default 0) expands that many registered $ref edges, independently in each branch. Cycles, unknown references and references at the depth limit remain as $ref. Local fragment references in embedded schemas retain their original resource ID. Depth limits nesting, not total response size. This tool does not require an open project.",
			inputSchema: SchemaDetailInputSchema,
		},
		async ({ id, resolveDepth }) => runToolFn(readSchemaDetailTextFx(id, resolveDepth)),
	);
	{
		const schemaId = resolveSchemaId(CreateItemInputSchema);
		server.registerTool(
			"create_item",
			{
				description: `Create and persist one item in the open project. Pass input as a serialized JSON object matching schema ${JSON.stringify(schemaId)}; retrieve it and each returned $ref through schema_detail. Omitted fields use the same defaults as a new item form in the Editor UI.`,
				inputSchema: JsonToolInputSchema,
			},
			async ({ input }) =>
				runToolFn(
					parseToolInputJsonFx(input, CreateItemInputSchema).pipe(
						Effect.flatMap((decodedInput) =>
							readProjectFx().pipe(
								Effect.flatMap((project) =>
									createItemFx({
										input: decodedInput,
										notifyProjectChangedFn,
										project,
										repository,
									}),
								),
							),
						),
					),
				),
		);
	}
	{
		const schemaId = resolveSchemaId(EditItemInputSchema);
		server.registerTool(
			"edit_item",
			{
				description: `Patch one existing item. Pass input as a serialized JSON object matching schema ${JSON.stringify(schemaId)}; retrieve it and each returned $ref through schema_detail. Supplied top-level fields replace their complete values, omitted fields remain unchanged, and null clears optional fields. Before replacing a structured field such as artwork, units, merge, lines, output, or nested rolls, read item_config and copy its revision into this request.`,
				inputSchema: JsonToolInputSchema,
			},
			async ({ input }) =>
				runToolFn(
					parseToolInputJsonFx(input, EditItemInputSchema).pipe(
						Effect.flatMap((decodedInput) =>
							readProjectFx().pipe(
								Effect.flatMap((project) =>
									editItemFx({
										input: decodedInput,
										notifyProjectChangedFn,
										project,
										repository,
									}),
								),
							),
						),
					),
				),
		);
	}
	const lineTools = [
		{
			name: "create_item_line",
			schema: CreateItemLineInputSchema,
			description:
				"Append one complete production line without resending the item's other lines. Read item_detail or item_lines first and copy its project revision. Supply the complete line according to the input schema. An existing line ID is rejected.",
			decodeFx: (input: string) =>
				parseToolInputJsonFx(input, CreateItemLineInputSchema).pipe(
					Effect.map((decoded) => ({
						...decoded,
						operation: "create" as const,
					})),
				),
		},
		{
			name: "replace_item_line",
			schema: ReplaceItemLineInputSchema,
			description:
				"Replace one existing production line without resending the item's other lines. Read item_line_config first and copy its revision. Supply the complete line according to the input schema; omitted optional values are removed, and the line ID must match the target. Its position is preserved.",
			decodeFx: (input: string) =>
				parseToolInputJsonFx(input, ReplaceItemLineInputSchema).pipe(
					Effect.map((decoded) => ({
						...decoded,
						operation: "replace" as const,
					})),
				),
		},
		{
			name: "delete_item_line",
			schema: DeleteItemLineInputSchema,
			description:
				"Delete exactly one production line. Read item_line_config first and copy its revision. Missing or ambiguous line IDs are rejected; all other item values and line order are preserved.",
			decodeFx: (input: string) =>
				parseToolInputJsonFx(input, DeleteItemLineInputSchema).pipe(
					Effect.map((decoded) => ({
						...decoded,
						operation: "delete" as const,
					})),
				),
		},
	];
	for (const { name, schema, description, decodeFx } of lineTools) {
		server.registerTool(
			name,
			{
				description: `${description} Pass input as a serialized JSON object matching schema ${JSON.stringify(resolveSchemaId(schema))}; retrieve it and each returned $ref through schema_detail.`,
				inputSchema: JsonToolInputSchema,
			},
			async ({ input }) => {
				const commandFx: Effect.Effect<mutateItemLineFx.Command, unknown> = decodeFx(input);
				return runToolFn(
					commandFx.pipe(
						Effect.flatMap((command) =>
							readProjectFx().pipe(
								Effect.flatMap((project) =>
									mutateItemLineFx({
										input: command,
										notifyProjectChangedFn,
										project,
										repository,
									}),
								),
							),
						),
					),
				);
			},
		);
	}

	server.registerTool(
		"edit_item_lines",
		{
			description: `Apply 1–20 create, replace or delete line operations across items with one project revision. Each item/line pair may appear once. Create appends; replace preserves position and requires a matching line ID; delete removes exactly one line. Complete replacements use the same schema as replace_item_line. All operations and resulting items are validated before one best-effort repository commit; invalid input or stale revision writes nothing. Returns a new revision and an operation summary. Pass input as serialized JSON matching schema ${JSON.stringify(resolveSchemaId(EditItemLinesInputSchema))}; retrieve it and each $ref through schema_detail.`,
			inputSchema: JsonToolInputSchema,
		},
		async ({ input }) =>
			runToolFn(
				Effect.gen(function* () {
					const decoded = yield* parseToolInputJsonFx(input, EditItemLinesInputSchema);
					const project = yield* readProjectFx();
					const commit = yield* editLinesFx({
						...decoded,
						project,
						repository,
					});
					yield* notifyProjectChangedFx(notifyProjectChangedFn, project.projectId);
					return [
						`Edited ${decoded.operations.length} item lines.`,
						`Revision: ${commit.revision}`,
						...decoded.operations.map(
							(operation, index) =>
								`${index + 1}. ${operation.operation}: ${operation.itemId} / ${operation.operation === "create" ? operation.line.id : operation.lineId}`,
						),
					].join("\n");
				}),
			),
	);

	server.registerTool(
		"item_line_order",
		{
			description:
				"Reorder an item's existing production lines. Supply every line ID exactly once in the desired order and the revision from item_config or item_configs. Missing, unknown or duplicate IDs are rejected without changing the project. Only order changes; line values and all other item fields are preserved.",
			inputSchema: ItemLineOrderInputSchema,
		},
		async (input) =>
			runToolFn(
				Effect.gen(function* () {
					const project = yield* readProjectFx();
					const { commit } = yield* orderLinesFx({
						...input,
						project,
						repository,
					});
					yield* notifyProjectChangedFx(notifyProjectChangedFn, project.projectId);
					return [
						"Reordered item lines.",
						`Item ID: ${input.itemId}`,
						`Line IDs: ${input.lineIds.join(", ")}`,
						`Revision: ${commit.revision}`,
					].join("\n");
				}),
			),
	);

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
				"Summarize the project currently open in Serakki, including its identity, version, layouts, and collection sizes.",
			inputSchema: ProjectInputSchema,
		},
		async () => runToolFn(readProjectFx().pipe(Effect.map(readProjectTextFn))),
	);
	server.registerTool(
		"item_meta",
		{
			description: "Count items in the open project.",
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
				"List one page of items with collection metadata, title, ID, optional description, and Editor draft status, optionally filtered by the editor's fuzzy search.",
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
		"artwork_collection",
		{
			description:
				"List one page of Artwork with the Editor Artwork library's usage filter and fuzzy search. Each result contains its semantic type and exact ID.",
			inputSchema: ArtworkCollectionInputSchema,
		},
		async (input) =>
			runToolFn(
				readProjectFx().pipe(
					Effect.map((project) => readArtworkCollectionTextFn(project, input)),
				),
			),
	);
	registerNoteToolsFn({
		notifyProjectChangedFn,
		readProjectFx,
		repository,
		runToolFn,
		server,
	});
	server.registerTool(
		"item_detail",
		{
			description:
				"Read the project revision and simplified identity, Editor draft status, UI mode, and storage detail of one item in the open project. Use this lightweight revision before create_item_line.",
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
				"Read the complete canonical JSON configuration of one item and its project revision. Use this before replacing structured fields through edit_item, preserve every unchanged nested value, and copy revision into the write request. Use item_line_config for one production line.",
			inputSchema: ItemConfigInputSchema,
		},
		async ({ itemId }) =>
			runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) => readItemConfigTextFx(project, itemId)),
				),
			),
	);
	server.registerTool(
		"item_configs",
		{
			description:
				"Read complete canonical JSON configurations for up to 50 unique item IDs from one project snapshot. Returns revision, items in first-request order, and missingItemIds. Duplicate IDs appear once. Copy revision into subsequent write requests.",
			inputSchema: ItemConfigsInputSchema,
			annotations: {
				readOnlyHint: true,
			},
		},
		async ({ itemIds }) =>
			runToolFn(
				readProjectFx().pipe(
					Effect.map((project) => readItemConfigsTextFn(project, itemIds)),
				),
			),
	);
	server.registerTool(
		"item_lines",
		{
			description:
				"Read a compact JSON list of an item's lines in authored order with the project revision. Includes ID, title, default, clock, clockWeight, show and enable; these are authored values, not evaluated gameplay availability. Use item_line_configs to fetch selected complete lines.",
			inputSchema: ItemLinesInputSchema,
			annotations: {
				readOnlyHint: true,
			},
		},
		async ({ itemId }) =>
			runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) => readItemLinesTextFx(project, itemId)),
				),
			),
	);
	server.registerTool(
		"item_line_configs",
		{
			description:
				"Read complete canonical JSON configurations for up to 50 unique item and line pairs from one snapshot. Returns revision, lines in first-request order, and issues with item-not-found, line-not-found or ambiguous-line reasons. Duplicate pairs appear once. Copy revision into subsequent write requests.",
			inputSchema: ItemLineConfigsInputSchema,
			annotations: {
				readOnlyHint: true,
			},
		},
		async ({ lines }) =>
			runToolFn(
				readProjectFx().pipe(
					Effect.map((project) => readItemLineConfigsTextFn(project, lines)),
				),
			),
	);
	server.registerTool(
		"item_line_config",
		{
			description:
				"Read the complete canonical JSON configuration of one production line and its project revision. Use this immediately before replace_item_line and copy the revision and every unchanged line value into the replacement request.",
			inputSchema: ItemLineConfigInputSchema,
		},
		async ({ itemId, lineId }) =>
			runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) => readItemLineConfigTextFx(project, itemId, lineId)),
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
						? "Read where one item is used as an input. Level 1 returns every operation that directly uses it; higher levels repeat input lookup from each reached operation owner. Every operation lists its owner, Runtime when authored, Inputs, and all possible Outputs. Use detail=summary for compact operations with authored gates and output odds; omitted detail or full retains detailed dependency witnesses."
						: "Read where one item is produced as an output. Level 1 returns every operation that directly produces it; higher levels repeat output lookup from each reached operation owner. Every operation lists its owner, Runtime when authored, Inputs, and all possible Outputs. Use detail=summary for compact operations with authored gates and output odds; omitted detail or full retains detailed dependency witnesses.",
				inputSchema: itemRelationInputSchema(role),
			},
			async ({ itemId, level, detail }) =>
				runToolFn(
					readProjectFx().pipe(
						Effect.flatMap((project) =>
							readItemRelationTextFx(project, {
								itemId,
								level,
								detail,
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
				"Approximate one item against the authored dependency graph. The estimator uses bounded per-output and correlated joint-output distributions to compute expected first-hitting time, ranks complete quantity-aware routes with stable route-ID ties, and times the selected-fact witness as an optimistic parallel critical path. Demand uses the larger of additive consumption and each selected route's simultaneous consumed-plus-reusable need; finite authored roots and jointly selected co-products are shared. Unsupported bounded state space returns partial. Runtime rule truth, concrete item identity packing, placement, renewable capacity, and engine execution are not simulated. Use detail=summary for totals and every requirement without the selected fact DAG; omitted detail or full retains the full diagnostic presentation.",
			inputSchema: ItemEstimateInputSchema,
		},
		async ({ itemId, quantity, detail }) =>
			runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) =>
						readItemEstimateTextFx(project, itemId, quantity, detail),
					),
				),
			),
	);
	server.registerTool(
		"item_chain",
		{
			description:
				"Explore what one item can turn into through its own directional merges and Clock. Returns the same bounded projection as Item → Chain, as readable text. Summary keeps starting operations, their immediate branches and all outcome states; full (default) includes the complete Details tree: intermediate items, operation owners, merge/line identities, per-operation times and quantities, weighted output sets, guaranteed and chance groups, conditions and termination states. maxDepth defaults to 5 (the Editor default), with a range of 1–12. Cycle detection and the 400-expansion safety budget apply to both detail levels. Only the root's merges initiate interaction; subsequent steps follow Clock expiry and Clock-selected line outputs. Reverse/intermediate merges, other production lines and production input acquisition are excluded. No-Clock items terminate branches. This is authored possibility analysis, not runtime simulation or accumulated periodic yield. Use item_input/item_output for general relations and item_estimate for acquisition planning.",
			inputSchema: ItemChainInputSchema,
			annotations: {
				readOnlyHint: true,
			},
		},
		async ({ itemId, detail, maxDepth }) =>
			runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) =>
						readItemChainTextFx(project, itemId, detail, maxDepth),
					),
				),
			),
	);
	return server;
};

/** Creates the synchronous server factory required by the MCP HTTP handler. */
export const createServerFx = Effect.fn("createServerFx")(
	({
		notifyProjectChangedFn,
		readProjectContextFn,
		repository,
		runPromiseFn,
	}: {
		readonly notifyProjectChangedFn: (projectId: string) => void;
		readonly readProjectContextFn: () => string | undefined;
		readonly repository: ProjectRepositoryService;

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
					runPromiseFn,
				),
		} as const),
);
