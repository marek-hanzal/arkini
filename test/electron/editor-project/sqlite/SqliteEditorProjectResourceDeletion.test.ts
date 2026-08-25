import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	createSqliteEditorProjectTestHarness,
	type SqliteEditorProjectTestHarness,
} from "./support/createSqliteEditorProjectTestHarness";

let harness: SqliteEditorProjectTestHarness;

beforeEach(
	async () => (harness = await createSqliteEditorProjectTestHarness("arkini-resource-delete-")),
);
afterEach(async () => harness.close());

describe("SQLite editor resource deletion", () => {
	it("rejects a referenced asset without changing canonical state", async () => {
		const repository = await harness.openRepository();
		const created = await harness.createProject(repository);

		await expect(
			Effect.runPromise(
				repository.deleteResourceFx({
					expectedRevision: created.revision,
					projectId: created.projectId,
					resourceId: "hero",
				}),
			),
		).rejects.toThrow("still referenced in 1 place");

		expect(await Effect.runPromise(repository.readProjectFx(created.projectId))).toEqual(
			created,
		);
	});

	it("rechecks revision and removes only the eligible asset in one minor commit", async () => {
		const repository = await harness.openRepository();
		const created = await harness.createProject(repository);
		const withUnused = await Effect.runPromise(
			repository.saveResourceFx({
				expectedRevision: created.revision,
				overwrite: false,
				projectId: created.projectId,
				resource: {
					id: "unused",
					mime: "image/png",
					bytes: Uint8Array.of(9),
				},
			}),
		);

		await expect(
			Effect.runPromise(
				repository.deleteResourceFx({
					expectedRevision: created.revision,
					projectId: created.projectId,
					resourceId: "unused",
				}),
			),
		).rejects.toThrow(`changed from revision ${created.revision} to ${withUnused.revision}`);

		const deleted = await Effect.runPromise(
			repository.deleteResourceFx({
				expectedRevision: withUnused.revision,
				projectId: created.projectId,
				resourceId: "unused",
			}),
		);

		expect(deleted).toMatchObject({
			config: created.config,
			revision: withUnused.revision + 1,
			version: "1.2",
		});
		expect(deleted.resources.map(({ id }) => id)).toEqual([
			"hero",
			"item-water",
		]);
	});
});
