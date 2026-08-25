import { Effect, Fiber } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { editorTestPayload } from "~test/editor/support/editorTestPayload";
import {
	createSqliteEditorProjectTestHarness,
	type SqliteEditorProjectTestHarness,
} from "./support/createSqliteEditorProjectTestHarness";

let harness: SqliteEditorProjectTestHarness;

beforeEach(async () => (harness = await createSqliteEditorProjectTestHarness("arkini-writes-")));
afterEach(async () => harness.close());

describe("SQLite editor-project writes", () => {
	it("bumps the persisted compatibility version atomically with each classified write", async () => {
		const repository = await harness.openRepository();
		const created = await harness.createProject(repository);
		const compatible = await Effect.runPromise(
			repository.replaceConfigFx({
				projectId: created.projectId,
				expectedRevision: created.revision,
				config: {
					...created.config,
					meta: {
						...created.config.meta,
						title: "Compatible title",
					},
				},
			}),
		);
		expect(compatible.version).toBe("1.1");

		const breaking = await Effect.runPromise(
			repository.replaceConfigFx({
				projectId: compatible.projectId,
				expectedRevision: compatible.revision,
				config: {
					...compatible.config,
					items: {},
				},
			}),
		);
		expect(breaking.version).toBe("2.0");
		expect(
			(await Effect.runPromise(repository.readProjectFx(created.projectId)))?.version,
		).toBe("2.0");
	});

	it("rejects item renames and occupied IDs without changing canonical state", async () => {
		const repository = await harness.openRepository();
		await harness.createProject(repository);
		const water = editorTestPayload.config.items.water;
		await expect(
			Effect.runPromise(
				repository.upsertItemFx({
					projectId: "project-one",
					item: {
						...water,
						id: "fresh-water",
					},
				}),
			),
		).rejects.toThrow("cannot be renamed");
		const inserted = await Effect.runPromise(
			repository.upsertItemFx({
				projectId: "project-one",
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
				repository.upsertItemFx({
					projectId: "project-one",
					item: {
						...water,
						id: "oil",
					},
				}),
			),
		).rejects.toThrow("already used by another item");
		const canonical = await Effect.runPromise(repository.readProjectFx("project-one"));
		expect(canonical?.revision).toBe(inserted.revision);
		expect(canonical?.config.items.water?.uid).toBe(water.uid);
		expect(canonical?.config.items.oil?.uid).toBe("oil");
	});

	it("rejects a revision-pinned item upsert after another write commits", async () => {
		const repository = await harness.openRepository();
		const created = await harness.createProject(repository);
		const water = editorTestPayload.config.items.water;
		const updated = await Effect.runPromise(
			repository.upsertItemFx({
				expectedRevision: created.revision,
				projectId: created.projectId,
				item: {
					...water,
					title: "Fresh Water",
				},
			}),
		);

		await expect(
			Effect.runPromise(
				repository.upsertItemFx({
					expectedRevision: created.revision,
					projectId: created.projectId,
					item: {
						...water,
						description: "Stale replacement",
					},
				}),
			),
		).rejects.toThrow("changed from revision 0 to 1");
		expect(
			(await Effect.runPromise(repository.readProjectFx(created.projectId)))?.config.items
				.water,
		).toEqual(updated.config.items.water);
	});

	it("requires an exact revision and explicit policy before replacing one resource", async () => {
		const repository = await harness.openRepository();
		const created = await harness.createProject(repository);
		const existing = created.resources[0];
		if (existing === undefined) throw new Error("Expected a fixture resource.");
		const replacement = {
			...existing,
			bytes: Uint8Array.of(9, 8, 7),
		};

		await expect(
			Effect.runPromise(
				repository.saveResourceFx({
					expectedRevision: created.revision,
					overwrite: false,
					projectId: created.projectId,
					resource: replacement,
				}),
			),
		).rejects.toThrow(`Resource ID ${existing.id} already exists`);
		expect(
			(await Effect.runPromise(repository.readProjectFx(created.projectId)))?.revision,
		).toBe(created.revision);

		const replaced = await Effect.runPromise(
			repository.saveResourceFx({
				expectedRevision: created.revision,
				overwrite: true,
				projectId: created.projectId,
				resource: replacement,
			}),
		);
		expect(replaced.resources.find(({ id }) => id === existing.id)?.bytes).toEqual(
			replacement.bytes,
		);
		await expect(
			Effect.runPromise(
				repository.saveResourceFx({
					expectedRevision: created.revision,
					overwrite: true,
					projectId: created.projectId,
					resource: {
						...replacement,
						bytes: Uint8Array.of(1),
					},
				}),
			),
		).rejects.toThrow(`changed from revision ${created.revision} to ${replaced.revision}`);
	});

	it("inserts one new revision-pinned resource without overwrite permission", async () => {
		const repository = await harness.openRepository();
		const created = await harness.createProject(repository);
		const resource = {
			id: "chatgpt-image",
			mime: "image/png",
			bytes: Uint8Array.of(1, 2, 3),
		};

		const saved = await Effect.runPromise(
			repository.saveResourceFx({
				expectedRevision: created.revision,
				overwrite: false,
				projectId: created.projectId,
				resource,
			}),
		);

		expect(saved.revision).toBe(created.revision + 1);
		expect(saved.resources.find(({ id }) => id === resource.id)).toEqual(resource);
	});

	it("serializes concurrent writes and awaitIdle observes every admitted write", async () => {
		const repository = await harness.openRepository();
		await harness.createProject(repository);
		const water = editorTestPayload.config.items.water;
		const canonical = await Effect.runPromise(
			Effect.gen(function* () {
				const itemWrite = yield* Effect.forkChild(
					repository.upsertItemFx({
						projectId: "project-one",
						item: {
							...water,
							id: "oil",
							uid: "oil",
							title: "Oil",
						},
					}),
				);
				const resourceWrite = yield* Effect.forkChild(
					repository.upsertResourcesFx({
						projectId: "project-one",
						resources: [
							{
								id: "item-oil",
								mime: "image/png",
								bytes: Uint8Array.of(5),
							},
						],
					}),
				);
				yield* Effect.yieldNow;
				yield* repository.awaitIdleFx;
				yield* Fiber.join(itemWrite);
				yield* Fiber.join(resourceWrite);
				return yield* repository.readProjectFx("project-one");
			}),
		);
		expect(canonical?.revision).toBe(2);
		expect(canonical?.config.items.oil?.uid).toBe("oil");
		expect(canonical?.resources.some(({ id }) => id === "item-oil")).toBe(true);
	});
});
