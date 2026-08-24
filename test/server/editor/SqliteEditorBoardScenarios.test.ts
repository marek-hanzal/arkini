import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	createSqliteEditorProjectRepositoryFx,
	type SqliteEditorProjectRepository,
} from "../../../server/editor/createSqliteEditorProjectRepositoryFx";
import { editorTestPayload } from "../../editor/support/editorTestPayload";

let temporaryDirectory = "";
let databasePath = "";
const openRepositories = new Set<SqliteEditorProjectRepository>();

const openRepository = async () => {
	const repository = await Effect.runPromise(
		createSqliteEditorProjectRepositoryFx({
			databasePath,
		}),
	);
	openRepositories.add(repository);
	return repository;
};

const closeRepository = async (repository: SqliteEditorProjectRepository) => {
	await Effect.runPromise(repository.closeFx);
	openRepositories.delete(repository);
};

const createProject = (repository: SqliteEditorProjectRepository, projectId = "project-one") =>
	Effect.runPromise(
		repository.createProjectFx({
			projectId,
			version: "1.0",
			config: editorTestPayload.config,
			resources: editorTestPayload.resources,
		}),
	);

beforeEach(async () => {
	temporaryDirectory = await mkdtemp(join(tmpdir(), "arkini-board-scenarios-"));
	databasePath = join(temporaryDirectory, "projects.sqlite");
});

afterEach(async () => {
	for (const repository of openRepositories) await closeRepository(repository);
	await rm(temporaryDirectory, {
		force: true,
		recursive: true,
	});
});

describe("SQLite editor Board scenarios", () => {
	it("persists explicit named slots without mutating the project revision", async () => {
		const repository = await openRepository();
		const project = await createProject(repository);
		const first = await Effect.runPromise(
			repository.writeBoardScenarioFx({
				projectId: project.projectId,
				expectedRevision: project.revision,
				name: "Opening",
				bytes: new Uint8Array([
					1,
					2,
				]),
			}),
		);
		const overwritten = await Effect.runPromise(
			repository.writeBoardScenarioFx({
				projectId: project.projectId,
				expectedRevision: project.revision,
				name: "Opening",
				bytes: new Uint8Array([
					3,
				]),
			}),
		);

		expect(overwritten).toMatchObject({
			projectId: project.projectId,
			name: "Opening",
			projectRevision: 0,
			version: "1.0",
			createdAtMs: first.createdAtMs,
		});
		expect(overwritten.updatedAtMs).toBeGreaterThan(first.updatedAtMs);
		expect(overwritten.bytes).toEqual(
			new Uint8Array([
				3,
			]),
		);
		expect(
			(await Effect.runPromise(repository.readProjectFx(project.projectId)))?.revision,
		).toBe(0);
		await closeRepository(repository);

		const reopened = await openRepository();
		expect(await Effect.runPromise(reopened.listBoardScenariosFx(project.projectId))).toEqual([
			{
				projectId: project.projectId,
				name: "Opening",
				projectRevision: 0,
				version: "1.0",
				createdAtMs: first.createdAtMs,
				updatedAtMs: overwritten.updatedAtMs,
			},
		]);
		expect(
			(
				await Effect.runPromise(
					reopened.readBoardScenarioFx({
						projectId: project.projectId,
						name: "Opening",
					}),
				)
			)?.bytes,
		).toEqual(
			new Uint8Array([
				3,
			]),
		);
		await Effect.runPromise(
			reopened.deleteBoardScenarioFx({
				projectId: project.projectId,
				name: "Opening",
			}),
		);
		expect(await Effect.runPromise(reopened.listBoardScenariosFx(project.projectId))).toEqual(
			[],
		);
	});

	it("preserves slots for minor changes and atomically drops them for a major change", async () => {
		const repository = await openRepository();
		const project = await createProject(repository);
		await Effect.runPromise(
			repository.writeBoardScenarioFx({
				projectId: project.projectId,
				expectedRevision: project.revision,
				name: "Before change",
				bytes: new Uint8Array([
					1,
				]),
			}),
		);
		const minor = await Effect.runPromise(
			repository.replaceConfigFx({
				projectId: project.projectId,
				expectedRevision: project.revision,
				config: {
					...project.config,
					meta: {
						...project.config.meta,
						title: "Compatible title",
					},
				},
			}),
		);
		expect(
			await Effect.runPromise(repository.listBoardScenariosFx(project.projectId)),
		).toHaveLength(1);
		await expect(
			Effect.runPromise(
				repository.writeBoardScenarioFx({
					projectId: project.projectId,
					expectedRevision: project.revision,
					name: "Stale",
					bytes: new Uint8Array([
						2,
					]),
				}),
			),
		).rejects.toThrow("changed from revision 0 to 1");

		const major = await Effect.runPromise(
			repository.replaceConfigFx({
				projectId: project.projectId,
				expectedRevision: minor.revision,
				config: {
					...minor.config,
					items: {},
				},
			}),
		);
		expect(major.version).toBe("2.0");
		expect(await Effect.runPromise(repository.listBoardScenariosFx(project.projectId))).toEqual(
			[],
		);
	});

	it("rolls back a major project commit when its scenario purge fails", async () => {
		const repository = await openRepository();
		const project = await createProject(repository);
		await Effect.runPromise(
			repository.writeBoardScenarioFx({
				projectId: project.projectId,
				expectedRevision: project.revision,
				name: "Protected",
				bytes: Uint8Array.of(1),
			}),
		);
		await closeRepository(repository);
		const database = new DatabaseSync(databasePath);
		database.exec(`
			CREATE TRIGGER reject_board_scenario_purge
			BEFORE DELETE ON board_scenarios
			BEGIN
				SELECT RAISE(ABORT, 'scenario purge rejected');
			END;
		`);
		database.close();

		const reopened = await openRepository();
		await expect(
			Effect.runPromise(
				reopened.replaceConfigFx({
					projectId: project.projectId,
					expectedRevision: project.revision,
					config: {
						...project.config,
						items: {},
					},
				}),
			),
		).rejects.toThrow("configuration could not be saved");
		expect(await Effect.runPromise(reopened.readProjectFx(project.projectId))).toEqual(project);
		expect(
			await Effect.runPromise(reopened.listBoardScenariosFx(project.projectId)),
		).toHaveLength(1);
	});

	it("upgrades a v2 database without dropping its projects", async () => {
		const repository = await openRepository();
		const project = await createProject(repository);
		await closeRepository(repository);
		const database = new DatabaseSync(databasePath);
		database.exec("DROP TABLE board_scenarios; PRAGMA user_version = 2;");
		database.close();

		const upgraded = await openRepository();
		expect(await Effect.runPromise(upgraded.readProjectFx(project.projectId))).toEqual(project);
		expect(await Effect.runPromise(upgraded.listBoardScenariosFx(project.projectId))).toEqual(
			[],
		);
	});
});
