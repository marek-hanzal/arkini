import type { DatabaseSync, StatementSync } from "node:sqlite";
import { Clock, Effect, type Semaphore } from "effect";

import type { EditorProject, EditorProjectCommit } from "~/editor/EditorProject";
import {
	EditorProjectRecordSchema,
	type EditorProjectRecordSchema as EditorProjectRecordSchemaType,
} from "~/editor/EditorProjectRecordSchema";
import type { EditorProjectRepositoryService } from "~/editor/EditorProjectRepository";
import {
	EditorProjectRepositoryError,
	type EditorProjectRepositoryOperation,
} from "~/editor/EditorProjectRepositoryError";
import type { EditorProjectResourceRecordSchema } from "~/editor/EditorProjectResourceRecordSchema";
import { forceDeleteEditorItemFx } from "~/editor/forceDeleteEditorItemFx";
import { readEditorAssetDeleteBlockersFx } from "~/editor/readEditorAssetDeleteBlockersFx";
import { readEditorItemDeleteBlockersFx } from "~/editor/readEditorItemDeleteBlockersFx";
import {
	EditorProjectCompatibility,
	type EditorProjectCompatibilityLevel,
} from "~/editor/version/EditorProjectCompatibility";
import { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { ResourceSchema } from "~/engine/pack/schema/ResourceSchema";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { ElectronMainRuntime } from "../../../ElectronMainRuntime";
import { runSqliteEditorProjectTransactionFx } from "./runSqliteEditorProjectTransactionFx";
import { SqliteEditorProjectResourceRowSchema } from "../schema/SqliteEditorProjectResourceRowSchema";
import { SqliteEditorProjectRowSchema } from "../schema/SqliteEditorProjectRowSchema";

type CommitOperations = Pick<
	EditorProjectRepositoryService,
	| "deleteItemFx"
	| "deleteResourceFx"
	| "replaceConfigFx"
	| "replaceResourceFx"
	| "saveResourceFx"
	| "upsertItemFx"
	| "upsertResourcesFx"
>;

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
				cause,
			});

const readProjectRow = (
	statement: StatementSync,
	projectId: string,
	operation: EditorProjectRepositoryOperation,
) => {
	const candidate = statement.get(projectId);
	if (candidate === undefined) return null;
	const result = SqliteEditorProjectRowSchema.safeParse(candidate);
	if (result.success) return result.data;
	throw createRepositoryError(
		operation,
		"SQLite contains an invalid editor project record.",
		result.error,
	);
};

const readResourceRows = (
	statement: StatementSync,
	projectId: string,
	operation: EditorProjectRepositoryOperation,
) => {
	const result = SqliteEditorProjectResourceRowSchema.array().safeParse(statement.all(projectId));
	if (result.success) return result.data;
	throw createRepositoryError(
		operation,
		"SQLite contains an invalid editor project resource record.",
		result.error,
	);
};

const materializeProjectCommit = (
	record: EditorProjectRecordSchemaType.Type,
): EditorProjectCommit => ({
	projectId: record.projectId,
	title: record.config.meta.title,
	version: record.version,
	createdAtMs: record.createdAtMs,
	updatedAtMs: record.updatedAtMs,
	revision: record.revision,
	config: record.config,
});

const materializeProject = (
	record: EditorProjectRecordSchemaType.Type,
	resources: ReadonlyArray<EditorProjectResourceRecordSchema.Type>,
): EditorProject => ({
	...materializeProjectCommit(record),
	resources: resources
		.map(({ id, mime, bytes }) => ({
			id,
			mime,
			bytes,
		}))
		.sort((left, right) => left.id.localeCompare(right.id)),
});

const assertExpectedRevision = (
	record: EditorProjectRecordSchemaType.Type,
	expectedRevision: number,
	operation: EditorProjectRepositoryOperation,
) => {
	if (record.revision === expectedRevision) return;
	throw createRepositoryError(
		operation,
		`Editor project ${record.projectId} changed from revision ${expectedRevision} to ${record.revision} before this write could commit.`,
	);
};

export namespace createSqliteEditorProjectCommitOperationsFx {
	export interface Props {
		readonly database: DatabaseSync;
		readonly writeLock: Semaphore.Semaphore;
	}
}

/** Owns every config, item, resource, version, revision, and Board-invalidation commit. */
export const createSqliteEditorProjectCommitOperationsFx = Effect.fn(
	"createSqliteEditorProjectCommitOperationsFx",
)(function* ({ database, writeLock }: createSqliteEditorProjectCommitOperationsFx.Props) {
	const {
		selectProject,
		selectResources,
		resourceExists,
		updateProject,
		upsertResource,
		deleteResource,
		deleteBoardScenarios,
	} = yield* Effect.try({
		try: () => ({
			selectProject: database.prepare(`
				SELECT project_id, config_json, arkpack_version, revision, created_at_ms, updated_at_ms
				FROM projects
				WHERE project_id = ?
			`),
			selectResources: database.prepare(`
				SELECT project_id, id, mime, bytes
				FROM resources
				WHERE project_id = ?
				ORDER BY id ASC
			`),
			resourceExists: database.prepare(
				"SELECT 1 AS found FROM resources WHERE project_id = ? AND id = ?",
			),
			updateProject: database.prepare(`
				UPDATE projects
				SET config_json = ?, arkpack_version = ?, revision = ?, updated_at_ms = ?
				WHERE project_id = ?
			`),
			upsertResource: database.prepare(`
				INSERT INTO resources(project_id, id, mime, bytes)
				VALUES (?, ?, ?, ?)
				ON CONFLICT(project_id, id) DO UPDATE SET mime = excluded.mime, bytes = excluded.bytes
			`),
			deleteResource: database.prepare(
				"DELETE FROM resources WHERE project_id = ? AND id = ?",
			),
			deleteBoardScenarios: database.prepare(
				"DELETE FROM board_scenarios WHERE project_id = ?",
			),
		}),
		catch: (cause) =>
			createRepositoryError(
				"replace-config",
				"The editor project commit schema is incompatible.",
				cause,
			),
	});
	const writeProjectRecord = (
		record: EditorProjectRecordSchemaType.Type,
		dropBoardScenarios: boolean,
	) => {
		updateProject.run(
			JSON.stringify(record.config),
			record.version,
			record.revision,
			record.updatedAtMs,
			record.projectId,
		);
		if (dropBoardScenarios) deleteBoardScenarios.run(record.projectId);
	};
	const reviseProjectRecord = (
		current: EditorProjectRecordSchemaType.Type,
		config: GameConfigSchema.Type,
		nowMs: number,
		minimumLevel: EditorProjectCompatibilityLevel = "none",
	) => {
		const compatibility = EditorProjectCompatibility.analyze(current.config, config);
		const level =
			minimumLevel === "minor" && compatibility.level === "none"
				? "minor"
				: compatibility.level;
		return {
			record: EditorProjectRecordSchema.parse({
				...current,
				config,
				version: EditorProjectCompatibility.bumpVersion(current.version, level),
				revision: current.revision + 1,
				updatedAtMs: Math.max(nowMs, current.updatedAtMs + 1),
			}),
			dropBoardScenarios: compatibility.level === "major",
		};
	};

	const upsertItemFx: CommitOperations["upsertItemFx"] = Effect.fn(
		"SqliteEditorProjectRepository.upsertItemFx",
	)(function* ({ expectedRevision, projectId, item: candidateItem }) {
		const item = yield* Effect.try({
			try: () => ItemSchema.parse(candidateItem),
			catch: (cause) =>
				createRepositoryError("upsert-item", "The editor item is invalid.", cause),
		});
		const nowMs = yield* Clock.currentTimeMillis;
		return yield* writeLock.withPermits(1)(
			runSqliteEditorProjectTransactionFx(database, () => {
				const current = readProjectRow(selectProject, projectId, "upsert-item");
				if (current === null)
					throw createRepositoryError(
						"upsert-item",
						`Editor project ${projectId} does not exist.`,
					);
				if (expectedRevision !== undefined)
					assertExpectedRevision(current, expectedRevision, "upsert-item");
				const collision = current.config.items[item.id];
				if (collision !== undefined && collision.uid !== item.uid)
					throw createRepositoryError(
						"upsert-item",
						`Item ID ${item.id} is already used by another item.`,
					);
				const previous = Object.entries(current.config.items).find(
					([, existing]) => existing.uid === item.uid,
				);
				if (previous !== undefined && previous[0] !== item.id)
					throw createRepositoryError(
						"upsert-item",
						`Saved item ${previous[0]} cannot be renamed without an explicit rename workflow.`,
					);
				const config = GameConfigSchema.parse({
					...current.config,
					items: {
						...current.config.items,
						[item.id]: item,
					},
				});
				const revision = reviseProjectRecord(current, config, nowMs);
				writeProjectRecord(revision.record, revision.dropBoardScenarios);
				return materializeProjectCommit(revision.record);
			}).pipe(
				Effect.mapError((cause) =>
					createRepositoryError(
						"upsert-item",
						`Item ${item.id} could not be saved in project ${projectId}.`,
						cause,
					),
				),
				Effect.uninterruptible,
			),
		);
	});

	const deleteItemFx: CommitOperations["deleteItemFx"] = Effect.fn(
		"SqliteEditorProjectRepository.deleteItemFx",
	)(function* ({ expectedRevision, force, itemUid, projectId }) {
		const nowMs = yield* Clock.currentTimeMillis;
		return yield* writeLock.withPermits(1)(
			runSqliteEditorProjectTransactionFx(database, () => {
				const current = readProjectRow(selectProject, projectId, "delete-item");
				if (current === null)
					throw createRepositoryError(
						"delete-item",
						`Editor project ${projectId} does not exist.`,
					);
				assertExpectedRevision(current, expectedRevision, "delete-item");
				const entry = Object.entries(current.config.items).find(
					([, item]) => item.uid === itemUid,
				);
				if (entry === undefined)
					throw createRepositoryError(
						"delete-item",
						`Item UID ${itemUid} does not exist.`,
					);
				const [itemId] = entry;
				const blockers = ElectronMainRuntime.runSync(
					readEditorItemDeleteBlockersFx({
						config: current.config,
						itemId,
					}),
				);
				if (blockers.length > 0 && !force)
					throw createRepositoryError(
						"delete-item",
						`Item ${itemId} is still referenced in ${blockers.length} ${blockers.length === 1 ? "place" : "places"}.`,
					);
				const config = force
					? ElectronMainRuntime.runSync(
							forceDeleteEditorItemFx({
								config: current.config,
								itemId,
							}),
						).config
					: GameConfigSchema.parse({
							...current.config,
							items: Object.fromEntries(
								Object.entries(current.config.items).filter(
									([id]) => id !== itemId,
								),
							),
						});
				const revision = reviseProjectRecord(current, config, nowMs);
				writeProjectRecord(revision.record, revision.dropBoardScenarios);
				return materializeProjectCommit(revision.record);
			}).pipe(
				Effect.mapError((cause) =>
					createRepositoryError(
						"delete-item",
						`Item UID ${itemUid} could not be deleted from project ${projectId}.`,
						cause,
					),
				),
				Effect.uninterruptible,
			),
		);
	});

	const deleteResourceFx: CommitOperations["deleteResourceFx"] = Effect.fn(
		"SqliteEditorProjectRepository.deleteResourceFx",
	)(function* ({ expectedRevision, projectId, resourceId }) {
		const nowMs = yield* Clock.currentTimeMillis;
		return yield* writeLock.withPermits(1)(
			runSqliteEditorProjectTransactionFx(database, () => {
				const current = readProjectRow(selectProject, projectId, "delete-resource");
				if (current === null)
					throw createRepositoryError(
						"delete-resource",
						`Editor project ${projectId} does not exist.`,
					);
				assertExpectedRevision(current, expectedRevision, "delete-resource");
				if (resourceExists.get(projectId, resourceId) === undefined)
					throw createRepositoryError(
						"delete-resource",
						`Resource ${resourceId} does not exist.`,
					);
				const blockers = ElectronMainRuntime.runSync(
					readEditorAssetDeleteBlockersFx({
						config: current.config,
						resourceId,
					}),
				);
				if (blockers.length > 0)
					throw createRepositoryError(
						"delete-resource",
						`Resource ${resourceId} is still referenced in ${blockers.length} ${blockers.length === 1 ? "place" : "places"}.`,
					);
				deleteResource.run(projectId, resourceId);
				const revision = reviseProjectRecord(current, current.config, nowMs, "minor");
				writeProjectRecord(revision.record, revision.dropBoardScenarios);
				return materializeProject(
					revision.record,
					readResourceRows(selectResources, projectId, "delete-resource"),
				);
			}).pipe(
				Effect.mapError((cause) =>
					createRepositoryError(
						"delete-resource",
						`Resource ${resourceId} could not be deleted from project ${projectId}.`,
						cause,
					),
				),
				Effect.uninterruptible,
			),
		);
	});

	const replaceConfigFx: CommitOperations["replaceConfigFx"] = Effect.fn(
		"SqliteEditorProjectRepository.replaceConfigFx",
	)(function* ({ projectId, expectedRevision, config: candidateConfig }) {
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
			runSqliteEditorProjectTransactionFx(database, () => {
				const current = readProjectRow(selectProject, projectId, "replace-config");
				if (current === null)
					throw createRepositoryError(
						"replace-config",
						`Editor project ${projectId} does not exist.`,
					);
				assertExpectedRevision(current, expectedRevision, "replace-config");
				const revision = reviseProjectRecord(current, config, nowMs);
				writeProjectRecord(revision.record, revision.dropBoardScenarios);
				return materializeProjectCommit(revision.record);
			}).pipe(
				Effect.mapError((cause) =>
					createRepositoryError(
						"replace-config",
						`Project ${projectId} configuration could not be saved.`,
						cause,
					),
				),
				Effect.uninterruptible,
			),
		);
	});

	const upsertResourcesFx: CommitOperations["upsertResourcesFx"] = Effect.fn(
		"SqliteEditorProjectRepository.upsertResourcesFx",
	)(function* ({ projectId, resources: candidateResources }) {
		const resources = yield* Effect.try({
			try: () => ResourceSchema.array().min(1).parse(candidateResources),
			catch: (cause) =>
				createRepositoryError(
					"upsert-resource",
					"The editor resources are invalid.",
					cause,
				),
		});
		const ids = new Set<string>();
		for (const resource of resources) {
			if (ids.has(resource.id))
				return yield* Effect.fail(
					createRepositoryError(
						"upsert-resource",
						`Resource ${resource.id} occurs more than once in the same editor transaction.`,
					),
				);
			ids.add(resource.id);
		}
		const nowMs = yield* Clock.currentTimeMillis;
		return yield* writeLock.withPermits(1)(
			runSqliteEditorProjectTransactionFx(database, () => {
				const current = readProjectRow(selectProject, projectId, "upsert-resource");
				if (current === null)
					throw createRepositoryError(
						"upsert-resource",
						`Editor project ${projectId} does not exist.`,
					);
				for (const resource of resources)
					upsertResource.run(projectId, resource.id, resource.mime, resource.bytes);
				const revision = reviseProjectRecord(current, current.config, nowMs, "minor");
				writeProjectRecord(revision.record, revision.dropBoardScenarios);
				return materializeProject(
					revision.record,
					readResourceRows(selectResources, projectId, "upsert-resource"),
				);
			}).pipe(
				Effect.mapError((cause) =>
					createRepositoryError(
						"upsert-resource",
						`Resources could not be saved in project ${projectId}.`,
						cause,
					),
				),
				Effect.uninterruptible,
			),
		);
	});

	const saveResourceFx: CommitOperations["saveResourceFx"] = Effect.fn(
		"SqliteEditorProjectRepository.saveResourceFx",
	)(function* ({ expectedRevision, overwrite, projectId, resource: candidateResource }) {
		const resource = yield* Effect.try({
			try: () => ResourceSchema.parse(candidateResource),
			catch: (cause) =>
				createRepositoryError("save-resource", "The editor resource is invalid.", cause),
		});
		const nowMs = yield* Clock.currentTimeMillis;
		return yield* writeLock.withPermits(1)(
			runSqliteEditorProjectTransactionFx(database, () => {
				const current = readProjectRow(selectProject, projectId, "save-resource");
				if (current === null)
					throw createRepositoryError(
						"save-resource",
						`Editor project ${projectId} does not exist.`,
					);
				assertExpectedRevision(current, expectedRevision, "save-resource");
				if (!overwrite && resourceExists.get(projectId, resource.id) !== undefined)
					throw createRepositoryError(
						"save-resource",
						`Resource ID ${resource.id} already exists.`,
					);
				upsertResource.run(projectId, resource.id, resource.mime, resource.bytes);
				const revision = reviseProjectRecord(current, current.config, nowMs, "minor");
				writeProjectRecord(revision.record, revision.dropBoardScenarios);
				return materializeProject(
					revision.record,
					readResourceRows(selectResources, projectId, "save-resource"),
				);
			}).pipe(
				Effect.mapError((cause) =>
					createRepositoryError(
						"save-resource",
						`Resource ${resource.id} could not be saved in project ${projectId}.`,
						cause,
					),
				),
				Effect.uninterruptible,
			),
		);
	});

	const replaceResourceFx: CommitOperations["replaceResourceFx"] = Effect.fn(
		"SqliteEditorProjectRepository.replaceResourceFx",
	)(function* ({
		config: candidateConfig,
		currentId,
		expectedRevision,
		projectId,
		resource: candidateResource,
	}) {
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
			runSqliteEditorProjectTransactionFx(database, () => {
				const current = readProjectRow(selectProject, projectId, "replace-resource");
				if (current === null)
					throw createRepositoryError(
						"replace-resource",
						`Editor project ${projectId} does not exist.`,
					);
				assertExpectedRevision(current, expectedRevision, "replace-resource");
				if (resourceExists.get(projectId, currentId) === undefined)
					throw createRepositoryError(
						"replace-resource",
						`Resource ${currentId} does not exist.`,
					);
				if (
					resource.id !== currentId &&
					resourceExists.get(projectId, resource.id) !== undefined
				)
					throw createRepositoryError(
						"replace-resource",
						`Resource ID ${resource.id} already exists.`,
					);
				upsertResource.run(projectId, resource.id, resource.mime, resource.bytes);
				if (resource.id !== currentId) deleteResource.run(projectId, currentId);
				const revision = reviseProjectRecord(current, config, nowMs, "minor");
				writeProjectRecord(revision.record, revision.dropBoardScenarios);
				return materializeProject(
					revision.record,
					readResourceRows(selectResources, projectId, "replace-resource"),
				);
			}).pipe(
				Effect.mapError((cause) =>
					createRepositoryError(
						"replace-resource",
						`Resource ${currentId} could not be updated.`,
						cause,
					),
				),
				Effect.uninterruptible,
			),
		);
	});

	return {
		deleteItemFx,
		deleteResourceFx,
		upsertItemFx,
		replaceConfigFx,
		upsertResourcesFx,
		saveResourceFx,
		replaceResourceFx,
	} satisfies CommitOperations;
});
