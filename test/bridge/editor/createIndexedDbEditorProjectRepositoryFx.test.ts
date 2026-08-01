import Dexie from "dexie";
import { IDBKeyRange, indexedDB } from "fake-indexeddb";
import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";

import type { EditorProjectRepositoryService } from "~/bridge/editor/EditorProjectRepository";
import { createIndexedDbEditorProjectRepositoryFx } from "~/bridge/editor/createIndexedDbEditorProjectRepositoryFx";
import { editorTestPayload } from "../../editor/support/editorTestPayload";

const databaseNames = new Set<string>();

const createDatabaseName = () => {
	const name = `arkini-editor-test-${crypto.randomUUID()}`;
	databaseNames.add(name);
	return name;
};

const runWithRepository = <Value, Error>(
	databaseName: string,
	run: (repository: EditorProjectRepositoryService) => Effect.Effect<Value, Error>,
) =>
	Effect.runPromise(
		Effect.scoped(
			createIndexedDbEditorProjectRepositoryFx({
				databaseName,
				indexedDB,
				IDBKeyRange,
			}).pipe(Effect.flatMap(run)),
		),
	);

afterEach(async () => {
	for (const name of databaseNames) {
		await new Promise<void>((resolve, reject) => {
			const request = indexedDB.deleteDatabase(name);
			request.addEventListener("success", () => resolve(), {
				once: true,
			});
			request.addEventListener("error", () => reject(request.error), {
				once: true,
			});
		});
	}
	databaseNames.clear();
});

describe("createIndexedDbEditorProjectRepositoryFx", () => {
	it("atomically creates, lists and reloads one canonical project", async () => {
		const databaseName = createDatabaseName();
		const created = await runWithRepository(databaseName, (repository) =>
			repository.createProjectFx({
				projectId: "project-one",
				config: editorTestPayload.config,
				resources: editorTestPayload.resources,
			}),
		);

		expect(created).toMatchObject({
			projectId: "project-one",
			title: "Editor test",
			game: "1.0",
			revision: 0,
		});
		expect(created.resources.map(({ id }) => id)).toEqual([
			"hero",
			"item-water",
		]);

		const reopened = await runWithRepository(databaseName, (repository) =>
			Effect.all([
				repository.listProjectsFx,
				repository.readProjectFx("project-one"),
			]),
		);
		expect(reopened[0]).toEqual([
			{
				projectId: "project-one",
				title: "Editor test",
				game: "1.0",
				createdAtMs: created.createdAtMs,
				updatedAtMs: created.updatedAtMs,
			},
		]);
		expect(reopened[1]).toEqual(created);
	});

	it("rolls back the complete project import when one resource key collides", async () => {
		const databaseName = createDatabaseName();
		const duplicateResources = [
			editorTestPayload.resources[0],
			editorTestPayload.resources[0],
		];

		await expect(
			runWithRepository(databaseName, (repository) =>
				repository.createProjectFx({
					projectId: "project-one",
					config: editorTestPayload.config,
					resources: duplicateResources,
				}),
			),
		).rejects.toThrow("could not be created");

		expect(
			await runWithRepository(databaseName, (repository) =>
				repository.readProjectFx("project-one"),
			),
		).toBeNull();
	});

	it("upserts items by immutable UID and rejects rename or occupied IDs atomically", async () => {
		const databaseName = createDatabaseName();
		await runWithRepository(databaseName, (repository) =>
			repository.createProjectFx({
				projectId: "project-one",
				config: editorTestPayload.config,
				resources: editorTestPayload.resources,
			}),
		);
		const water = editorTestPayload.config.items.water;
		await expect(
			runWithRepository(databaseName, (repository) =>
				repository.upsertItemFx({
					projectId: "project-one",
					item: {
						...water,
						id: "fresh-water",
					},
				}),
			),
		).rejects.toThrow("cannot be renamed");
		const updated = await runWithRepository(databaseName, (repository) =>
			repository.upsertItemFx({
				projectId: "project-one",
				item: {
					...water,
					title: "Fresh water",
				},
			}),
		);
		expect(updated.revision).toBe(1);
		expect(updated.config.items.water?.title).toBe("Fresh water");
		expect(updated).not.toHaveProperty("resources");

		await runWithRepository(databaseName, (repository) =>
			repository.upsertItemFx({
				projectId: "project-one",
				item: {
					...water,
					uid: "other-water",
					id: "occupied",
				},
			}),
		);
		await expect(
			runWithRepository(databaseName, (repository) =>
				repository.upsertItemFx({
					projectId: "project-one",
					item: {
						...water,
						id: "occupied",
					},
				}),
			),
		).rejects.toThrow("already used by another item");

		const afterConflict = await runWithRepository(databaseName, (repository) =>
			repository.readProjectFx("project-one"),
		);
		expect(afterConflict?.revision).toBe(2);
		expect(afterConflict?.config.items.water?.uid).toBe(water.uid);
		expect(afterConflict?.config.items.occupied?.uid).toBe("other-water");
	});

	it("atomically replaces one resource and advances the project revision", async () => {
		const databaseName = createDatabaseName();
		const created = await runWithRepository(databaseName, (repository) =>
			repository.createProjectFx({
				projectId: "project-one",
				config: editorTestPayload.config,
				resources: editorTestPayload.resources,
			}),
		);
		const changed = await runWithRepository(databaseName, (repository) =>
			repository.upsertResourcesFx({
				projectId: "project-one",
				resources: [
					{
						id: "hero",
						mime: "image/png",
						bytes: new Uint8Array([
							9,
							8,
							7,
						]),
					},
				],
			}),
		);

		expect(changed.revision).toBe(created.revision + 1);
		expect(changed.updatedAtMs).toBeGreaterThan(created.updatedAtMs);
		expect(changed.resources.find(({ id }) => id === "hero")?.bytes).toEqual(
			new Uint8Array([
				9,
				8,
				7,
			]),
		);
	});

	it("atomically renames one resource with its canonical config", async () => {
		const databaseName = createDatabaseName();
		await runWithRepository(databaseName, (repository) =>
			repository.createProjectFx({
				projectId: "project-one",
				config: editorTestPayload.config,
				resources: editorTestPayload.resources,
			}),
		);
		const changed = await runWithRepository(databaseName, (repository) =>
			repository.replaceResourceFx({
				projectId: "project-one",
				currentId: "hero",
				config: {
					...editorTestPayload.config,
					resources: {
						...editorTestPayload.config.resources,
						hero: "new-hero",
					},
				},
				resource: {
					...editorTestPayload.resources[0],
					id: "new-hero",
				},
			}),
		);

		expect(changed.revision).toBe(1);
		expect(changed.config.resources.hero).toBe("new-hero");
		expect(changed.resources.some(({ id }) => id === "hero")).toBe(false);
		expect(changed.resources.some(({ id }) => id === "new-hero")).toBe(true);
	});

	it("atomically replaces the complete canonical config", async () => {
		const databaseName = createDatabaseName();
		const created = await runWithRepository(databaseName, (repository) =>
			repository.createProjectFx({
				projectId: "project-one",
				config: editorTestPayload.config,
				resources: editorTestPayload.resources,
			}),
		);
		const changed = await runWithRepository(databaseName, (repository) =>
			repository.replaceConfigFx({
				projectId: "project-one",
				config: {
					...editorTestPayload.config,
					meta: {
						...editorTestPayload.config.meta,
						title: "Changed project",
					},
				},
			}),
		);

		expect(changed.revision).toBe(created.revision + 1);
		expect(changed.config.meta.title).toBe("Changed project");
		expect(
			(
				await runWithRepository(databaseName, (repository) =>
					repository.readProjectFx("project-one"),
				)
			)?.config.meta.title,
		).toBe("Changed project");
	});

	it("serializes concurrent item and resource transactions without losing either revision", async () => {
		const databaseName = createDatabaseName();
		await runWithRepository(databaseName, (repository) =>
			repository.createProjectFx({
				projectId: "project-one",
				config: editorTestPayload.config,
				resources: editorTestPayload.resources,
			}),
		);
		const water = editorTestPayload.config.items.water;
		const [itemProject, resourceProject, canonical] = await runWithRepository(
			databaseName,
			(repository) =>
				Effect.gen(function* () {
					const [itemResult, resourceResult] = yield* Effect.all(
						[
							repository.upsertItemFx({
								projectId: "project-one",
								item: {
									...water,
									uid: "oil",
									id: "oil",
									title: "Oil",
								},
							}),
							repository.upsertResourcesFx({
								projectId: "project-one",
								resources: [
									{
										id: "item-oil",
										mime: "image/png",
										bytes: new Uint8Array([
											5,
										]),
									},
								],
							}),
						] as const,
						{
							concurrency: "unbounded",
						},
					);
					const project = yield* repository.readProjectFx("project-one");
					return [
						itemResult,
						resourceResult,
						project,
					] as const;
				}),
		);

		expect(
			[
				itemProject.revision,
				resourceProject.revision,
			].sort(),
		).toEqual([
			1,
			2,
		]);
		expect(canonical?.revision).toBe(2);
		expect(canonical?.config.items.oil?.uid).toBe("oil");
		expect(canonical?.resources.some(({ id }) => id === "item-oil")).toBe(true);
	});

	it("rejects an invalid canonical row instead of publishing corrupted project state", async () => {
		const databaseName = createDatabaseName();
		const database = new Dexie(databaseName, {
			indexedDB,
			IDBKeyRange,
		});
		database.version(1).stores({
			projects: "&projectId, updatedAtMs",
			resources: "&[projectId+id], projectId",
		});
		await database.table("projects").put({
			projectId: "broken-project",
			config: {},
			revision: 0,
			createdAtMs: 1,
			updatedAtMs: 1,
		});
		database.close();

		await expect(
			runWithRepository(databaseName, (repository) =>
				repository.readProjectFx("broken-project"),
			),
		).rejects.toThrow("invalid editor project record");
	});
});
