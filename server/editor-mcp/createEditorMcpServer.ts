import { McpServer } from "@modelcontextprotocol/server";
import { Effect } from "effect";
import { z } from "zod";

import { ArkiniAppVersion } from "../../shared/ArkiniAppMetadata";
import type { EditorProject } from "../../src/editor/EditorProject";
import type { EditorProjectRepositoryService } from "../../src/editor/EditorProjectRepository";
import {
	readEditorItemOriginRelationSubgraph,
	readEditorItemOriginSources,
	type EditorItemOriginOutputOccurrence,
	type EditorItemOriginRelationRole,
	type EditorItemOriginSource,
} from "../../src/editor/EditorItemOriginSource";
import { searchEditorItems } from "../../src/editor/searchEditorItems";
import { IdSchema } from "../../src/engine/common/schema/IdSchema";
import { ItemEnumSchema } from "../../src/engine/item/schema/ItemEnumSchema";

const avatarResourceIds = (project: EditorProject) =>
	Object.entries(project.config.resources)
		.filter(([role]) => role.startsWith("avatar-"))
		.map(([, resourceId]) => resourceId);

const projectText = (project: EditorProject) =>
	[
		`Title: ${project.title}`,
		`Project ID: ${project.projectId}`,
		`Game ID: ${project.config.meta.id}`,
		`Config version: ${project.game}`,
		`Revision: ${project.revision}`,
		`Board: ${project.config.meta.board.width} × ${project.config.meta.board.height}`,
		`Toolbar: ${project.config.meta.toolbarSize === undefined || project.config.meta.toolbarSize === 0 ? "disabled" : `${project.config.meta.toolbarSize} slots`}`,
		`Inventory: ${project.config.meta.inventory.width} × ${project.config.meta.inventory.height}`,
		`Hero asset: ${project.config.resources.hero}`,
		...(avatarResourceIds(project).length === 0
			? []
			: [
					`About avatars: ${avatarResourceIds(project).join(", ")}`,
				]),
		`Items: ${Object.keys(project.config.items).length}`,
		`Resources: ${project.resources.length}`,
	].join("\n");

const indentText = (value: string, indentation = "    ") =>
	value
		.split("\n")
		.map((line) => `${indentation}${line}`)
		.join("\n");

const readItemCollectionPage = (
	project: EditorProject,
	{
		itemTypes,
		page,
		pageSize,
		query,
	}: {
		readonly itemTypes?: ReadonlyArray<ItemEnumSchema.Type>;
		readonly page: number;
		readonly pageSize: number;
		readonly query?: string;
	},
) => {
	const items = Object.values(project.config.items).sort((left, right) =>
		left.title.localeCompare(right.title),
	);
	const allowedTypes = itemTypes === undefined ? undefined : new Set(itemTypes);
	const typeFilteredItems =
		allowedTypes === undefined ? items : items.filter((item) => allowedTypes.has(item.type));
	const matches =
		query === undefined ? typeFilteredItems : searchEditorItems(typeFilteredItems, query);
	const totalPages = Math.ceil(matches.length / pageSize);
	const pageItems = matches.slice((page - 1) * pageSize, page * pageSize);
	const hasPreviousPage = page > 1;
	const hasNextPage = page * pageSize < matches.length;
	return {
		hasNextPage,
		hasPreviousPage,
		items: pageItems,
		itemTypes,
		matchedItems: matches.length,
		nextPage: hasNextPage ? page + 1 : undefined,
		page,
		pageSize,
		previousPage: hasPreviousPage ? page - 1 : undefined,
		projectItems: items.length,
		returnedItems: pageItems.length,
		totalPages,
		typeFilteredItems: typeFilteredItems.length,
	};
};

const itemCollectionText = (collection: ReturnType<typeof readItemCollectionPage>) => {
	const renderedItems = collection.items
		.map((item) =>
			[
				`- ${item.title}`,
				`  ID: ${item.id}`,
				`  Type: ${item.type}`,
				"  Description:",
				indentText(item.description),
			].join("\n"),
		)
		.join("\n\n");
	return [
		"Item collection",
		`Project items: ${collection.projectItems}`,
		...(collection.itemTypes === undefined
			? []
			: [
					`Item type filter (OR): ${collection.itemTypes.join(", ")}`,
				]),
		`Type-filtered items: ${collection.typeFilteredItems}`,
		`Matched items: ${collection.matchedItems}`,
		`Page: ${collection.page}`,
		`Total pages: ${collection.totalPages}`,
		`Page size: ${collection.pageSize}`,
		`Returned items: ${collection.returnedItems}`,
		`Has previous page: ${collection.hasPreviousPage}`,
		`Has next page: ${collection.hasNextPage}`,
		...(collection.previousPage === undefined
			? []
			: [
					`Previous page: ${collection.previousPage}`,
				]),
		...(collection.nextPage === undefined
			? []
			: [
					`Next page: ${collection.nextPage}`,
				]),
		"",
		"Items:",
		renderedItems || "- none",
	].join("\n");
};

const itemMetaText = (project: EditorProject) => {
	const counts = new Map<string, number>();
	for (const item of Object.values(project.config.items))
		counts.set(item.type, (counts.get(item.type) ?? 0) + 1);
	return [
		`Total: ${Object.keys(project.config.items).length}`,
		...[
			...counts.entries(),
		]
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([type, count]) => `${type}: ${count}`),
	].join("\n");
};

const itemDetailText = (item: EditorProject["config"]["items"][string]) =>
	[
		`Item: ${item.title}`,
		`ID: ${item.id}`,
		`UID: ${item.uid}`,
		`Type: ${item.type}`,
		"Description:",
		indentText(item.description, "  "),
		`Storage: ${item.scope}`,
		`Stack capacity: ${item.maxStackSize}`,
		...(item.maxCount === undefined
			? []
			: [
					`Game limit: ${item.maxCount}`,
				]),
	].join("\n");

const itemReference = (project: EditorProject, itemId: string) => {
	const item = project.config.items[itemId];
	return item === undefined ? `${itemId} [missing]` : `${item.id} [${item.title}; ${item.type}]`;
};

const outputAnnotation = (output: EditorItemOriginOutputOccurrence) =>
	[
		output.selectionKind,
		...(output.weightedSet
			? [
					"alternative set",
				]
			: []),
		...(output.placement === undefined
			? []
			: [
					`placement ${output.placement}`,
				]),
	].join(", ");

const readItemRelationView = (
	project: EditorProject,
	{
		itemId,
		level,
		role,
	}: {
		readonly itemId: string;
		readonly level: number;
		readonly role: EditorItemOriginRelationRole;
	},
) => {
	if (project.config.items[itemId] === undefined)
		throw new Error(`Item ${itemId} does not exist in the open project.`);
	const sources = Object.values(project.config.items)
		.sort((left, right) => left.id.localeCompare(right.id))
		.flatMap(readEditorItemOriginSources)
		.sort((left, right) => left.id.localeCompare(right.id));
	return {
		itemId,
		level,
		project,
		role,
		subgraph: readEditorItemOriginRelationSubgraph({
			level,
			role,
			sources,
			targetItemId: itemId,
		}),
	};
};

type ItemRelationView = ReturnType<typeof readItemRelationView>;

const sourceReferenceLines = (project: EditorProject, source: EditorItemOriginSource) => [
	`  source item: ${itemReference(project, source.ownerItemId)}`,
	...(() => {
		switch (source.reference.type) {
			case "line":
				return [
					`  line: ${source.reference.lineId}`,
				];
			case "charges":
				return [
					"  relationship: charge depletion",
				];
			case "expiry":
				return [
					"  relationship: expiry",
				];
			case "merge":
				return [
					`  merge rule: ${source.reference.ruleNumber}`,
				];
		}
	})(),
];

const sourceMetadata = (source: EditorItemOriginSource) => ({
	kind: source.kind,
	label: source.label,
	sourceItemId: source.ownerItemId,
	...source.reference,
});

const itemRelationText = ({ itemId, level, project, role, subgraph }: ItemRelationView) => {
	const groups = new Map<
		string,
		{
			readonly level: number;
			readonly relations: typeof subgraph.relations;
		}
	>();
	for (const relation of subgraph.relations) {
		const key = `${relation.level}:${relation.source.id}`;
		const group = groups.get(key);
		groups.set(key, {
			level: relation.level,
			relations:
				group === undefined
					? [
							relation,
						]
					: [
							...group.relations,
							relation,
						],
		});
	}
	const reachedItemIds = [
		...subgraph.itemIds,
	]
		.filter((candidate) => candidate !== itemId)
		.sort((left, right) => left.localeCompare(right));
	return [
		`${role === "input" ? "Item input" : "Item output"} relationships for ${itemReference(project, itemId)}`,
		`Depth: ${level} relationship ${level === 1 ? "hop" : "hops"}`,
		role === "input"
			? "Direction: external input item -> operation owner. Owner self-requirements are not editor-flow input edges."
			: "Lookup direction: produced item <- operation owner. Relationships are printed canonically as owner -> output; guaranteed, chance, weighted, replacement, depletion, and expiry outputs all use the editor-flow model.",
		"",
		"Reading guide:",
		"- level: relationship-hop distance from the requested item; level 1 is a direct relationship.",
		role === "input"
			? "- traversed: the matched external-input edge, printed as input item -> source item."
			: "- traversed: the matched output edge, printed canonically as source item -> produced item.",
		"- source item: the item that owns and runs the listed operation.",
		"- line / merge rule / relationship: the authored operation reference inside the source item.",
		"- external inputs: every item required by the operation except the source item itself.",
		"- outputs: every possible item emitted by the operation, not only the edge matched by this lookup.",
		"- output annotations: guaranteed/chance/weighted/replace describe selection; alternative set means mutually weighted sets; placement describes where the item appears.",
		"",
		"Reached items:",
		...(reachedItemIds.length === 0
			? [
					"- none",
				]
			: reachedItemIds.map((reachedItemId) => `- ${itemReference(project, reachedItemId)}`)),
		"",
		"Operations:",
		...(groups.size === 0
			? [
					"- none",
				]
			: [
					...groups.values(),
				].flatMap((group) => {
					const source = group.relations[0]?.source;
					if (source === undefined) return [];
					const inputs = [
						...new Set(source.requirementItemIds),
					]
						.filter((requirementItemId) => requirementItemId !== source.ownerItemId)
						.sort((left, right) => left.localeCompare(right));
					return [
						`- level ${group.level}: ${source.kind} "${source.label}"`,
						...sourceReferenceLines(project, source),
						"  traversed:",
						...group.relations.map(
							(relation) =>
								`    - ${itemReference(project, relation.fromItemId)} -> ${itemReference(project, relation.toItemId)}`,
						),
						...(inputs.length === 0
							? [
									"  external inputs: none",
								]
							: [
									"  external inputs:",
									...inputs.map(
										(inputItemId) =>
											`    - ${itemReference(project, inputItemId)}`,
									),
								]),
						"  outputs:",
						...source.outputs.map(
							(output) =>
								`    - ${itemReference(project, output.itemId)} (${outputAnnotation(output)})`,
						),
					];
				})),
	].join("\n");
};

const itemRelationMetadata = ({ itemId, level, role, subgraph }: ItemRelationView) => ({
	itemId,
	level,
	operations: [
		...new Map(
			subgraph.relations.map(({ source }) => [
				source.id,
				sourceMetadata(source),
			]),
		).values(),
	],
	reachedItemIds: [
		...subgraph.itemIds,
	]
		.filter((candidate) => candidate !== itemId)
		.sort(),
	relationshipCount: subgraph.relations.length,
	role,
});

const errorText = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

const withProjectContext = <Value>(
	readProjectContext: () => string | undefined,
	run: (projectId: string) => Effect.Effect<Value, unknown>,
) =>
	Effect.try({
		try: () => {
			const projectId = readProjectContext();
			if (projectId === undefined)
				throw new Error(
					"No editor project is currently open. Open a project in Arkini before using editor tools.",
				);
			return projectId;
		},
		catch: (cause) => cause,
	}).pipe(Effect.flatMap(run));

const readCurrentProjectFx = (
	repository: EditorProjectRepositoryService,
	readProjectContext: () => string | undefined,
) =>
	withProjectContext(readProjectContext, (projectId) =>
		repository
			.readProjectFx(projectId)
			.pipe(
				Effect.flatMap((project) =>
					project === null
						? Effect.fail(
								new Error(`The open editor project ${projectId} no longer exists.`),
							)
						: Effect.succeed(project),
				),
			),
	);

const runTool = async <Value>(
	effect: Effect.Effect<Value, unknown>,
	format: (value: Value) => string,
	structured?: (value: Value) => Record<string, unknown>,
) => {
	try {
		const value = await Effect.runPromise(effect);
		return {
			content: [
				{
					type: "text" as const,
					text: format(value),
				},
			],
			...(structured === undefined
				? {}
				: {
						structuredContent: structured(value),
					}),
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

/** Builds one per-request MCP server scoped to the project currently visible in the editor. */
export const createEditorMcpServer = (
	repository: EditorProjectRepositoryService,
	readProjectContext: () => string | undefined,
) => {
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
	server.registerTool(
		"project",
		{
			description:
				"Summarize the project currently open in Arkini, including its identity, version, layouts, and collection sizes.",
		},
		async () => runTool(readCurrentProjectFx(repository, readProjectContext), projectText),
	);
	server.registerTool(
		"item_meta",
		{
			description: "Count items in the open project by their canonical item type.",
		},
		async () => runTool(readCurrentProjectFx(repository, readProjectContext), itemMetaText),
	);
	server.registerTool(
		"item_collection",
		{
			description:
				"List one page of items with collection metadata, title, ID, complete description, and type, optionally filtered by item types and the editor's fuzzy search.",
			inputSchema: z
				.object({
					itemTypes: ItemEnumSchema.array()
						.min(1)
						.optional()
						.describe(
							"Optional item types combined with OR; the fuzzy query is applied within this filtered set.",
						),
					page: z.number().int().min(1).default(1).describe("One-based page number."),
					pageSize: z
						.number()
						.int()
						.min(1)
						.max(100)
						.default(25)
						.describe("Items per page; defaults to 25 and is capped at 100."),
					query: z
						.string()
						.optional()
						.describe(
							"Optional fuzzy search across item title, ID, description, and type.",
						),
				})
				.strict(),
		},
		async ({ itemTypes, page, pageSize, query }) =>
			runTool(
				readCurrentProjectFx(repository, readProjectContext).pipe(
					Effect.map((project) =>
						readItemCollectionPage(project, {
							itemTypes,
							page,
							pageSize,
							query,
						}),
					),
				),
				itemCollectionText,
				({ items, ...metadata }) => ({
					...metadata,
					itemIds: items.map(({ id }) => id),
				}),
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
				readCurrentProjectFx(repository, readProjectContext).pipe(
					Effect.flatMap((project) => {
						const item = project.config.items[id];
						return item === undefined
							? Effect.fail(
									new Error(`Item ${id} does not exist in the open project.`),
								)
							: Effect.succeed(item);
					}),
				),
				itemDetailText,
			),
	);
	server.registerTool(
		"item_input",
		{
			description:
				"Follow editor-flow external-input relationships from one item. Level 1 returns operation owners that directly use the item; higher levels continue through owners used as inputs elsewhere.",
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
				readCurrentProjectFx(repository, readProjectContext).pipe(
					Effect.map((project) =>
						readItemRelationView(project, {
							itemId,
							level,
							role: "input",
						}),
					),
				),
				itemRelationText,
				itemRelationMetadata,
			),
	);
	server.registerTool(
		"item_output",
		{
			description:
				"Find every editor-flow operation that outputs one item. Level 1 returns all direct producer owners; higher levels continue backward through operations that output those producers.",
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
				readCurrentProjectFx(repository, readProjectContext).pipe(
					Effect.map((project) =>
						readItemRelationView(project, {
							itemId,
							level,
							role: "output",
						}),
					),
				),
				itemRelationText,
				itemRelationMetadata,
			),
	);
	return server;
};
