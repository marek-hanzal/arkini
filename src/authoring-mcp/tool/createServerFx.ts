import { registerGraphToolsFn } from "./registerGraphToolsFn";
import { formatVersionFn } from "~/game-version/fn/formatVersionFn";
import { McpServer } from "@modelcontextprotocol/server";
import { Effect } from "effect";
import { z } from "zod";

import { SerakkiAppVersion } from "~shared/SerakkiAppMetadata";
import type { Project } from "~/project-authoring/type/Project";
import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import { IdSchema } from "~/game-value/schema/IdSchema";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import { ArtworkCollectionInputSchema } from "./ArtworkCollectionInputSchema";
import { createProjectGraphFx } from "~/graph/fx/createProjectGraphFx";
import type { ProjectGraph } from "~/graph/type/ProjectGraph";
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
import { readItemCollectionTextFn } from "./fn/readItemCollectionTextFn";
import { readDraftFn } from "~/item-authoring/fn/readDraftFn";
import { readSchemaDetailTextFx, schemaDetailResolveDepthLimit } from "./readSchemaDetailTextFx";
import { registerGameplayDesignToolsFn } from "./registerGameplayDesignTools";
import { registerNoteToolsFn } from "./registerNoteTools";
import { registerTemplateToolsFn } from "./registerTemplateTools";
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
		itemUid: IdSchema.describe("The exact item UID returned by item_collection."),
	})
	.strict()
	.meta({
		$id: "urn:serakki:schema:mcp:item-detail-input",
		title: "Item detail tool input",
		description: "The identity of the item whose simplified detail is requested.",
	});

const ItemJsonInputSchema = z
	.object({
		itemUid: IdSchema.describe("The exact item UID returned by item_collection."),
	})
	.strict()
	.meta({
		$id: "urn:serakki:schema:mcp:item-json-input",
		title: "Item configuration tool input",
		description: "The identity of the item whose canonical configuration is requested.",
	});

const ItemLineJsonInputSchema = z
	.object({
		itemUid: IdSchema.describe("The exact item UID returned by item_collection."),
		lineUid: IdSchema.describe("The exact line UID returned by item_lines or item_json."),
	})
	.strict()
	.meta({
		$id: "urn:serakki:schema:mcp:item-line-json-input",
		title: "Item line configuration tool input",
		description: "The item and production-line identities whose canonical config is requested.",
	});

const ItemLinesInputSchema = z
	.object({
		itemUid: IdSchema,
	})
	.strict()
	.meta({
		$id: "urn:serakki:schema:mcp:item-lines-input",
		title: "Item line summaries tool input",
		description: "Read authored line identities and behavior in their existing order.",
	});

interface ItemLineReference {
	readonly itemUid: string;
	readonly lineUid: string;
}

const lineReferenceKeyFn = ({ itemUid, lineUid }: ItemLineReference) =>
	JSON.stringify([
		itemUid,
		lineUid,
	]);

const ItemLinesJsonInputSchema = z
	.object({
		lines: z
			.array(z.object(ItemLineJsonInputSchema.shape).strict())
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
		$id: "urn:serakki:schema:mcp:item-lines-json-input",
		title: "Item line configurations tool input",
		description: "Read canonical line configurations from one project snapshot and revision.",
	});

const ItemsJsonInputSchema = z
	.object({
		itemUids: z
			.array(IdSchema)
			.min(1)
			.refine(
				(itemUids) => new Set(itemUids).size <= 50,
				"Request at most 50 unique item UIDs.",
			)
			.describe(
				"Up to 50 unique item UIDs; duplicate IDs are read only once, in request order.",
			),
	})
	.strict()
	.meta({
		$id: "urn:serakki:schema:mcp:items-json-input",
		title: "Item configurations tool input",
		description: "Read canonical item configurations from one project snapshot and revision.",
	});

const SchemaJsonInputSchema = z
	.object({
		resolveDepth: z
			.number()
			.int()
			.min(0)
			.max(schemaDetailResolveDepthLimit)
			.default(0)
			.describe(
				"Registered $ref expansion depth, 0–2. Zero preserves references; cycles and references at the depth limit remain unresolved.",
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
		$id: "urn:serakki:schema:mcp:schema-json-input",
		title: "Schema detail tool input",
		description: "The exact registered schema identity to read.",
	});

const errorTextFn = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

const readProjectTextFn = (project: Project) => {
	const avatarResourceUids = Object.entries(project.config.resources)
		.filter(([role]) => role.startsWith("avatar-"))
		.map(([, resourceUid]) => resourceUid);
	return [
		`Title: ${project.title}`,
		`Project ID: ${project.projectId}`,
		`Game ID: ${project.config.meta.id}`,
		`Serapack version: ${formatVersionFn(project.version)}`,
		`Revision: ${project.revision}`,
		`Board: ${project.config.meta.board.width} × ${project.config.meta.board.height}`,
		`Hero artwork: ${project.config.resources.hero}`,
		...(avatarResourceUids.length === 0
			? []
			: [
					`About avatars: ${avatarResourceUids.join(", ")}`,
				]),
		`Items: ${Object.keys(project.config.items).length}`,
		`Resources: ${project.resources.length}`,
		`Templates: ${project.config.templates?.length ?? 0} (template_collection)`,
	].join("\n");
};

const readItemMetaTextFn = (project: Project) =>
	[
		`Project ID: ${project.projectId}`,
		`Revision: ${project.revision}`,
		`Total: ${Object.keys(project.config.items).length}`,
	].join("\n");

/** Admit exact stored identities before any single-item projection. */
const readItemFx = Effect.fn("readMcpItemFx")(function* (project: Project, itemUid: string) {
	if (!Object.hasOwn(project.config.items, itemUid))
		return yield* Effect.fail(new Error(`Item ${itemUid} does not exist in the open project.`));
	return project.config.items[itemUid]!;
});

const readItemDetailTextFx = Effect.fn("readItemDetailTextFx")(
	(project: Project, itemUid: string) =>
		Effect.gen(function* () {
			const item = yield* readItemFx(project, itemUid);
			return [
				`Item: ${item.title}`,
				`Revision: ${project.revision}`,
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

const readItemJsonFx = Effect.fn("readItemJsonFx")((project: Project, itemUid: string) =>
	Effect.gen(function* () {
		const item = yield* readItemFx(project, itemUid);
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

const readItemLineJsonFx = Effect.fn("readItemLineJsonFx")(
	(project: Project, itemUid: string, lineUid: string) =>
		Effect.gen(function* () {
			const item = yield* readItemFx(project, itemUid);
			const line = item.lines.find(({ uid }) => uid === lineUid);
			if (line === undefined)
				return yield* Effect.fail(
					new Error(`Line ${lineUid} does not exist on item ${itemUid}.`),
				);
			return JSON.stringify(
				{
					revision: project.revision,
					itemUid,
					line,
				},
				null,
				2,
			);
		}),
);

const readItemLinesTextFx = Effect.fn("readItemLinesTextFx")((project: Project, itemUid: string) =>
	Effect.gen(function* () {
		const item = yield* readItemFx(project, itemUid);
		return [
			`Project ID: ${project.projectId}`,
			`Revision: ${project.revision}`,
			`Item: ${JSON.stringify(item.title)} [item:${JSON.stringify(item.uid)}]`,
			...(item.lines.length === 0
				? [
						"No authored lines.",
					]
				: [
						`Lines (${item.lines.length}, authored order):`,
						...item.lines.map((line) =>
							[
								`- ${JSON.stringify(line.title)} [line:${JSON.stringify(line.uid)}]`,
								`  Default: ${line.default}; Clock: ${line.clock === true}; Clock weight: ${line.clockWeight}; Show: ${line.show}; Enable: ${line.enable}`,
							].join("\n"),
						),
					]),
		].join("\n");
	}),
);

const readItemLinesJsonFn = (project: Project, references: ReadonlyArray<ItemLineReference>) => {
	const seen = new Set<string>();
	const lines: Array<{
		itemUid: string;
		line: LineSchema.Type;
	}> = [];
	const issues: Array<
		ItemLineReference & {
			reason: "item-not-found" | "line-not-found";
		}
	> = [];
	for (const reference of references) {
		const key = lineReferenceKeyFn(reference);
		if (seen.has(key)) continue;
		seen.add(key);
		const item = Object.hasOwn(project.config.items, reference.itemUid)
			? project.config.items[reference.itemUid]
			: undefined;
		if (item === undefined) {
			issues.push({
				...reference,
				reason: "item-not-found",
			});
			continue;
		}
		const line = item.lines.find(({ uid }) => uid === reference.lineUid);
		if (line === undefined) {
			issues.push({
				...reference,
				reason: "line-not-found",
			});
			continue;
		}
		lines.push({
			itemUid: reference.itemUid,
			line,
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

const readItemsJsonFn = (project: Project, itemUids: ReadonlyArray<string>) => {
	const uniqueItemUids = [
		...new Set(itemUids),
	];
	return JSON.stringify(
		{
			revision: project.revision,
			items: uniqueItemUids.flatMap((itemUid) => {
				const item = Object.hasOwn(project.config.items, itemUid)
					? project.config.items[itemUid]
					: undefined;
				return item === undefined
					? []
					: [
							item,
						];
			}),
			missingItemUids: uniqueItemUids.filter(
				(itemUid) => !Object.hasOwn(project.config.items, itemUid),
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
	graph: ProjectGraph,
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
				"Every project tool targets only the project currently open in the Serakki editor. Tools without a format suffix return concise formatted text. Tools ending in _json return one valid JSON document; plural names hold multiple results with shared metadata. No JSONL tools are exposed. Structurally large create and edit inputs are serialized JSON strings: retrieve the exact schema named by their tool description through schema_json with optional resolveDepth (0–2) to inline registered references. Remaining $refs can be read through schema_json again. Create and edit tools persist canonical saved editor state. For board templates, start with template_collection, then template_detail (text) or template_json (canonical JSON); use focused template mutations instead of replacing the project templates array.",
		},
	);
	const readProjectFx = () => readCurrentProjectFx(repository, readProjectContextFn);
	server.registerTool(
		"schema_json",
		{
			description:
				"Read one JSON Schema by its exact case-sensitive Zod registry ID. Optional resolveDepth (integer 0–2, default 0) expands that many registered $ref edges, independently in each branch. Cycles, unknown references and references at the depth limit remain as $ref. Local fragment references in embedded schemas retain their original resource ID. Depth limits nesting, not total response size. This tool does not require an open project.",
			inputSchema: SchemaJsonInputSchema,
		},
		async ({ id, resolveDepth }) => runToolFn(readSchemaDetailTextFx(id, resolveDepth)),
	);
	{
		const schemaId = resolveSchemaId(CreateItemInputSchema);
		server.registerTool(
			"create_item",
			{
				description: `Create and persist one item in the open project with generated item and line UIDs. Supplied lines omit uid. Pass input as a serialized JSON object matching schema ${JSON.stringify(schemaId)}; retrieve it and each returned $ref through schema_json. Omitted fields use the same defaults as a new item form in the Editor UI.`,
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
				description: `Patch one existing item. Pass input as a serialized JSON object matching schema ${JSON.stringify(schemaId)}; retrieve it and each returned $ref through schema_json. Supplied top-level fields replace their complete values, omitted fields remain unchanged, and null clears optional fields. Before replacing a structured field such as artwork, units, merge, lines, outcome, or nested rolls, read item_json and copy its revision into this request.`,
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
				"Append one complete production line without resending the item's other lines. Read item_detail or item_lines first and copy its project revision. Supply the complete line according to the input schema. A fresh immutable UID is generated; omit uid in the authoring value.",
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
				"Replace one existing production line without resending the item's other lines. Read item_line_json first and copy its revision. Supply the complete line according to the input schema; omitted optional values are removed, and the target line UID is retained. Omit uid in the authoring value. Its position is preserved.",
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
				"Delete exactly one production line. Read item_line_json first and copy its revision. Missing line UIDs are rejected; all other item values and line order are preserved.",
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
				description: `${description} Pass input as a serialized JSON object matching schema ${JSON.stringify(resolveSchemaId(schema))}; retrieve it and each returned $ref through schema_json.`,
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
			description: `Apply 1–20 create, replace or delete line operations across items with one project revision. Each item/line pair may appear once. Create appends a line with a generated UID; supplied create/replace line objects omit uid. Replace preserves position and the addressed line UID; delete removes exactly one line. Complete replacements use the same schema as replace_item_line. All operations and resulting items are validated before one best-effort repository commit; invalid input or stale revision writes nothing. Returns a new revision and an operation summary. Pass input as serialized JSON matching schema ${JSON.stringify(resolveSchemaId(EditItemLinesInputSchema))}; retrieve it and each $ref through schema_json.`,
			inputSchema: JsonToolInputSchema,
		},
		async ({ input }) =>
			runToolFn(
				Effect.gen(function* () {
					const decoded = yield* parseToolInputJsonFx(input, EditItemLinesInputSchema);
					const project = yield* readProjectFx();
					const { commit, operations } = yield* editLinesFx({
						...decoded,
						project,
						repository,
					});
					yield* notifyProjectChangedFx(notifyProjectChangedFn, project.projectId);
					return [
						`Edited ${decoded.operations.length} item lines.`,
						`Revision: ${commit.revision}`,
						...operations.map(
							(operation, index) =>
								`${index + 1}. ${operation.operation}: ${operation.itemUid} / ${operation.operation === "create" ? operation.line.uid : operation.lineUid}`,
						),
					].join("\n");
				}),
			),
	);

	server.registerTool(
		"item_line_order",
		{
			description:
				"Reorder an item's existing production lines. Supply every line UID exactly once in the desired order and the revision from item_json or items_json. Missing, unknown or duplicate IDs are rejected without changing the project. Only order changes; line values and all other item fields are preserved.",
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
						`Item UID: ${input.itemUid}`,
						`Line UIDs: ${input.lineUids.join(", ")}`,
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
	registerTemplateToolsFn({
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
		async ({ itemUid }) =>
			runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) => readItemDetailTextFx(project, itemUid)),
				),
			),
	);
	server.registerTool(
		"item_json",
		{
			description:
				"Read the complete canonical JSON configuration of one item and its project revision. Use this before replacing structured fields through edit_item, preserve every unchanged nested value, and copy revision into the write request. Use item_line_json for one production line.",
			inputSchema: ItemJsonInputSchema,
		},
		async ({ itemUid }) =>
			runToolFn(
				readProjectFx().pipe(Effect.flatMap((project) => readItemJsonFx(project, itemUid))),
			),
	);
	server.registerTool(
		"items_json",
		{
			description:
				"Read complete canonical JSON configurations for up to 50 unique item UIDs from one project snapshot. Returns revision, items in first-request order, and missingItemUids. Duplicate IDs appear once. Copy revision into subsequent write requests.",
			inputSchema: ItemsJsonInputSchema,
			annotations: {
				readOnlyHint: true,
			},
		},
		async ({ itemUids }) =>
			runToolFn(
				readProjectFx().pipe(Effect.map((project) => readItemsJsonFn(project, itemUids))),
			),
	);
	server.registerTool(
		"item_lines",
		{
			description:
				"Read a compact text list of an item's lines in authored order with the project revision. Includes UID, title, default, clock, clockWeight, show and enable; these are authored values, not evaluated gameplay availability. Use item_lines_json to fetch selected complete lines.",
			inputSchema: ItemLinesInputSchema,
			annotations: {
				readOnlyHint: true,
			},
		},
		async ({ itemUid }) =>
			runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) => readItemLinesTextFx(project, itemUid)),
				),
			),
	);
	server.registerTool(
		"item_lines_json",
		{
			description:
				"Read complete canonical JSON configurations for up to 50 unique item and line pairs from one snapshot. Returns revision, lines in first-request order, and issues with item-not-found or line-not-found reasons. Duplicate pairs appear once. Copy revision into subsequent write requests.",
			inputSchema: ItemLinesJsonInputSchema,
			annotations: {
				readOnlyHint: true,
			},
		},
		async ({ lines }) =>
			runToolFn(
				readProjectFx().pipe(Effect.map((project) => readItemLinesJsonFn(project, lines))),
			),
	);
	server.registerTool(
		"item_line_json",
		{
			description:
				"Read the complete canonical JSON configuration of one production line and its project revision. Use this immediately before replace_item_line and copy the revision and every unchanged authoring value into the replacement request, omitting the immutable uid from the line object.",
			inputSchema: ItemLineJsonInputSchema,
		},
		async ({ itemUid, lineUid }) =>
			runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) => readItemLineJsonFx(project, itemUid, lineUid)),
				),
			),
	);
	registerGraphToolsFn({
		server,
		graph,
		readProjectFx,
		runToolFn,
	});
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
		Effect.map(
			createProjectGraphFx(),
			(graph) =>
				({
					create: () =>
						createServerFn(
							graph,
							notifyProjectChangedFn,
							repository,
							readProjectContextFn,
							runPromiseFn,
						),
				}) as const,
		),
);
