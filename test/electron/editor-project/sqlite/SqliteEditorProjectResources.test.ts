import { DatabaseSync } from "node:sqlite";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { editorTestPayload } from "~test/editor/support/editorTestPayload";
import {
	createSqliteEditorProjectTestHarness,
	type SqliteEditorProjectTestHarness,
} from "./support/createSqliteEditorProjectTestHarness";

let harness: SqliteEditorProjectTestHarness;

beforeEach(async () => (harness = await createSqliteEditorProjectTestHarness("arkini-resources-")));
afterEach(async () => harness.close());

describe("SQLite editor-project resources", () => {
	it("rolls back a duplicate-resource project import", async () => {
		const repository = await harness.openRepository();
		await expect(
			Effect.runPromise(
				repository.createProjectFx({
					projectId: "project-one",
					version: "1.0",
					config: editorTestPayload.config,
					resources: [
						editorTestPayload.resources[0],
						editorTestPayload.resources[0],
					],
				}),
			),
		).rejects.toThrow("could not be created");
		expect(await Effect.runPromise(repository.readProjectFx("project-one"))).toBeNull();
	});

	it("rejects stale config and resource writes without erasing newer state", async () => {
		const repository = await harness.openRepository();
		const created = await harness.createProject(repository);
		const water = editorTestPayload.config.items.water;
		await Effect.runPromise(
			repository.upsertItemFx({
				projectId: created.projectId,
				item: {
					...water,
					id: "oil",
					uid: "oil",
					title: "Oil",
				},
			}),
		);
		await expect(
			Effect.runPromise(
				repository.replaceConfigFx({
					projectId: created.projectId,
					expectedRevision: created.revision,
					config: {
						...created.config,
						meta: {
							...created.config.meta,
							title: "Stale",
						},
					},
				}),
			),
		).rejects.toThrow("changed from revision 0 to 1");
		await expect(
			Effect.runPromise(
				repository.replaceResourceFx({
					projectId: created.projectId,
					currentId: "hero",
					expectedRevision: created.revision,
					config: {
						...created.config,
						resources: {
							...created.config.resources,
							hero: "new-hero",
						},
					},
					resource: {
						...editorTestPayload.resources[0],
						id: "new-hero",
					},
				}),
			),
		).rejects.toThrow("changed from revision 0 to 1");

		const canonical = await Effect.runPromise(repository.readProjectFx(created.projectId));
		expect(canonical?.revision).toBe(1);
		expect(canonical?.config.meta.title).toBe(created.config.meta.title);
		expect(canonical?.resources.map(({ id }) => id)).toEqual([
			"hero",
			"item-water",
		]);
	});

	it("renames a resource atomically and rolls back an occupied target", async () => {
		const repository = await harness.openRepository();
		const created = await harness.createProject(repository);
		await expect(
			Effect.runPromise(
				repository.replaceResourceFx({
					projectId: created.projectId,
					currentId: "hero",
					expectedRevision: created.revision,
					config: {
						...created.config,
						resources: {
							...created.config.resources,
							hero: "item-water",
						},
					},
					resource: {
						...editorTestPayload.resources[0],
						id: "item-water",
					},
				}),
			),
		).rejects.toThrow("already exists");
		expect(await Effect.runPromise(repository.readProjectFx(created.projectId))).toEqual(
			created,
		);

		const renamed = await Effect.runPromise(
			repository.replaceResourceFx({
				projectId: created.projectId,
				currentId: "hero",
				expectedRevision: created.revision,
				config: {
					...created.config,
					resources: {
						...created.config.resources,
						hero: "new-hero",
					},
				},
				resource: {
					...editorTestPayload.resources[0],
					id: "new-hero",
					bytes: Uint8Array.of(9),
				},
			}),
		);
		expect(renamed).toMatchObject({
			revision: 1,
			version: "1.1",
		});
		expect(renamed.resources.map(({ id }) => id)).toEqual([
			"item-water",
			"new-hero",
		]);
		expect(renamed.resources.find(({ id }) => id === "new-hero")?.bytes).toEqual(
			Uint8Array.of(9),
		);
	});

	it("rolls back inserted resource bytes when the following project commit fails", async () => {
		const repository = await harness.openRepository();
		const created = await harness.createProject(repository);
		await harness.closeRepository(repository);
		const database = new DatabaseSync(harness.databasePath);
		database.exec(`
			CREATE TRIGGER reject_project_resource_commit
			BEFORE UPDATE ON projects
			BEGIN
				SELECT RAISE(ABORT, 'project resource commit rejected');
			END;
		`);
		database.close();

		const reopened = await harness.openRepository();
		await expect(
			Effect.runPromise(
				reopened.upsertResourcesFx({
					projectId: created.projectId,
					resources: [
						{
							id: "late-failure",
							mime: "image/png",
							bytes: Uint8Array.of(7),
						},
					],
				}),
			),
		).rejects.toThrow("Resources could not be saved");
		expect(await Effect.runPromise(reopened.readProjectFx(created.projectId))).toEqual(created);
	});
});
