import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync, type StatementSync } from "node:sqlite";
import { Clock, Effect, Semaphore } from "effect";

import type { EditorProject, EditorProjectCommit } from "../../src/editor/EditorProject";
import {
	EditorProjectRecordSchema,
	type EditorProjectRecordSchema as EditorProjectRecordSchemaType,
} from "../../src/editor/EditorProjectRecordSchema";
import type { EditorProjectRepositoryService } from "../../src/editor/EditorProjectRepository";
import {
	EditorProjectRepositoryError,
	type EditorProjectRepositoryOperation,
} from "../../src/editor/EditorProjectRepositoryError";
import {
	EditorProjectResourceRecordSchema,
	type EditorProjectResourceRecordSchema as EditorProjectResourceRecordSchemaType,
} from "../../src/editor/EditorProjectResourceRecordSchema";
import { ItemSchema } from "../../src/engine/item/schema/ItemSchema";
import { ResourceSchema } from "../../src/engine/pack/schema/ResourceSchema";
import { GameConfigSchema } from "../../src/engine/schema/GameConfigSchema";
import { EditorProjectCompatibility } from "../../src/editor/version/EditorProjectCompatibility";
import {
	EditorBoardScenarioDescriptorSchema,
	EditorBoardScenarioNameSchema,
	EditorBoardScenarioSchema,
} from "../../src/editor/board/EditorBoardScenarioSchema";

const schemaVersion = 3;
const createBoardScenariosSql = `
	CREATE TABLE board_scenarios (
		project_id TEXT NOT NULL,
		name TEXT NOT NULL,
		project_revision INTEGER NOT NULL CHECK (project_revision >= 0),
		arkpack_version TEXT NOT NULL,
		save_bytes BLOB NOT NULL CHECK (length(save_bytes) > 0),
		created_at_ms INTEGER NOT NULL CHECK (created_at_ms >= 0),
		updated_at_ms INTEGER NOT NULL CHECK (updated_at_ms >= created_at_ms),
		PRIMARY KEY (project_id, name),
		FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
	) STRICT;
	CREATE INDEX board_scenarios_recent
		ON board_scenarios(project_id, updated_at_ms DESC, name ASC);
`;

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

const readProjectRow = (
	statement: StatementSync,
	projectId: string,
	operation: EditorProjectRepositoryOperation,
) => {
	const candidate = statement.get(projectId);
	if (candidate === undefined) return null;
	if (
		typeof candidate.project_id !== "string" ||
		typeof candidate.config_json !== "string" ||
		typeof candidate.arkpack_version !== "string" ||
		typeof candidate.revision !== "number" ||
		typeof candidate.created_at_ms !== "number" ||
		typeof candidate.updated_at_ms !== "number"
	) {
		throw createRepositoryError(operation, "SQLite contains an invalid editor project row.");
	}
	const result = EditorProjectRecordSchema.safeParse({
		projectId: candidate.project_id,
		config: JSON.parse(candidate.config_json),
		version: candidate.arkpack_version,
		revision: candidate.revision,
		createdAtMs: candidate.created_at_ms,
		updatedAtMs: candidate.updated_at_ms,
	});
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
	const candidates = statement.all(projectId).map((candidate) => {
		if (
			typeof candidate.project_id !== "string" ||
			typeof candidate.id !== "string" ||
			typeof candidate.mime !== "string" ||
			!(candidate.bytes instanceof Uint8Array)
		) {
			throw createRepositoryError(
				operation,
				"SQLite contains an invalid editor resource row.",
			);
		}
		return {
			projectId: candidate.project_id,
			id: candidate.id,
			mime: candidate.mime,
			bytes: new Uint8Array(candidate.bytes),
		};
	});
	const result = EditorProjectResourceRecordSchema.array().safeParse(candidates);
	if (result.success) return result.data;
	throw createRepositoryError(
		operation,
		"SQLite contains an invalid editor project resource record.",
		result.error,
	);
};

const readBoardScenarioRow = (
	candidate: Record<string, unknown> | undefined,
	operation: EditorProjectRepositoryOperation,
) => {
	if (candidate === undefined) return null;
	const result = EditorBoardScenarioSchema.safeParse({
		projectId: candidate.project_id,
		name: candidate.name,
		projectRevision: candidate.project_revision,
		version: candidate.arkpack_version,
		bytes:
			candidate.save_bytes instanceof Uint8Array
				? new Uint8Array(candidate.save_bytes)
				: candidate.save_bytes,
		createdAtMs: candidate.created_at_ms,
		updatedAtMs: candidate.updated_at_ms,
	});
	if (result.success) return result.data;
	throw createRepositoryError(
		operation,
		"SQLite contains an invalid editor Board scenario.",
		result.error,
	);
};

const readBoardScenarioDescriptor = (
	candidate: Record<string, unknown>,
	operation: EditorProjectRepositoryOperation,
) => {
	const result = EditorBoardScenarioDescriptorSchema.safeParse({
		projectId: candidate.project_id,
		name: candidate.name,
		projectRevision: candidate.project_revision,
		version: candidate.arkpack_version,
		createdAtMs: candidate.created_at_ms,
		updatedAtMs: candidate.updated_at_ms,
	});
	if (result.success) return result.data;
	throw createRepositoryError(
		operation,
		"SQLite contains invalid editor Board scenario metadata.",
		result.error,
	);
};

const materializeProject = (
	record: EditorProjectRecordSchemaType.Type,
	resources: ReadonlyArray<EditorProjectResourceRecordSchemaType.Type>,
): EditorProject => ({
	projectId: record.projectId,
	title: record.config.meta.title,
	version: record.version,
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
	version: record.version,
	createdAtMs: record.createdAtMs,
	updatedAtMs: record.updatedAtMs,
	revision: record.revision,
	config: record.config,
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

const readResourceVersion = (record: EditorProjectRecordSchemaType.Type) =>
	EditorProjectCompatibility.bumpVersion(record.version, "minor");

const runTransaction = <Value>(database: DatabaseSync, run: () => Value): Value => {
	database.exec("BEGIN IMMEDIATE");
	try {
		const value = run();
		database.exec("COMMIT");
		return value;
	} catch (cause) {
		try {
			database.exec("ROLLBACK");
		} catch {
			// Preserve the operation failure that caused the rollback.
		}
		throw cause;
	}
};

const initializeSchema = (database: DatabaseSync) => {
	database.exec("PRAGMA foreign_keys = ON");
	database.exec("PRAGMA journal_mode = WAL");
	const versionRow = database.prepare("PRAGMA user_version").get();
	const version = versionRow?.user_version;
	if (version === schemaVersion) return;
	if (version !== 0 && version !== 1 && version !== 2) {
		throw new Error(`Unsupported editor database schema version ${String(version)}.`);
	}
	runTransaction(database, () => {
		if (version === 0) {
			database.exec(`
			CREATE TABLE projects (
				project_id TEXT PRIMARY KEY NOT NULL,
				config_json TEXT NOT NULL,
				arkpack_version TEXT NOT NULL,
				revision INTEGER NOT NULL CHECK (revision >= 0),
				created_at_ms INTEGER NOT NULL CHECK (created_at_ms >= 0),
				updated_at_ms INTEGER NOT NULL CHECK (updated_at_ms >= created_at_ms)
			) STRICT;
			CREATE INDEX projects_recent
				ON projects(updated_at_ms DESC, project_id ASC);
			CREATE TABLE resources (
				project_id TEXT NOT NULL,
				id TEXT NOT NULL,
				mime TEXT NOT NULL,
				bytes BLOB NOT NULL,
				PRIMARY KEY (project_id, id),
				FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
			) STRICT;
			CREATE INDEX resources_by_project ON resources(project_id, id);
		`);
		} else if (version === 1) {
			database.exec(
				"ALTER TABLE projects ADD COLUMN arkpack_version TEXT NOT NULL DEFAULT '1.0'",
			);
			const select = database.prepare("SELECT project_id, config_json FROM projects");
			const update = database.prepare(
				"UPDATE projects SET config_json = ?, arkpack_version = '1.0' WHERE project_id = ?",
			);
			for (const row of select.all()) {
				if (typeof row.project_id !== "string" || typeof row.config_json !== "string")
					throw new Error("SQLite contains an invalid legacy editor project row.");
				const config = JSON.parse(row.config_json) as Record<string, unknown>;
				delete config.version;
				update.run(JSON.stringify(config), row.project_id);
			}
		}
		database.exec(createBoardScenariosSql);
		database.exec(`PRAGMA user_version = ${schemaVersion}`);
	});
};

export interface SqliteEditorProjectRepository extends EditorProjectRepositoryService {
	readonly closeFx: Effect.Effect<void>;
	readonly closeSync: () => void;
}

export namespace createSqliteEditorProjectRepositoryFx {
	export interface Props {
		readonly databasePath: string;
	}
}

/** Opens the one main-process SQLite authority over canonical editor projects. */
export const createSqliteEditorProjectRepositoryFx = Effect.fn(
	"createSqliteEditorProjectRepositoryFx",
)(function* ({ databasePath }: createSqliteEditorProjectRepositoryFx.Props) {
	const database = yield* Effect.try({
		try: () => {
			if (databasePath !== ":memory:")
				mkdirSync(dirname(databasePath), {
					recursive: true,
				});
			const opened = new DatabaseSync(databasePath, {
				timeout: 5_000,
			});
			try {
				initializeSchema(opened);
				return opened;
			} catch (cause) {
				opened.close();
				throw cause;
			}
		},
		catch: (cause) =>
			createRepositoryError(
				"list-projects",
				"The editor project database could not be opened.",
				cause,
			),
	});
	const statements = yield* Effect.try({
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
			insertProject: database.prepare(`
				INSERT INTO projects(project_id, config_json, arkpack_version, revision, created_at_ms, updated_at_ms)
				VALUES (?, ?, ?, ?, ?, ?)
			`),
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
			insertResource: database.prepare(`
				INSERT INTO resources(project_id, id, mime, bytes)
				VALUES (?, ?, ?, ?)
			`),
			deleteResource: database.prepare(`
				DELETE FROM resources WHERE project_id = ? AND id = ?
			`),
			selectBoardScenarios: database.prepare(`
				SELECT project_id, name, project_revision, arkpack_version, created_at_ms, updated_at_ms
				FROM board_scenarios
				WHERE project_id = ?
				ORDER BY updated_at_ms DESC, name ASC
			`),
			selectBoardScenario: database.prepare(`
				SELECT project_id, name, project_revision, arkpack_version, save_bytes, created_at_ms, updated_at_ms
				FROM board_scenarios
				WHERE project_id = ? AND name = ?
			`),
			upsertBoardScenario: database.prepare(`
				INSERT INTO board_scenarios(
					project_id, name, project_revision, arkpack_version, save_bytes, created_at_ms, updated_at_ms
				) VALUES (?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT(project_id, name) DO UPDATE SET
					project_revision = excluded.project_revision,
					arkpack_version = excluded.arkpack_version,
					save_bytes = excluded.save_bytes,
					updated_at_ms = excluded.updated_at_ms
			`),
			deleteBoardScenario: database.prepare(`
				DELETE FROM board_scenarios WHERE project_id = ? AND name = ?
			`),
			deleteBoardScenarios: database.prepare(`
				DELETE FROM board_scenarios WHERE project_id = ?
			`),
		}),
		catch: (cause) => {
			database.close();
			return createRepositoryError(
				"list-projects",
				"The editor project database schema is incompatible.",
				cause,
			);
		},
	});
	const {
		selectProject,
		selectResources,
		insertProject,
		updateProject,
		upsertResource,
		insertResource,
		deleteResource,
		selectBoardScenarios,
		selectBoardScenario,
		upsertBoardScenario,
		deleteBoardScenario,
		deleteBoardScenarios,
	} = statements;
	const writeProjectRecord = (
		record: EditorProjectRecordSchemaType.Type,
		dropBoardScenarios = false,
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
	const writeLock = yield* Semaphore.make(1);

	const readMaterializedProject = (
		projectId: string,
		operation: EditorProjectRepositoryOperation,
	) => {
		const record = readProjectRow(selectProject, projectId, operation);
		return record === null
			? null
			: materializeProject(record, readResourceRows(selectResources, projectId, operation));
	};

	const createProjectFx: EditorProjectRepositoryService["createProjectFx"] = Effect.fn(
		"SqliteEditorProjectRepository.createProjectFx",
	)(function* ({ projectId, version, config: candidateConfig, resources: candidateResources }) {
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
			Effect.try({
				try: () =>
					runTransaction(database, () => {
						if (readProjectRow(selectProject, projectId, "create-project") !== null) {
							throw createRepositoryError(
								"create-project",
								`Editor project ${projectId} already exists.`,
							);
						}
						const record = EditorProjectRecordSchema.parse({
							projectId,
							config,
							version,
							revision: 0,
							createdAtMs: nowMs,
							updatedAtMs: nowMs,
						});
						const resourceRecords = EditorProjectResourceRecordSchema.array().parse(
							parsedResources.map((resource) => ({
								projectId,
								...resource,
							})),
						);
						insertProject.run(
							record.projectId,
							JSON.stringify(record.config),
							record.version,
							record.revision,
							record.createdAtMs,
							record.updatedAtMs,
						);
						for (const resource of resourceRecords) {
							insertResource.run(
								resource.projectId,
								resource.id,
								resource.mime,
								resource.bytes,
							);
						}
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

	const listProjectsFx: EditorProjectRepositoryService["listProjectsFx"] = Effect.try({
		try: () =>
			database
				.prepare(`
					SELECT project_id, config_json, arkpack_version, revision, created_at_ms, updated_at_ms
					FROM projects
					ORDER BY updated_at_ms DESC, project_id ASC
				`)
				.all()
				.map((candidate) => {
					if (typeof candidate.project_id !== "string") {
						throw createRepositoryError(
							"list-projects",
							"SQLite contains an invalid editor project row.",
						);
					}
					const record = readProjectRow(
						selectProject,
						candidate.project_id,
						"list-projects",
					);
					if (record === null) throw new Error("The listed editor project disappeared.");
					return {
						projectId: record.projectId,
						title: record.config.meta.title,
						version: record.version,
						createdAtMs: record.createdAtMs,
						updatedAtMs: record.updatedAtMs,
					};
				}),
		catch: (cause) =>
			createRepositoryError("list-projects", "Editor projects could not be listed.", cause),
	});

	const readProjectFx: EditorProjectRepositoryService["readProjectFx"] = Effect.fn(
		"SqliteEditorProjectRepository.readProjectFx",
	)((projectId) =>
		Effect.try({
			try: () => readMaterializedProject(projectId, "read-project"),
			catch: (cause) =>
				createRepositoryError(
					"read-project",
					`Editor project ${projectId} could not be read.`,
					cause,
				),
		}),
	);

	const listBoardScenariosFx: EditorProjectRepositoryService["listBoardScenariosFx"] = Effect.fn(
		"SqliteEditorProjectRepository.listBoardScenariosFx",
	)((projectId) =>
		Effect.try({
			try: () => {
				if (readProjectRow(selectProject, projectId, "list-board-scenarios") === null) {
					throw createRepositoryError(
						"list-board-scenarios",
						`Editor project ${projectId} does not exist.`,
					);
				}
				return selectBoardScenarios
					.all(projectId)
					.map((candidate) =>
						readBoardScenarioDescriptor(candidate, "list-board-scenarios"),
					);
			},
			catch: (cause) =>
				createRepositoryError(
					"list-board-scenarios",
					`Board scenarios for project ${projectId} could not be listed.`,
					cause,
				),
		}),
	);

	const readBoardScenarioFx: EditorProjectRepositoryService["readBoardScenarioFx"] = Effect.fn(
		"SqliteEditorProjectRepository.readBoardScenarioFx",
	)(({ projectId, name }) =>
		Effect.try({
			try: () =>
				readBoardScenarioRow(
					selectBoardScenario.get(projectId, name),
					"read-board-scenario",
				),
			catch: (cause) =>
				createRepositoryError(
					"read-board-scenario",
					`Board scenario ${name} in project ${projectId} could not be read.`,
					cause,
				),
		}),
	);

	const upsertItemFx: EditorProjectRepositoryService["upsertItemFx"] = Effect.fn(
		"SqliteEditorProjectRepository.upsertItemFx",
	)(function* ({ projectId, item: candidateItem }) {
		const item = yield* Effect.try({
			try: () => ItemSchema.parse(candidateItem),
			catch: (cause) =>
				createRepositoryError("upsert-item", "The editor item is invalid.", cause),
		});
		const nowMs = yield* Clock.currentTimeMillis;
		return yield* writeLock.withPermits(1)(
			Effect.try({
				try: () =>
					runTransaction(database, () => {
						const current = readProjectRow(selectProject, projectId, "upsert-item");
						if (current === null) {
							throw createRepositoryError(
								"upsert-item",
								`Editor project ${projectId} does not exist.`,
							);
						}
						const collision = current.config.items[item.id];
						if (collision !== undefined && collision.uid !== item.uid) {
							throw createRepositoryError(
								"upsert-item",
								`Item ID ${item.id} is already used by another item.`,
							);
						}
						const previous = Object.entries(current.config.items).find(
							([, existing]) => existing.uid === item.uid,
						);
						if (previous !== undefined && previous[0] !== item.id) {
							throw createRepositoryError(
								"upsert-item",
								`Saved item ${previous[0]} cannot be renamed without an explicit rename workflow.`,
							);
						}
						const config = GameConfigSchema.parse({
							...current.config,
							items: {
								...current.config.items,
								[item.id]: item,
							},
						});
						const compatibility = EditorProjectCompatibility.analyze(
							current.config,
							config,
						);
						const record = EditorProjectRecordSchema.parse({
							...current,
							config,
							version: EditorProjectCompatibility.bumpVersion(
								current.version,
								compatibility.level,
							),
							revision: current.revision + 1,
							updatedAtMs: Math.max(nowMs, current.updatedAtMs + 1),
						});
						writeProjectRecord(record, compatibility.level === "major");
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
			Effect.try({
				try: () =>
					runTransaction(database, () => {
						const current = readProjectRow(selectProject, projectId, "replace-config");
						if (current === null) {
							throw createRepositoryError(
								"replace-config",
								`Editor project ${projectId} does not exist.`,
							);
						}
						assertExpectedRevision(current, expectedRevision, "replace-config");
						const compatibility = EditorProjectCompatibility.analyze(
							current.config,
							config,
						);
						const record = EditorProjectRecordSchema.parse({
							...current,
							config,
							version: EditorProjectCompatibility.bumpVersion(
								current.version,
								compatibility.level,
							),
							revision: current.revision + 1,
							updatedAtMs: Math.max(nowMs, current.updatedAtMs + 1),
						});
						writeProjectRecord(record, compatibility.level === "major");
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
		"SqliteEditorProjectRepository.upsertResourcesFx",
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
		const ids = new Set<string>();
		for (const resource of parsedResources) {
			if (ids.has(resource.id)) {
				return yield* Effect.fail(
					createRepositoryError(
						"upsert-resource",
						`Resource ${resource.id} occurs more than once in the same editor transaction.`,
					),
				);
			}
			ids.add(resource.id);
		}
		const nowMs = yield* Clock.currentTimeMillis;
		return yield* writeLock.withPermits(1)(
			Effect.try({
				try: () =>
					runTransaction(database, () => {
						const current = readProjectRow(selectProject, projectId, "upsert-resource");
						if (current === null) {
							throw createRepositoryError(
								"upsert-resource",
								`Editor project ${projectId} does not exist.`,
							);
						}
						for (const resource of parsedResources) {
							upsertResource.run(
								projectId,
								resource.id,
								resource.mime,
								resource.bytes,
							);
						}
						const record = EditorProjectRecordSchema.parse({
							...current,
							version: readResourceVersion(current),
							revision: current.revision + 1,
							updatedAtMs: Math.max(nowMs, current.updatedAtMs + 1),
						});
						writeProjectRecord(record);
						return materializeProject(
							record,
							readResourceRows(selectResources, projectId, "upsert-resource"),
						);
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
			Effect.try({
				try: () =>
					runTransaction(database, () => {
						const current = readProjectRow(
							selectProject,
							projectId,
							"replace-resource",
						);
						if (current === null) {
							throw createRepositoryError(
								"replace-resource",
								`Editor project ${projectId} does not exist.`,
							);
						}
						assertExpectedRevision(current, expectedRevision, "replace-resource");
						const existing = database
							.prepare(
								"SELECT 1 AS found FROM resources WHERE project_id = ? AND id = ?",
							)
							.get(projectId, currentId);
						if (existing === undefined) {
							throw createRepositoryError(
								"replace-resource",
								`Resource ${currentId} does not exist.`,
							);
						}
						if (
							resource.id !== currentId &&
							database
								.prepare(
									"SELECT 1 AS found FROM resources WHERE project_id = ? AND id = ?",
								)
								.get(projectId, resource.id) !== undefined
						) {
							throw createRepositoryError(
								"replace-resource",
								`Resource ID ${resource.id} already exists.`,
							);
						}
						upsertResource.run(projectId, resource.id, resource.mime, resource.bytes);
						if (resource.id !== currentId) deleteResource.run(projectId, currentId);
						const compatibility = EditorProjectCompatibility.analyze(
							current.config,
							config,
						);
						const record = EditorProjectRecordSchema.parse({
							...current,
							config,
							version: EditorProjectCompatibility.bumpVersion(
								current.version,
								compatibility.level === "major" ? "major" : "minor",
							),
							revision: current.revision + 1,
							updatedAtMs: Math.max(nowMs, current.updatedAtMs + 1),
						});
						writeProjectRecord(record, compatibility.level === "major");
						return materializeProject(
							record,
							readResourceRows(selectResources, projectId, "replace-resource"),
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

	const writeBoardScenarioFx: EditorProjectRepositoryService["writeBoardScenarioFx"] = Effect.fn(
		"SqliteEditorProjectRepository.writeBoardScenarioFx",
	)(function* ({ projectId, expectedRevision, name: candidateName, bytes: candidateBytes }) {
		const { name, bytes } = yield* Effect.try({
			try: () => ({
				name: EditorBoardScenarioNameSchema.parse(candidateName),
				bytes: new Uint8Array(candidateBytes),
			}),
			catch: (cause) =>
				createRepositoryError(
					"write-board-scenario",
					"The editor Board scenario is invalid.",
					cause,
				),
		});
		if (bytes.byteLength === 0) {
			return yield* Effect.fail(
				createRepositoryError(
					"write-board-scenario",
					"The editor Board scenario is empty.",
				),
			);
		}
		const nowMs = yield* Clock.currentTimeMillis;
		return yield* writeLock.withPermits(1)(
			Effect.try({
				try: () =>
					runTransaction(database, () => {
						const current = readProjectRow(
							selectProject,
							projectId,
							"write-board-scenario",
						);
						if (current === null) {
							throw createRepositoryError(
								"write-board-scenario",
								`Editor project ${projectId} does not exist.`,
							);
						}
						assertExpectedRevision(current, expectedRevision, "write-board-scenario");
						const previous = readBoardScenarioRow(
							selectBoardScenario.get(projectId, name),
							"write-board-scenario",
						);
						const createdAtMs = previous?.createdAtMs ?? nowMs;
						const updatedAtMs = Math.max(
							nowMs,
							(previous?.updatedAtMs ?? nowMs - 1) + 1,
						);
						upsertBoardScenario.run(
							projectId,
							name,
							current.revision,
							current.version,
							bytes,
							createdAtMs,
							updatedAtMs,
						);
						const written = readBoardScenarioRow(
							selectBoardScenario.get(projectId, name),
							"write-board-scenario",
						);
						if (written === null) throw new Error("The written scenario disappeared.");
						return written;
					}),
				catch: (cause) =>
					createRepositoryError(
						"write-board-scenario",
						`Board scenario ${name} could not be saved in project ${projectId}.`,
						cause,
					),
			}).pipe(Effect.uninterruptible),
		);
	});

	const deleteBoardScenarioFx: EditorProjectRepositoryService["deleteBoardScenarioFx"] =
		Effect.fn("SqliteEditorProjectRepository.deleteBoardScenarioFx")(({ projectId, name }) =>
			writeLock.withPermits(1)(
				Effect.try({
					try: () => deleteBoardScenario.run(projectId, name),
					catch: (cause) =>
						createRepositoryError(
							"delete-board-scenario",
							`Board scenario ${name} could not be deleted from project ${projectId}.`,
							cause,
						),
				}).pipe(Effect.asVoid, Effect.uninterruptible),
			),
		);

	let closed = false;
	const closeSync = () => {
		if (closed) return;
		closed = true;
		database.close();
	};
	return {
		awaitIdleFx: writeLock.withPermits(1)(Effect.void),
		createProjectFx,
		listProjectsFx,
		listBoardScenariosFx,
		readProjectFx,
		readBoardScenarioFx,
		replaceConfigFx,
		replaceResourceFx,
		upsertItemFx,
		upsertResourcesFx,
		writeBoardScenarioFx,
		deleteBoardScenarioFx,
		closeFx: writeLock.withPermits(1)(Effect.sync(closeSync)),
		closeSync,
	} satisfies SqliteEditorProjectRepository;
});
