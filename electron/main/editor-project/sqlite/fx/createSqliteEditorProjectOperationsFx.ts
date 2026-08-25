import type { DatabaseSync, StatementSync } from "node:sqlite";
import { Clock, Effect, type Semaphore } from "effect";

import type { EditorProject } from "~/editor/EditorProject";
import {
	EditorProjectRecordSchema,
	type EditorProjectRecordSchema as EditorProjectRecordSchemaType,
} from "~/editor/EditorProjectRecordSchema";
import type { EditorProjectRepositoryService } from "~/editor/EditorProjectRepository";
import {
	EditorProjectRepositoryError,
	type EditorProjectRepositoryOperation,
} from "~/editor/EditorProjectRepositoryError";
import {
	EditorProjectResourceRecordSchema,
	type EditorProjectResourceRecordSchema as EditorProjectResourceRecordSchemaType,
} from "~/editor/EditorProjectResourceRecordSchema";
import { ResourceSchema } from "~/engine/pack/schema/ResourceSchema";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { runSqliteEditorProjectTransactionFx } from "./runSqliteEditorProjectTransactionFx";
import { SqliteEditorProjectResourceRowSchema } from "../schema/SqliteEditorProjectResourceRowSchema";
import { SqliteEditorProjectRowSchema } from "../schema/SqliteEditorProjectRowSchema";

type ProjectOperations = Pick<
	EditorProjectRepositoryService,
	"createProjectFx" | "deleteProjectFx" | "listProjectsFx" | "readProjectFx"
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

export namespace createSqliteEditorProjectOperationsFx {
	export interface Props {
		readonly database: DatabaseSync;
		readonly writeLock: Semaphore.Semaphore;
	}
}

/** Creates project discovery and aggregate materialization over one SQLite authority. */
export const createSqliteEditorProjectOperationsFx = Effect.fn(
	"createSqliteEditorProjectOperationsFx",
)(function* ({ database, writeLock }: createSqliteEditorProjectOperationsFx.Props) {
	const {
		selectProject,
		listProjects,
		selectResources,
		insertProject,
		insertResource,
		deleteProject,
	} = yield* Effect.try({
		try: () => ({
			selectProject: database.prepare(`
					SELECT project_id, config_json, arkpack_version, revision, created_at_ms, updated_at_ms
					FROM projects
					WHERE project_id = ?
				`),
			listProjects: database.prepare(`
					SELECT project_id, config_json, arkpack_version, revision, created_at_ms, updated_at_ms
					FROM projects
					ORDER BY updated_at_ms DESC, project_id ASC
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
			insertResource: database.prepare(`
					INSERT INTO resources(project_id, id, mime, bytes)
					VALUES (?, ?, ?, ?)
				`),
			deleteProject: database.prepare(`
					DELETE FROM projects
					WHERE project_id = ?
				`),
		}),
		catch: (cause) =>
			createRepositoryError(
				"list-projects",
				"The editor project catalog schema is incompatible.",
				cause,
			),
	});

	const createProjectFx: ProjectOperations["createProjectFx"] = Effect.fn(
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
			runSqliteEditorProjectTransactionFx(database, () => {
				if (readProjectRow(selectProject, projectId, "create-project") !== null)
					throw createRepositoryError(
						"create-project",
						`Editor project ${projectId} already exists.`,
					);
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
				for (const resource of resourceRecords)
					insertResource.run(
						resource.projectId,
						resource.id,
						resource.mime,
						resource.bytes,
					);
				return materializeProject(record, resourceRecords);
			}).pipe(
				Effect.mapError((cause) =>
					createRepositoryError(
						"create-project",
						`Editor project ${projectId} could not be created.`,
						cause,
					),
				),
				Effect.uninterruptible,
			),
		);
	});

	const listProjectsFx: ProjectOperations["listProjectsFx"] = Effect.try({
		try: () =>
			listProjects.all().map((candidate) => {
				const result = SqliteEditorProjectRowSchema.safeParse(candidate);
				if (!result.success)
					throw createRepositoryError(
						"list-projects",
						"SQLite contains an invalid editor project record.",
						result.error,
					);
				const record = result.data;
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

	const deleteProjectFx: ProjectOperations["deleteProjectFx"] = Effect.fn(
		"SqliteEditorProjectRepository.deleteProjectFx",
	)((projectId) =>
		writeLock.withPermits(1)(
			runSqliteEditorProjectTransactionFx(database, () => {
				const result = deleteProject.run(projectId);
				if (Number(result.changes) === 0)
					throw createRepositoryError(
						"delete-project",
						`Editor project ${projectId} does not exist.`,
					);
			}).pipe(
				Effect.mapError((cause) =>
					createRepositoryError(
						"delete-project",
						`Editor project ${projectId} could not be deleted.`,
						cause,
					),
				),
				Effect.uninterruptible,
			),
		),
	);

	const readProjectFx: ProjectOperations["readProjectFx"] = Effect.fn(
		"SqliteEditorProjectRepository.readProjectFx",
	)((projectId) =>
		Effect.try({
			try: () => {
				const record = readProjectRow(selectProject, projectId, "read-project");
				return record === null
					? null
					: materializeProject(
							record,
							readResourceRows(selectResources, projectId, "read-project"),
						);
			},
			catch: (cause) =>
				createRepositoryError(
					"read-project",
					`Editor project ${projectId} could not be read.`,
					cause,
				),
		}),
	);

	return {
		createProjectFx,
		deleteProjectFx,
		listProjectsFx,
		readProjectFx,
	} satisfies ProjectOperations;
});
