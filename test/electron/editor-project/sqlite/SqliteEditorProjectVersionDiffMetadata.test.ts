import { DatabaseSync } from "node:sqlite";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	createSqliteEditorProjectTestHarness,
	type SqliteEditorProjectTestHarness,
} from "./support/createSqliteEditorProjectTestHarness";

let harness: SqliteEditorProjectTestHarness;

beforeEach(async () => (harness = await createSqliteEditorProjectTestHarness("arkini-diff-meta-")));
afterEach(async () => harness.close());

describe("SQLite editor version binary diff metadata", () => {
	it("reports MIME and scenario Arkpack version changes with unchanged bytes", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository);
		await Effect.runPromise(
			repository.writeBoardScenarioFx({
				projectId: project.projectId,
				expectedRevision: project.revision,
				name: "Opening",
				bytes: Uint8Array.of(7, 8),
			}),
		);
		const version = await Effect.runPromise(
			repository.createVersionFx({
				projectId: project.projectId,
				subject: "Binary metadata baseline",
			}),
		);

		const database = new DatabaseSync(harness.databasePath);
		database
			.prepare("UPDATE resources SET mime = ? WHERE project_id = ? AND id = ?")
			.run("image/webp", project.projectId, "hero");
		database
			.prepare(
				"UPDATE board_scenarios SET arkpack_version = ? WHERE project_id = ? AND name = ?",
			)
			.run("1.1", project.projectId, "Opening");
		database.close();

		expect(
			await Effect.runPromise(repository.readVersionStatusFx(project.projectId)),
		).toMatchObject({
			dirty: true,
		});
		expect(
			await Effect.runPromise(
				repository.diffVersionsFx({
					projectId: project.projectId,
					from: {
						type: "version",
						versionId: version.versionId,
					},
					to: {
						type: "current",
					},
				}),
			),
		).toMatchObject({
			hasChanges: true,
			resources: [
				{
					change: "changed",
					id: "hero",
				},
			],
			scenarios: [
				{
					change: "changed",
					id: "Opening",
				},
			],
		});
	});
});
