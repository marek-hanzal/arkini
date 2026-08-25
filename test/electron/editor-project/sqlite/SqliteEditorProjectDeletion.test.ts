import { DatabaseSync } from "node:sqlite";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	createSqliteEditorProjectTestHarness,
	type SqliteEditorProjectTestHarness,
} from "./support/createSqliteEditorProjectTestHarness";

let harness: SqliteEditorProjectTestHarness;

beforeEach(async () => (harness = await createSqliteEditorProjectTestHarness("arkini-delete-")));
afterEach(async () => harness.close());

describe("SQLite editor project deletion", () => {
	it("atomically deletes the project, resources, Board scenarios, and version history", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository);
		await Effect.runPromise(
			repository.writeBoardScenarioFx({
				projectId: project.projectId,
				expectedRevision: project.revision,
				name: "Opening",
				bytes: Uint8Array.of(1),
			}),
		);
		await Effect.runPromise(
			repository.createVersionFx({
				projectId: project.projectId,
				subject: "Before deletion",
			}),
		);

		await Effect.runPromise(repository.deleteProjectFx(project.projectId));
		expect(await Effect.runPromise(repository.readProjectFx(project.projectId))).toBeNull();
		expect(await Effect.runPromise(repository.listProjectsFx)).toEqual([]);
		await expect(
			Effect.runPromise(repository.deleteProjectFx(project.projectId)),
		).rejects.toThrow("does not exist");
		await harness.closeRepository(repository);

		const database = new DatabaseSync(harness.databasePath);
		expect(database.prepare("SELECT count(*) AS count FROM projects").get()).toEqual({
			count: 0,
		});
		expect(database.prepare("SELECT count(*) AS count FROM resources").get()).toEqual({
			count: 0,
		});
		expect(database.prepare("SELECT count(*) AS count FROM board_scenarios").get()).toEqual({
			count: 0,
		});
		expect(database.prepare("SELECT count(*) AS count FROM project_versions").get()).toEqual({
			count: 0,
		});
		expect(
			database.prepare("SELECT count(*) AS count FROM project_version_blobs").get(),
		).toEqual({
			count: 0,
		});
		database.close();
	});

	it("rolls the entire deletion back when a child row cannot be purged", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository);
		await Effect.runPromise(
			repository.writeBoardScenarioFx({
				projectId: project.projectId,
				expectedRevision: project.revision,
				name: "Protected",
				bytes: Uint8Array.of(1),
			}),
		);
		await harness.closeRepository(repository);
		const database = new DatabaseSync(harness.databasePath);
		database.exec(`
			CREATE TRIGGER reject_project_resource_purge
			BEFORE DELETE ON resources
			BEGIN
				SELECT RAISE(ABORT, 'resource purge rejected');
			END;
		`);
		database.close();

		const reopened = await harness.openRepository();
		await expect(
			Effect.runPromise(reopened.deleteProjectFx(project.projectId)),
		).rejects.toThrow("could not be deleted");
		expect(await Effect.runPromise(reopened.readProjectFx(project.projectId))).toEqual(project);
		expect(
			await Effect.runPromise(reopened.listBoardScenariosFx(project.projectId)),
		).toHaveLength(1);
	});
});
