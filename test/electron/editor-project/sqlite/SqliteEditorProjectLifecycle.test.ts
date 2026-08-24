import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Cause, Effect, Exit } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createSqliteEditorProjectRepositoryFx } from "../../../../electron/main/editor-project/sqlite/fx/createSqliteEditorProjectRepositoryFx";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";
import {
	createSqliteEditorProjectTestHarness,
	type SqliteEditorProjectTestHarness,
} from "./support/createSqliteEditorProjectTestHarness";

let harness: SqliteEditorProjectTestHarness;

beforeEach(async () => (harness = await createSqliteEditorProjectTestHarness("arkini-project-")));
afterEach(async () => harness.close());

describe("SQLite editor-project lifecycle", () => {
	it("migrates legacy config.version into the project-owned arkpack version", async () => {
		const databasePath = join(harness.temporaryDirectory, "legacy.sqlite");
		harness.setDatabasePath(databasePath);
		const database = new DatabaseSync(databasePath);
		database.exec(`
			CREATE TABLE projects (
				project_id TEXT PRIMARY KEY NOT NULL,
				config_json TEXT NOT NULL,
				revision INTEGER NOT NULL,
				created_at_ms INTEGER NOT NULL,
				updated_at_ms INTEGER NOT NULL
			) STRICT;
			CREATE TABLE resources (
				project_id TEXT NOT NULL,
				id TEXT NOT NULL,
				mime TEXT NOT NULL,
				bytes BLOB NOT NULL,
				PRIMARY KEY (project_id, id)
			) STRICT;
			PRAGMA user_version = 1;
		`);
		database
			.prepare(
				"INSERT INTO projects(project_id, config_json, revision, created_at_ms, updated_at_ms) VALUES (?, ?, 0, 1, 1)",
			)
			.run(
				"legacy",
				JSON.stringify({
					...editorTestPayload.config,
					version: "1.0",
				}),
			);
		database.close();

		const repository = await harness.openRepository();
		const project = await Effect.runPromise(repository.readProjectFx("legacy"));
		expect(project?.version).toBe("1.0");
		expect(project?.config).not.toHaveProperty("version");
	});

	it("creates, reads, orders and reopens canonical projects", async () => {
		const repository = await harness.openRepository();
		const first = await harness.createProject(repository, "project-b");
		const second = await harness.createProject(repository, "project-a");
		const changed = await Effect.runPromise(
			repository.replaceConfigFx({
				projectId: first.projectId,
				expectedRevision: first.revision,
				config: {
					...first.config,
					meta: {
						...first.config.meta,
						title: "Most recent",
					},
				},
			}),
		);
		expect(changed.updatedAtMs).toBeGreaterThan(first.updatedAtMs);
		expect(await Effect.runPromise(repository.readProjectFx("missing"))).toBeNull();
		await harness.closeRepository(repository);
		const tiedUpdatedAtMs = Math.max(changed.updatedAtMs, second.updatedAtMs);
		const database = new DatabaseSync(harness.databasePath);
		database.prepare("UPDATE projects SET updated_at_ms = ?").run(tiedUpdatedAtMs);
		database.close();

		const reopened = await harness.openRepository();
		const listed = await Effect.runPromise(reopened.listProjectsFx);
		expect(listed.map(({ projectId }) => projectId)).toEqual([
			"project-a",
			"project-b",
		]);
		expect(await Effect.runPromise(reopened.readProjectFx(second.projectId))).toEqual({
			...second,
			updatedAtMs: tiedUpdatedAtMs,
		});
	});

	it("rejects corrupt persisted config instead of publishing invalid state", async () => {
		const repository = await harness.openRepository();
		await harness.createProject(repository);
		await harness.closeRepository(repository);
		const database = new DatabaseSync(harness.databasePath);
		database
			.prepare("UPDATE projects SET config_json = ? WHERE project_id = ?")
			.run("{}", "project-one");
		database.close();

		const reopened = await harness.openRepository();
		await expect(Effect.runPromise(reopened.readProjectFx("project-one"))).rejects.toThrow(
			"invalid editor project record",
		);
	});

	it("reports a versioned but damaged schema as a typed initialization failure", async () => {
		const repository = await harness.openRepository();
		await harness.closeRepository(repository);
		const database = new DatabaseSync(harness.databasePath);
		database.exec("DROP TABLE projects");
		database.close();

		const exit = await Effect.runPromiseExit(
			createSqliteEditorProjectRepositoryFx({
				databasePath: harness.databasePath,
			}),
		);
		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isSuccess(exit))
			throw new Error("Expected damaged schema initialization failure.");
		expect(Cause.hasDies(exit.cause)).toBe(false);
	});
});
