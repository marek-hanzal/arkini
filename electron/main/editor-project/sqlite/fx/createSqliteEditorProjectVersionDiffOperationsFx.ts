import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { Effect, type Semaphore } from "effect";
import { z } from "zod";

import { EditorProjectRepositoryError } from "~/editor/EditorProjectRepositoryError";
import type { EditorProjectVersionRepositoryService } from "~/editor/version/EditorProjectVersion";
import {
	createEditorProjectVersionDiff,
	type EditorProjectVersionDiffSnapshot,
} from "~/editor/version/createEditorProjectVersionDiff";
import { readEditorProjectVersionApplicability } from "~/editor/version/readEditorProjectVersionApplicabilityFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { ArkiniVersionSchema } from "~/engine/version/schema/ArkiniVersionSchema";
import { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";

type DiffOperation = Pick<EditorProjectVersionRepositoryService, "diffVersionsFx">;

const currentProjectSchema = z
	.object({
		config_json: z.string(),
		arkpack_version: ArkpackVersionSchema,
	})
	.strict();
const versionProjectSchema = currentProjectSchema
	.extend({
		arkini: ArkiniVersionSchema,
		snapshot_format_version: z.number().int().positive(),
	})
	.strict();
const currentResourceSchema = z
	.object({
		id: z.string(),
		mime: z.string(),
		bytes: z.instanceof(Uint8Array),
	})
	.strict();
const versionResourceSchema = z
	.object({
		id: z.string(),
		mime: z.string(),
		blob_hash: z.string(),
	})
	.strict();
const currentScenarioSchema = z
	.object({
		id: z.string(),
		arkpack_version: ArkpackVersionSchema,
		bytes: z.instanceof(Uint8Array),
	})
	.strict();
const versionScenarioSchema = z
	.object({
		id: z.string(),
		arkpack_version: ArkpackVersionSchema,
		blob_hash: z.string(),
	})
	.strict();

const hashBytes = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

const createError = (message: string, cause?: unknown) =>
	cause instanceof EditorProjectRepositoryError
		? cause
		: new EditorProjectRepositoryError({
				operation: "diff-versions",
				message,
				cause,
			});

export namespace createSqliteEditorProjectVersionDiffOperationsFx {
	export interface Props {
		readonly database: DatabaseSync;
		readonly writeLock: Semaphore.Semaphore;
	}
}

/** Reads two consistent snapshots and exposes only their domain-aware structural changes. */
export const createSqliteEditorProjectVersionDiffOperationsFx = Effect.fn(
	"createSqliteEditorProjectVersionDiffOperationsFx",
)(function* ({ database, writeLock }: createSqliteEditorProjectVersionDiffOperationsFx.Props) {
	const statements = yield* Effect.try({
		try: () => ({
			currentProject: database.prepare(
				"SELECT config_json, arkpack_version FROM projects WHERE project_id = ?",
			),
			currentResources: database.prepare(
				"SELECT id, mime, bytes FROM resources WHERE project_id = ? ORDER BY id ASC",
			),
			currentScenarios: database.prepare(
				"SELECT name AS id, arkpack_version, save_bytes AS bytes FROM board_scenarios WHERE project_id = ? ORDER BY name ASC",
			),
			versionProject: database.prepare(`
				SELECT config_json, arkpack_version, arkini, snapshot_format_version
				FROM project_versions WHERE project_id = ? AND version_id = ?
			`),
			versionResources: database.prepare(`
				SELECT resource_id AS id, mime, blob_hash FROM project_version_resources
				WHERE project_id = ? AND version_id = ? ORDER BY resource_id ASC
			`),
			versionScenarios: database.prepare(`
				SELECT name AS id, arkpack_version, blob_hash FROM project_version_scenarios
				WHERE project_id = ? AND version_id = ? ORDER BY name ASC
			`),
		}),
		catch: (cause) => createError("The editor version diff schema is incompatible.", cause),
	});

	const readCurrent = (projectId: string): EditorProjectVersionDiffSnapshot => {
		const candidate = statements.currentProject.get(projectId);
		if (candidate === undefined)
			throw createError(`Editor project ${projectId} does not exist.`);
		const project = currentProjectSchema.parse(candidate);
		const resources = currentResourceSchema
			.array()
			.parse(statements.currentResources.all(projectId));
		const scenarios = currentScenarioSchema
			.array()
			.parse(statements.currentScenarios.all(projectId));
		return {
			config: GameConfigSchema.parse(JSON.parse(project.config_json)),
			arkpackVersion: project.arkpack_version,
			resources: new Map(
				resources.map(({ id, mime, bytes }) => [
					id,
					JSON.stringify([
						mime,
						hashBytes(bytes),
					]),
				]),
			),
			scenarios: new Map(
				scenarios.map(({ id, arkpack_version, bytes }) => [
					id,
					JSON.stringify([
						arkpack_version,
						hashBytes(bytes),
					]),
				]),
			),
		};
	};

	const readVersion = (
		projectId: string,
		versionId: string,
	): EditorProjectVersionDiffSnapshot => {
		const candidate = statements.versionProject.get(projectId, versionId);
		if (candidate === undefined)
			throw createError(`Version ${versionId} does not exist in project ${projectId}.`);
		const project = versionProjectSchema.parse(candidate);
		const applicability = readEditorProjectVersionApplicability(project.arkini);
		if (applicability.type === "incompatible") throw createError(applicability.reason);
		const resources = versionResourceSchema
			.array()
			.parse(statements.versionResources.all(projectId, versionId));
		const scenarios = versionScenarioSchema
			.array()
			.parse(statements.versionScenarios.all(projectId, versionId));
		return {
			config: GameConfigSchema.parse(JSON.parse(project.config_json)),
			arkpackVersion: project.arkpack_version,
			resources: new Map(
				resources.map(({ id, mime, blob_hash }) => [
					id,
					JSON.stringify([
						mime,
						blob_hash,
					]),
				]),
			),
			scenarios: new Map(
				scenarios.map(({ id, arkpack_version, blob_hash }) => [
					id,
					JSON.stringify([
						arkpack_version,
						blob_hash,
					]),
				]),
			),
		};
	};

	const diffVersionsFx: DiffOperation["diffVersionsFx"] = Effect.fn(
		"SqliteEditorProjectRepository.diffVersionsFx",
	)(({ from, projectId, to }) =>
		writeLock.withPermits(1)(
			Effect.try({
				try: () =>
					createEditorProjectVersionDiff(
						from,
						to,
						from.type === "current"
							? readCurrent(projectId)
							: readVersion(projectId, from.versionId),
						to.type === "current"
							? readCurrent(projectId)
							: readVersion(projectId, to.versionId),
					),
				catch: (cause) =>
					createError(`Versions for project ${projectId} could not be compared.`, cause),
			}),
		),
	);

	return {
		diffVersionsFx,
	} satisfies DiffOperation;
});
