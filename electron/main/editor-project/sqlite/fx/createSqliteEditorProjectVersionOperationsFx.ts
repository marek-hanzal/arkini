import { createHash } from "node:crypto";
import type { DatabaseSync, StatementSync } from "node:sqlite";
import { createId } from "@paralleldrive/cuid2";
import { Clock, Effect, type Semaphore } from "effect";
import { z } from "zod";

import { ArkiniAppVersion } from "../../../../../shared/ArkiniAppMetadata";
import type { EditorProject } from "~/editor/EditorProject";
import {
	EditorProjectRepositoryError,
	type EditorProjectRepositoryOperation,
} from "~/editor/EditorProjectRepositoryError";
import type { EditorProjectResourceRecordSchema } from "~/editor/EditorProjectResourceRecordSchema";
import type { EditorBoardScenarioSchema } from "~/editor/board/EditorBoardScenarioSchema";
import type {
	EditorProjectVersionDescriptor,
	EditorProjectVersionRepositoryService,
	EditorProjectVersionStatus,
} from "~/editor/version/EditorProjectVersion";
import {
	EditorProjectSnapshotFormatVersion,
	EditorProjectVersionBodySchema,
	EditorProjectVersionSubjectSchema,
	EditorProjectVersionTagSchema,
} from "~/editor/version/EditorProjectVersionMetadataSchema";
import { readEditorProjectVersionApplicability } from "~/editor/version/readEditorProjectVersionApplicabilityFx";
import { ArkiniVersionSchema } from "~/engine/version/schema/ArkiniVersionSchema";
import { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { ResourceSchema } from "~/engine/pack/schema/ResourceSchema";
import { runSqliteEditorProjectTransactionFx } from "./runSqliteEditorProjectTransactionFx";
import { SqliteEditorBoardScenarioRowSchema } from "../schema/SqliteEditorBoardScenarioRowSchema";
import { SqliteEditorProjectResourceRowSchema } from "../schema/SqliteEditorProjectResourceRowSchema";
import { SqliteEditorProjectRowSchema } from "../schema/SqliteEditorProjectRowSchema";

type VersionOperations = Omit<EditorProjectVersionRepositoryService, "diffVersionsFx">;

const versionRowSchema = z
	.object({
		project_id: z.string(),
		version_id: z.string(),
		parent_version_id: z.string().nullable(),
		subject: z.string(),
		body: z.string().nullable(),
		tag: z.string().nullable(),
		arkini: ArkiniVersionSchema,
		arkpack_version: ArkpackVersionSchema,
		source_revision: z.number().int().nonnegative(),
		snapshot_format_version: z.number().int().positive(),
		config_json: z.string(),
		content_fingerprint: z.string(),
		created_at_ms: z.number().int().nonnegative(),
	})
	.strict()
	.transform((row) => ({
		projectId: row.project_id,
		versionId: row.version_id,
		parentVersionId: row.parent_version_id ?? undefined,
		subject: row.subject,
		body: row.body ?? undefined,
		tag: row.tag ?? undefined,
		arkini: row.arkini,
		arkpackVersion: row.arkpack_version,
		sourceRevision: row.source_revision,
		snapshotFormatVersion: row.snapshot_format_version,
		configJson: row.config_json,
		contentFingerprint: row.content_fingerprint,
		createdAtMs: row.created_at_ms,
	}));

type VersionRow = z.infer<typeof versionRowSchema>;

const versionResourceRowSchema = z
	.object({
		resource_id: z.string(),
		mime: z.string(),
		bytes: z.instanceof(Uint8Array),
	})
	.strict()
	.transform((row) =>
		ResourceSchema.parse({
			id: row.resource_id,
			mime: row.mime,
			bytes: Uint8Array.from(row.bytes),
		}),
	);

const versionScenarioRowSchema = z
	.object({
		name: z.string(),
		project_revision: z.number().int().nonnegative(),
		arkpack_version: ArkpackVersionSchema,
		bytes: z.instanceof(Uint8Array),
		created_at_ms: z.number().int().nonnegative(),
		updated_at_ms: z.number().int().nonnegative(),
	})
	.strict()
	.refine((row) => row.updated_at_ms >= row.created_at_ms)
	.transform((row) => ({
		name: row.name,
		version: row.arkpack_version,
		bytes: Uint8Array.from(row.bytes),
		createdAtMs: row.created_at_ms,
		updatedAtMs: row.updated_at_ms,
	}));

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

const hashBytes = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const hashText = (value: string) => createHash("sha256").update(value).digest("hex");

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
		"SQLite contains an invalid editor project.",
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
		"SQLite contains invalid editor resources.",
		result.error,
	);
};

const readScenarioRows = (
	statement: StatementSync,
	projectId: string,
	operation: EditorProjectRepositoryOperation,
) => {
	const result = SqliteEditorBoardScenarioRowSchema.array().safeParse(statement.all(projectId));
	if (result.success) return result.data;
	throw createRepositoryError(
		operation,
		"SQLite contains invalid Board scenarios.",
		result.error,
	);
};

const readVersionRow = (
	statement: StatementSync,
	projectId: string,
	versionId: string,
	operation: EditorProjectRepositoryOperation,
) => {
	const candidate = statement.get(projectId, versionId);
	if (candidate === undefined) return null;
	const result = versionRowSchema.safeParse(candidate);
	if (result.success) return result.data;
	throw createRepositoryError(
		operation,
		"SQLite contains an invalid editor version.",
		result.error,
	);
};

const materializeDescriptor = (row: VersionRow): EditorProjectVersionDescriptor => ({
	applicability: readEditorProjectVersionApplicability(row.arkini),
	arkini: row.arkini,
	arkpackVersion: row.arkpackVersion,
	...(row.body === undefined
		? {}
		: {
				body: row.body,
			}),
	createdAtMs: row.createdAtMs,
	...(row.parentVersionId === undefined
		? {}
		: {
				parentVersionId: row.parentVersionId,
			}),
	projectId: row.projectId,
	snapshotFormatVersion: row.snapshotFormatVersion,
	sourceRevision: row.sourceRevision,
	subject: row.subject,
	...(row.tag === undefined
		? {}
		: {
				tag: row.tag,
			}),
	versionId: row.versionId,
});

const createFingerprint = (
	version: string,
	config: unknown,
	resources: ReadonlyArray<EditorProjectResourceRecordSchema.Type>,
	scenarios: ReadonlyArray<EditorBoardScenarioSchema.Type>,
) =>
	hashText(
		JSON.stringify({
			arkini: ArkiniAppVersion,
			version,
			config,
			resources: resources.map(({ id, mime, bytes }) => ({
				id,
				mime,
				hash: hashBytes(bytes),
			})),
			scenarios: scenarios.map(({ name, version: scenarioVersion, bytes }) => ({
				name,
				version: scenarioVersion,
				hash: hashBytes(bytes),
			})),
		}),
	);

const materializeProject = (
	project: z.infer<typeof SqliteEditorProjectRowSchema>,
	resources: ReadonlyArray<EditorProjectResourceRecordSchema.Type>,
): EditorProject => ({
	projectId: project.projectId,
	title: project.config.meta.title,
	version: project.version,
	createdAtMs: project.createdAtMs,
	updatedAtMs: project.updatedAtMs,
	revision: project.revision,
	config: project.config,
	resources: resources.map(({ id, mime, bytes }) => ({
		id,
		mime,
		bytes,
	})),
});

export namespace createSqliteEditorProjectVersionOperationsFx {
	export interface Props {
		readonly database: DatabaseSync;
		readonly writeLock: Semaphore.Semaphore;
	}
}

/** Owns immutable project snapshots and exact full-project checkout. */
export const createSqliteEditorProjectVersionOperationsFx = Effect.fn(
	"createSqliteEditorProjectVersionOperationsFx",
)(function* ({ database, writeLock }: createSqliteEditorProjectVersionOperationsFx.Props) {
	const statements = yield* Effect.try({
		try: () => ({
			selectProject: database.prepare(`
				SELECT project_id, config_json, arkpack_version, revision, created_at_ms, updated_at_ms
				FROM projects WHERE project_id = ?
			`),
			selectResources: database.prepare(`
				SELECT project_id, id, mime, bytes FROM resources
				WHERE project_id = ? ORDER BY id ASC
			`),
			selectScenarios: database.prepare(`
				SELECT project_id, name, project_revision, arkpack_version, save_bytes,
					created_at_ms, updated_at_ms
				FROM board_scenarios WHERE project_id = ? ORDER BY name ASC
			`),
			selectBase: database.prepare(
				"SELECT version_id FROM project_version_bases WHERE project_id = ?",
			),
			countVersions: database.prepare(
				"SELECT COUNT(*) AS count FROM project_versions WHERE project_id = ?",
			),
			selectLatestCreatedAt: database.prepare(
				"SELECT MAX(created_at_ms) AS created_at_ms FROM project_versions WHERE project_id = ?",
			),
			selectVersion: database.prepare(`
				SELECT project_id, version_id, parent_version_id, subject, body, tag, arkini,
					arkpack_version, source_revision, snapshot_format_version, config_json,
					content_fingerprint, created_at_ms
				FROM project_versions WHERE project_id = ? AND version_id = ?
			`),
			listVersions: database.prepare(`
				SELECT project_id, version_id, parent_version_id, subject, body, tag, arkini,
					arkpack_version, source_revision, snapshot_format_version, config_json,
					content_fingerprint, created_at_ms
				FROM project_versions WHERE project_id = ?
				ORDER BY created_at_ms DESC, version_id DESC
			`),
			insertBlob: database.prepare(`
				INSERT OR IGNORE INTO project_version_blobs(project_id, content_hash, bytes)
				VALUES (?, ?, ?)
			`),
			insertVersion: database.prepare(`
				INSERT INTO project_versions(
					project_id, version_id, parent_version_id, subject, body, tag, arkini,
					arkpack_version, source_revision, snapshot_format_version, config_json,
					content_fingerprint, created_at_ms
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`),
			insertVersionResource: database.prepare(`
				INSERT INTO project_version_resources(
					project_id, version_id, resource_id, mime, blob_hash
				) VALUES (?, ?, ?, ?, ?)
			`),
			insertVersionScenario: database.prepare(`
				INSERT INTO project_version_scenarios(
					project_id, version_id, name, project_revision, arkpack_version, blob_hash,
					created_at_ms, updated_at_ms
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			`),
			upsertBase: database.prepare(`
				INSERT INTO project_version_bases(project_id, version_id) VALUES (?, ?)
				ON CONFLICT(project_id) DO UPDATE SET version_id = excluded.version_id
			`),
			selectVersionResources: database.prepare(`
				SELECT r.resource_id, r.mime, b.bytes
				FROM project_version_resources r
				JOIN project_version_blobs b
					ON b.project_id = r.project_id AND b.content_hash = r.blob_hash
				WHERE r.project_id = ? AND r.version_id = ? ORDER BY r.resource_id ASC
			`),
			selectVersionScenarios: database.prepare(`
				SELECT s.name, s.project_revision, s.arkpack_version, b.bytes,
					s.created_at_ms, s.updated_at_ms
				FROM project_version_scenarios s
				JOIN project_version_blobs b
					ON b.project_id = s.project_id AND b.content_hash = s.blob_hash
				WHERE s.project_id = ? AND s.version_id = ? ORDER BY s.name ASC
			`),
			updateProject: database.prepare(`
				UPDATE projects SET config_json = ?, arkpack_version = ?, revision = ?, updated_at_ms = ?
				WHERE project_id = ?
			`),
			deleteResources: database.prepare("DELETE FROM resources WHERE project_id = ?"),
			insertResource: database.prepare(
				"INSERT INTO resources(project_id, id, mime, bytes) VALUES (?, ?, ?, ?)",
			),
			deleteScenarios: database.prepare("DELETE FROM board_scenarios WHERE project_id = ?"),
			insertScenario: database.prepare(`
				INSERT INTO board_scenarios(
					project_id, name, project_revision, arkpack_version, save_bytes,
					created_at_ms, updated_at_ms
				) VALUES (?, ?, ?, ?, ?, ?, ?)
			`),
			updateTag: database.prepare(`
				UPDATE project_versions SET tag = ? WHERE project_id = ? AND version_id = ?
			`),
		}),
		catch: (cause) =>
			createRepositoryError(
				"list-versions",
				"The editor version schema is incompatible.",
				cause,
			),
	});

	const readCurrent = (projectId: string, operation: EditorProjectRepositoryOperation) => {
		const project = readProjectRow(statements.selectProject, projectId, operation);
		if (project === null)
			throw createRepositoryError(operation, `Editor project ${projectId} does not exist.`);
		const resources = readResourceRows(statements.selectResources, projectId, operation);
		const scenarios = readScenarioRows(statements.selectScenarios, projectId, operation);
		return {
			project,
			resources,
			scenarios,
			fingerprint: createFingerprint(project.version, project.config, resources, scenarios),
		};
	};

	const readBaseId = (projectId: string) => {
		const row = statements.selectBase.get(projectId);
		return typeof row?.version_id === "string" ? row.version_id : undefined;
	};

	const readStatus = (projectId: string): EditorProjectVersionStatus => {
		const current = readCurrent(projectId, "read-version-status");
		const currentBaseVersionId = readBaseId(projectId);
		const base =
			currentBaseVersionId === undefined
				? null
				: readVersionRow(
						statements.selectVersion,
						projectId,
						currentBaseVersionId,
						"read-version-status",
					);
		if (currentBaseVersionId !== undefined && base === null)
			throw createRepositoryError(
				"read-version-status",
				"The editor version base points to a missing snapshot.",
			);
		const dirty = base === null || base.contentFingerprint !== current.fingerprint;
		const count = statements.countVersions.get(projectId)?.count;
		return {
			canCommit: dirty,
			...(currentBaseVersionId === undefined
				? {}
				: {
						currentBaseVersionId,
					}),
			currentFingerprint: current.fingerprint,
			dirty,
			versionCount: typeof count === "number" ? count : 0,
		};
	};

	const listVersionsFx: VersionOperations["listVersionsFx"] = Effect.fn(
		"SqliteEditorProjectRepository.listVersionsFx",
	)((projectId) =>
		Effect.try({
			try: () => {
				readCurrent(projectId, "list-versions");
				return statements.listVersions.all(projectId).map((candidate) => {
					const result = versionRowSchema.safeParse(candidate);
					if (result.success) return materializeDescriptor(result.data);
					throw createRepositoryError(
						"list-versions",
						"SQLite contains invalid editor version metadata.",
						result.error,
					);
				});
			},
			catch: (cause) =>
				createRepositoryError(
					"list-versions",
					`Versions for project ${projectId} could not be listed.`,
					cause,
				),
		}),
	);

	const readVersionStatusFx: VersionOperations["readVersionStatusFx"] = Effect.fn(
		"SqliteEditorProjectRepository.readVersionStatusFx",
	)((projectId) =>
		Effect.try({
			try: () => readStatus(projectId),
			catch: (cause) =>
				createRepositoryError(
					"read-version-status",
					`Version status for project ${projectId} could not be read.`,
					cause,
				),
		}),
	);

	const createVersionFx: VersionOperations["createVersionFx"] = Effect.fn(
		"SqliteEditorProjectRepository.createVersionFx",
	)(function* ({
		body: bodyCandidate,
		expectedFingerprint,
		projectId,
		subject: subjectCandidate,
		tag: tagCandidate,
	}) {
		const subject = yield* Effect.try({
			try: () => EditorProjectVersionSubjectSchema.parse(subjectCandidate),
			catch: (cause) =>
				createRepositoryError("create-version", "The version subject is invalid.", cause),
		});
		const body =
			bodyCandidate === undefined
				? undefined
				: yield* Effect.try({
						try: () => EditorProjectVersionBodySchema.parse(bodyCandidate),
						catch: (cause) =>
							createRepositoryError(
								"create-version",
								"The version body is invalid.",
								cause,
							),
					});
		const tag =
			tagCandidate === undefined
				? undefined
				: yield* Effect.try({
						try: () => EditorProjectVersionTagSchema.parse(tagCandidate),
						catch: (cause) =>
							createRepositoryError(
								"create-version",
								"The version tag is invalid.",
								cause,
							),
					});
		const clockMs = yield* Clock.currentTimeMillis;
		const versionId = createId();
		return yield* writeLock.withPermits(1)(
			runSqliteEditorProjectTransactionFx(database, () => {
				const current = readCurrent(projectId, "create-version");
				const latestCreatedAt =
					statements.selectLatestCreatedAt.get(projectId)?.created_at_ms;
				const createdAtMs =
					typeof latestCreatedAt === "number"
						? Math.max(clockMs, latestCreatedAt + 1)
						: clockMs;
				if (
					expectedFingerprint !== undefined &&
					expectedFingerprint !== current.fingerprint
				)
					throw createRepositoryError(
						"create-version",
						"The editor project changed after its version preview was read.",
					);
				const parentVersionId = readBaseId(projectId);
				const parent =
					parentVersionId === undefined
						? null
						: readVersionRow(
								statements.selectVersion,
								projectId,
								parentVersionId,
								"create-version",
							);
				if (parentVersionId !== undefined && parent === null)
					throw createRepositoryError(
						"create-version",
						"The current version base is missing.",
					);
				if (parent?.contentFingerprint === current.fingerprint)
					throw createRepositoryError(
						"create-version",
						"The editor project has no changes to commit.",
					);
				statements.insertVersion.run(
					projectId,
					versionId,
					parentVersionId ?? null,
					subject,
					body ?? null,
					tag ?? null,
					ArkiniAppVersion,
					current.project.version,
					current.project.revision,
					EditorProjectSnapshotFormatVersion,
					JSON.stringify(current.project.config),
					current.fingerprint,
					createdAtMs,
				);
				for (const resource of current.resources) {
					const blobHash = hashBytes(resource.bytes);
					statements.insertBlob.run(projectId, blobHash, resource.bytes);
					statements.insertVersionResource.run(
						projectId,
						versionId,
						resource.id,
						resource.mime,
						blobHash,
					);
				}
				for (const scenario of current.scenarios) {
					const blobHash = hashBytes(scenario.bytes);
					statements.insertBlob.run(projectId, blobHash, scenario.bytes);
					statements.insertVersionScenario.run(
						projectId,
						versionId,
						scenario.name,
						scenario.projectRevision,
						scenario.version,
						blobHash,
						scenario.createdAtMs,
						scenario.updatedAtMs,
					);
				}
				statements.upsertBase.run(projectId, versionId);
				const created = readVersionRow(
					statements.selectVersion,
					projectId,
					versionId,
					"create-version",
				);
				if (created === null)
					throw createRepositoryError(
						"create-version",
						"The committed version is missing.",
					);
				return materializeDescriptor(created);
			}).pipe(
				Effect.mapError((cause) =>
					createRepositoryError(
						"create-version",
						`Project ${projectId} could not create a version.`,
						cause,
					),
				),
				Effect.uninterruptible,
			),
		);
	});

	const checkoutVersionFx: VersionOperations["checkoutVersionFx"] = Effect.fn(
		"SqliteEditorProjectRepository.checkoutVersionFx",
	)(function* ({ expectedFingerprint, projectId, versionId }) {
		const nowMs = yield* Clock.currentTimeMillis;
		return yield* writeLock.withPermits(1)(
			runSqliteEditorProjectTransactionFx(database, () => {
				const current = readCurrent(projectId, "checkout-version");
				if (
					expectedFingerprint !== undefined &&
					expectedFingerprint !== current.fingerprint
				)
					throw createRepositoryError(
						"checkout-version",
						"The editor project changed after its checkout preview was read.",
					);
				const version = readVersionRow(
					statements.selectVersion,
					projectId,
					versionId,
					"checkout-version",
				);
				if (version === null)
					throw createRepositoryError(
						"checkout-version",
						`Version ${versionId} does not exist in project ${projectId}.`,
					);
				const applicability = readEditorProjectVersionApplicability(version.arkini);
				if (applicability.type === "incompatible")
					throw createRepositoryError("checkout-version", applicability.reason);
				const config = GameConfigSchema.parse(JSON.parse(version.configJson));
				const resources = versionResourceRowSchema
					.array()
					.parse(statements.selectVersionResources.all(projectId, versionId));
				const scenarios = versionScenarioRowSchema
					.array()
					.parse(statements.selectVersionScenarios.all(projectId, versionId));
				const nextRevision = current.project.revision + 1;
				const updatedAtMs = Math.max(nowMs, current.project.updatedAtMs + 1);
				statements.updateProject.run(
					JSON.stringify(config),
					version.arkpackVersion,
					nextRevision,
					updatedAtMs,
					projectId,
				);
				statements.deleteResources.run(projectId);
				for (const resource of resources)
					statements.insertResource.run(
						projectId,
						resource.id,
						resource.mime,
						resource.bytes,
					);
				statements.deleteScenarios.run(projectId);
				for (const scenario of scenarios)
					statements.insertScenario.run(
						projectId,
						scenario.name,
						nextRevision,
						scenario.version,
						scenario.bytes,
						scenario.createdAtMs,
						scenario.updatedAtMs,
					);
				statements.upsertBase.run(projectId, versionId);
				const restored = readProjectRow(
					statements.selectProject,
					projectId,
					"checkout-version",
				);
				if (restored === null)
					throw createRepositoryError(
						"checkout-version",
						"The restored project is missing.",
					);
				return {
					project: materializeProject(
						restored,
						readResourceRows(statements.selectResources, projectId, "checkout-version"),
					),
					version: materializeDescriptor(version),
				};
			}).pipe(
				Effect.mapError((cause) =>
					createRepositoryError(
						"checkout-version",
						`Version ${versionId} could not be checked out.`,
						cause,
					),
				),
				Effect.uninterruptible,
			),
		);
	});

	const updateVersionTagFx: VersionOperations["updateVersionTagFx"] = Effect.fn(
		"SqliteEditorProjectRepository.updateVersionTagFx",
	)(function* ({ projectId, tag: tagCandidate, versionId }) {
		const tag =
			tagCandidate === undefined
				? undefined
				: yield* Effect.try({
						try: () => EditorProjectVersionTagSchema.parse(tagCandidate),
						catch: (cause) =>
							createRepositoryError(
								"update-version-tag",
								"The version tag is invalid.",
								cause,
							),
					});
		return yield* writeLock.withPermits(1)(
			runSqliteEditorProjectTransactionFx(database, () => {
				const version = readVersionRow(
					statements.selectVersion,
					projectId,
					versionId,
					"update-version-tag",
				);
				if (version === null)
					throw createRepositoryError(
						"update-version-tag",
						`Version ${versionId} does not exist.`,
					);
				const applicability = readEditorProjectVersionApplicability(version.arkini);
				if (applicability.type === "incompatible")
					throw createRepositoryError("update-version-tag", applicability.reason);
				statements.updateTag.run(tag ?? null, projectId, versionId);
				const updated = readVersionRow(
					statements.selectVersion,
					projectId,
					versionId,
					"update-version-tag",
				);
				if (updated === null)
					throw createRepositoryError(
						"update-version-tag",
						"The updated version is missing.",
					);
				return materializeDescriptor(updated);
			}).pipe(
				Effect.mapError((cause) =>
					createRepositoryError(
						"update-version-tag",
						`Version ${versionId} could not update its tag.`,
						cause,
					),
				),
				Effect.uninterruptible,
			),
		);
	});

	return {
		checkoutVersionFx,
		createVersionFx,
		listVersionsFx,
		readVersionStatusFx,
		updateVersionTagFx,
	} satisfies VersionOperations;
});
