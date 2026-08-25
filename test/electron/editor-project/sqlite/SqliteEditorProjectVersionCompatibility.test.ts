import { DatabaseSync } from "node:sqlite";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	createSqliteEditorProjectTestHarness,
	type SqliteEditorProjectTestHarness,
} from "./support/createSqliteEditorProjectTestHarness";

let harness: SqliteEditorProjectTestHarness;

beforeEach(
	async () => (harness = await createSqliteEditorProjectTestHarness("arkini-version-gate-")),
);
afterEach(async () => harness.close());

describe("SQLite editor version compatibility", () => {
	it("uses the exact app version as the sole history applicability gate", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository);
		const version = await Effect.runPromise(
			repository.createVersionFx({
				projectId: project.projectId,
				subject: "Same app snapshot",
			}),
		);
		const database = new DatabaseSync(harness.databasePath);
		database
			.prepare("UPDATE project_versions SET snapshot_format_version = ? WHERE version_id = ?")
			.run(99, version.versionId);
		database.close();

		const [listed] = await Effect.runPromise(repository.listVersionsFx(project.projectId));
		expect(listed).toMatchObject({
			applicability: {
				type: "applicable",
			},
			snapshotFormatVersion: 99,
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
			hasChanges: false,
		});
		await expect(
			Effect.runPromise(
				repository.checkoutVersionFx({
					projectId: project.projectId,
					versionId: version.versionId,
				}),
			),
		).resolves.toBeUndefined();
	});
});
