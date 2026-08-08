import Dexie, { type DexieOptions, type Table } from "dexie";
import { Clock, Effect, Semaphore } from "effect";

import type { EditorProject, EditorProjectCommit } from "~/bridge/editor/EditorProject";
import {
	EditorProjectRecordSchema,
	type EditorProjectRecordSchema as EditorProjectRecordSchemaType,
} from "~/bridge/editor/EditorProjectRecordSchema";
import type { EditorProjectRepositoryService } from "~/bridge/editor/EditorProjectRepository";
import {
	EditorProjectRepositoryError,
	type EditorProjectRepositoryOperation,
} from "~/bridge/editor/EditorProjectRepositoryError";
import {
	EditorProjectResourceRecordSchema,
	type EditorProjectResourceRecordSchema as EditorProjectResourceRecordSchemaType,
} from "~/bridge/editor/EditorProjectResourceRecordSchema";
import { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { ResourceSchema } from "~/engine/pack/schema/ResourceSchema";

const databaseName = "arkini-editor";
const stores = {
	projects: "&projectId, updatedAtMs",
	resources: "&[projectId+id], projectId",
};

const createRepositoryError = (
	operation: EditorProjectRepositoryOperation,
	message: string,
	cause?: unknown,
) =>
	cause instanceof EditorProjectRepositoryError
		? cause
		: new EditorProjectRepositoryError({
				operation,
				message,
				...(cause === undefined
					? {}
					: {
							cause,
						}),
			});

const parseProjectRecord = (candidate: unknown, operation: EditorProjectRepositoryOperation) => {
	const result = EditorProjectRecordSchema.safeParse(candidate);
	if (result.success) return result.data;
	throw createRepositoryError(
		operation,
		"IndexedDB contains an invalid editor project record.",
		result.error,
	);
};

const parseResourceRecords = (
	candidates: ReadonlyArray<unknown>,
	operation: EditorProjectRepositoryOperation,
) => {
	const result = EditorProjectResourceRecordSchema.array().safeParse(candidates);
	if (result.success) return result.data;
	throw createRepositoryError(
		operation,
		"IndexedDB contains an invalid editor project resource record.",
		result.error,
	);
};

const materializeProject = (
	record: EditorProjectRecordSchemaType.Type,
	resources: ReadonlyArray<EditorProjectResourceRecordSchemaType.Type>,
): EditorProject => ({
	projectId: record.projectId,
	title: record.config.meta.title,
	game: record.config.version,
	createdAtMs: record.createdAtMs,
	updatedAtMs: record.updatedAtMs,
	revision: record.revision,
	config: record.config,
	resources: resources
		.map(({ id, mime, bytes }) => ({
			id,
			mime,
			bytes,
		}))
		.sort((left, right) => left.id.localeCompare(right.id)),
});

const materializeProjectCommit = (
	record: EditorProjectRecordSchemaType.Type,
): EditorProjectCommit => ({
	projectId: record.projectId,
	title: record.config.meta.title,
	game: record.config.version,
	createdAtMs: record.createdAtMs,
	updatedAtMs: record.updatedAtMs,
	revision: record.revision,
	config: record.config,
});

export namespace createIndexedDbEditorProjectRepositoryFx {
	export interface Props {
		readonly databaseName?: string;
		readonly indexedDB?: DexieOptions["indexedDB"];
		readonly IDBKeyRange?: DexieOptions["IDBKeyRange"];
	}
}

/** Acquires one scoped Dexie authority over the canonical editor project database. */
export const createIndexedDbEditorProjectRepositoryFx = Effect.fn(
	"createIndexedDbEditorProjectRepositoryFx",
)(function* ({
	databaseName: providedDatabaseName = databaseName,
	indexedDB,
	IDBKeyRange,
}: createIndexedDbEditorProjectRepositoryFx.Props = {}) {
	const database = new Dexie(providedDatabaseName, {
		...(indexedDB === undefined
			? {}
			: {
					indexedDB,
				}),
		...(IDBKeyRange === undefined
			? {}
			: {
					IDBKeyRange,
				}),
	});
	database.version(1).stores(stores);
	database
		.version(2)
		.stores(stores)
		.upgrade(async (transaction) => {
			await transaction.table("resources").clear();
			await transaction.table("projects").clear();
		});
	const projects = database.table<EditorProjectRecordSchemaType.Type, string>("projects");
	const resources = database.table<
		EditorProjectResourceRecordSchemaType.Type,
		[
			string,
			string,
		]
	>("resources");
	const writeLock = yield* Semaphore.make(1);

	yield* Effect.acquireRelease(
		Effect.sync(() => database),
		() => Effect.sync(() => database.close()),
	);

	const readMaterializedProject = async (
		projectTable: Table<EditorProjectRecordSchemaType.Type, string>,
		resourceTable: Table<
			EditorProjectResourceRecordSchemaType.Type,
			[
				string,
				string,
			]
		>,
		projectId: string,
		operation: EditorProjectRepositoryOperation,
	) => {
		const candidate = await projectTable.get(projectId);
		if (candidate === undefined) return null;
		const record = parseProjectRecord(candidate, operation);
		const resourceRecords = parseResourceRecords(
			await resourceTable.where("projectId").equals(projectId).toArray(),
			operation,
		);
		return materializeProject(record, resourceRecords);
	};

	const createProjectFx: EditorProjectRepositoryService["createProjectFx"] = Effect.fn(
		"IndexedDbEditorProjectRepository.createProjectFx",
	)(function* ({ projectId, config: candidateConfig, resources: candidateResources }) {
		const config = yield* Effect.try({
			try: () => GameConfigSchema.parse(candidateConfig),
			catch: (cause) =>
				createRepositoryError(
					"create-project",
					"The editor project config is invalid.",
					cause,
				),
		});
		const parsedResources = yield* Effect.try({
			try: () => ResourceSchema.array().parse(candidateResources),
			catch: (cause) =>
				createRepositoryError(
					"create-project",
					"The editor project resources are invalid.",
					cause,
				),
		});
		const nowMs = yield* Clock.currentTimeMillis;
		return yield* writeLock.withPermits(1)(
			Effect.tryPromise({
				try: () =>
					database.transaction("rw", projects, resources, async () => {
						if ((await projects.get(projectId)) !== undefined) {
							throw createRepositoryError(
								"create-project",
								`Editor project ${projectId} already exists.`,
							);
						}
						const record = parseProjectRecord(
							{
								projectId,
								config,
								revision: 0,
								createdAtMs: nowMs,
								updatedAtMs: nowMs,
							},
							"create-project",
						);
						const resourceRecords = parseResourceRecords(
							parsedResources.map((resource) => ({
								projectId,
								...resource,
							})),
							"create-project",
						);
						await projects.add(record);
						if (resourceRecords.length > 0) await resources.bulkAdd(resourceRecords);
						return materializeProject(record, resourceRecords);
					}),
				catch: (cause) =>
					createRepositoryError(
						"create-project",
						`Editor project ${projectId} could not be created.`,
						cause,
					),
			}).pipe(Effect.uninterruptible),
		);
	});

	const listProjectsFx: EditorProjectRepositoryService["listProjectsFx"] = Effect.tryPromise({
		try: async () => {
			const records = await projects.orderBy("updatedAtMs").reverse().toArray();
			return records
				.map((candidate) => {
					const record = parseProjectRecord(candidate, "list-projects");
					return {
						projectId: record.projectId,
						title: record.config.meta.title,
						game: record.config.version,
						createdAtMs: record.createdAtMs,
						updatedAtMs: record.updatedAtMs,
					};
				})
				.sort(
					(left, right) =>
						right.updatedAtMs - left.updatedAtMs ||
						left.projectId.localeCompare(right.projectId),
				);
		},
		catch: (cause) =>
			createRepositoryError("list-projects", "Editor projects could not be listed.", cause),
	});

	const readProjectFx: EditorProjectRepositoryService["readProjectFx"] = Effect.fn(
		"IndexedDbEditorProjectRepository.readProjectFx",
	)((projectId) =>
		Effect.tryPromise({
			try: () =>
				database.transaction("r", projects, resources, () =>
					readMaterializedProject(projects, resources, projectId, "read-project"),
				),
			catch: (cause) =>
				createRepositoryError(
					"read-project",
					`Editor project ${projectId} could not be read.`,
					cause,
				),
		}),
	);

	const upsertItemFx: EditorProjectRepositoryService["upsertItemFx"] = Effect.fn(
		"IndexedDbEditorProjectRepository.upsertItemFx",
	)(function* ({ projectId, item: candidateItem }) {
		const item = yield* Effect.try({
			try: () => ItemSchema.parse(candidateItem),
			catch: (cause) =>
				createRepositoryError("upsert-item", "The editor item is invalid.", cause),
		});
		const nowMs = yield* Clock.currentTimeMillis;
		return yield* writeLock.withPermits(1)(
			Effect.tryPromise({
				try: () =>
					database.transaction("rw", projects, async () => {
						const candidate = await projects.get(projectId);
						if (candidate === undefined) {
							throw createRepositoryError(
								"upsert-item",
								`Editor project ${projectId} does not exist.`,
							);
						}
						const current = parseProjectRecord(candidate, "upsert-item");
						const collision = current.config.items[item.id];
						if (collision !== undefined && collision.uid !== item.uid) {
							throw createRepositoryError(
								"upsert-item",
								`Item ID ${item.id} is already used by another item.`,
							);
						}
						const entries = Object.entries(current.config.items);
						const previous = entries.find(([, existing]) => existing.uid === item.uid);
						if (previous !== undefined && previous[0] !== item.id) {
							throw createRepositoryError(
								"upsert-item",
								`Saved item ${previous[0]} cannot be renamed without an explicit rename workflow.`,
							);
						}
						const items = {
							...current.config.items,
						};
						items[item.id] = item;
						const record = parseProjectRecord(
							{
								...current,
								config: GameConfigSchema.parse({
									...current.config,
									items,
								}),
								revision: current.revision + 1,
								updatedAtMs: Math.max(nowMs, current.updatedAtMs + 1),
							},
							"upsert-item",
						);
						await projects.put(record);
						return materializeProjectCommit(record);
					}),
				catch: (cause) =>
					createRepositoryError(
						"upsert-item",
						`Item ${item.id} could not be saved in project ${projectId}.`,
						cause,
					),
			}).pipe(Effect.uninterruptible),
		);
	});

	const replaceConfigFx: EditorProjectRepositoryService["replaceConfigFx"] = Effect.fn(
		"IndexedDbEditorProjectRepository.replaceConfigFx",
	)(function* ({ projectId, config: candidateConfig }) {
		const config = yield* Effect.try({
			try: () => GameConfigSchema.parse(candidateConfig),
			catch: (cause) =>
				createRepositoryError(
					"replace-config",
					"The editor project config is invalid.",
					cause,
				),
		});
		const nowMs = yield* Clock.currentTimeMillis;
		return yield* writeLock.withPermits(1)(
			Effect.tryPromise({
				try: () =>
					database.transaction("rw", projects, async () => {
						const candidate = await projects.get(projectId);
						if (candidate === undefined) {
							throw createRepositoryError(
								"replace-config",
								`Editor project ${projectId} does not exist.`,
							);
						}
						const current = parseProjectRecord(candidate, "replace-config");
						const record = parseProjectRecord(
							{
								...current,
								config,
								revision: current.revision + 1,
								updatedAtMs: Math.max(nowMs, current.updatedAtMs + 1),
							},
							"replace-config",
						);
						await projects.put(record);
						return materializeProjectCommit(record);
					}),
				catch: (cause) =>
					createRepositoryError(
						"replace-config",
						`Project ${projectId} configuration could not be saved.`,
						cause,
					),
			}).pipe(Effect.uninterruptible),
		);
	});

	const upsertResourcesFx: EditorProjectRepositoryService["upsertResourcesFx"] = Effect.fn(
		"IndexedDbEditorProjectRepository.upsertResourcesFx",
	)(function* ({ projectId, resources: candidateResources }) {
		const parsedResources = yield* Effect.try({
			try: () => ResourceSchema.array().min(1).parse(candidateResources),
			catch: (cause) =>
				createRepositoryError(
					"upsert-resource",
					"The editor resources are invalid.",
					cause,
				),
		});
		const resourceIds = new Set<string>();
		for (const resource of parsedResources) {
			if (resourceIds.has(resource.id)) {
				return yield* Effect.fail(
					createRepositoryError(
						"upsert-resource",
						`Resource ${resource.id} occurs more than once in the same editor transaction.`,
					),
				);
			}
			resourceIds.add(resource.id);
		}
		const nowMs = yield* Clock.currentTimeMillis;
		return yield* writeLock.withPermits(1)(
			Effect.tryPromise({
				try: () =>
					database.transaction("rw", projects, resources, async () => {
						const candidate = await projects.get(projectId);
						if (candidate === undefined) {
							throw createRepositoryError(
								"upsert-resource",
								`Editor project ${projectId} does not exist.`,
							);
						}
						const current = parseProjectRecord(candidate, "upsert-resource");
						const record = parseProjectRecord(
							{
								...current,
								revision: current.revision + 1,
								updatedAtMs: Math.max(nowMs, current.updatedAtMs + 1),
							},
							"upsert-resource",
						);
						await resources.bulkPut(
							parsedResources.map((resource) => ({
								projectId,
								...resource,
							})),
						);
						await projects.put(record);
						const resourceRecords = parseResourceRecords(
							await resources.where("projectId").equals(projectId).toArray(),
							"upsert-resource",
						);
						return materializeProject(record, resourceRecords);
					}),
				catch: (cause) =>
					createRepositoryError(
						"upsert-resource",
						`Resources could not be saved in project ${projectId}.`,
						cause,
					),
			}).pipe(Effect.uninterruptible),
		);
	});

	const replaceResourceFx: EditorProjectRepositoryService["replaceResourceFx"] = Effect.fn(
		"IndexedDbEditorProjectRepository.replaceResourceFx",
	)(function* ({ config: candidateConfig, currentId, projectId, resource: candidateResource }) {
		const config = yield* Effect.try({
			try: () => GameConfigSchema.parse(candidateConfig),
			catch: (cause) =>
				createRepositoryError(
					"replace-resource",
					"The resource references are invalid.",
					cause,
				),
		});
		const resource = yield* Effect.try({
			try: () => ResourceSchema.parse(candidateResource),
			catch: (cause) =>
				createRepositoryError(
					"replace-resource",
					"The replacement resource is invalid.",
					cause,
				),
		});
		const nowMs = yield* Clock.currentTimeMillis;
		return yield* writeLock.withPermits(1)(
			Effect.tryPromise({
				try: () =>
					database.transaction("rw", projects, resources, async () => {
						const candidate = await projects.get(projectId);
						if (candidate === undefined)
							throw createRepositoryError(
								"replace-resource",
								`Editor project ${projectId} does not exist.`,
							);
						const existing = await resources.get([
							projectId,
							currentId,
						]);
						if (existing === undefined)
							throw createRepositoryError(
								"replace-resource",
								`Resource ${currentId} does not exist.`,
							);
						if (
							resource.id !== currentId &&
							(await resources.get([
								projectId,
								resource.id,
							])) !== undefined
						) {
							throw createRepositoryError(
								"replace-resource",
								`Resource ID ${resource.id} already exists.`,
							);
						}
						const current = parseProjectRecord(candidate, "replace-resource");
						const record = parseProjectRecord(
							{
								...current,
								config,
								revision: current.revision + 1,
								updatedAtMs: Math.max(nowMs, current.updatedAtMs + 1),
							},
							"replace-resource",
						);
						await resources.put({
							projectId,
							...resource,
						});
						if (resource.id !== currentId)
							await resources.delete([
								projectId,
								currentId,
							]);
						await projects.put(record);
						return materializeProject(
							record,
							parseResourceRecords(
								await resources.where("projectId").equals(projectId).toArray(),
								"replace-resource",
							),
						);
					}),
				catch: (cause) =>
					createRepositoryError(
						"replace-resource",
						`Resource ${currentId} could not be updated.`,
						cause,
					),
			}).pipe(Effect.uninterruptible),
		);
	});

	return {
		awaitIdleFx: writeLock.withPermits(1)(Effect.void),
		createProjectFx,
		listProjectsFx,
		readProjectFx,
		replaceConfigFx,
		replaceResourceFx,
		upsertItemFx,
		upsertResourcesFx,
	} satisfies EditorProjectRepositoryService;
});
