import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Cause, Effect, Exit, Fiber } from "effect";
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
	temporaryDirectory = await mkdtemp(join(tmpdir(), "arkini-editor-sqlite-"));
	databasePath = join(temporaryDirectory, "nested", "projects.sqlite");
});

afterEach(async () => {
	for (const repository of openRepositories) await closeRepository(repository);
	await rm(temporaryDirectory, {
		force: true,
		recursive: true,
	});
});

describe("createSqliteEditorProjectRepositoryFx", () => {
	it("migrates legacy config.version into the project-owned arkpack version", async () => {
		databasePath = join(temporaryDirectory, "legacy.sqlite");
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

		const repository = await openRepository();
		const project = await Effect.runPromise(repository.readProjectFx("legacy"));
		expect(project?.version).toBe("1.0");
		expect(project?.config).not.toHaveProperty("version");
		await closeRepository(repository);
	});

	it("creates, reads, lists and reopens one canonical project", async () => {
		const repository = await openRepository();
		const created = await createProject(repository);

		expect(created).toMatchObject({
			projectId: "project-one",
			title: "Editor test",
			version: "1.0",
			revision: 0,
		});
		expect(created.resources.map(({ id }) => id)).toEqual([
			"hero",
			"item-water",
		]);
		expect(await Effect.runPromise(repository.readProjectFx("missing"))).toBeNull();
		await closeRepository(repository);

		const reopened = await openRepository();
		expect(await Effect.runPromise(reopened.listProjectsFx)).toEqual([
			{
				projectId: "project-one",
				title: "Editor test",
				version: "1.0",
				createdAtMs: created.createdAtMs,
				updatedAtMs: created.updatedAtMs,
			},
		]);
		expect(await Effect.runPromise(reopened.readProjectFx("project-one"))).toEqual(created);
		await closeRepository(reopened);
	});

	it("orders descriptors by updated time and project ID for ties", async () => {
		const repository = await openRepository();
		const first = await createProject(repository, "project-b");
		await createProject(repository, "project-a");
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

		expect(changed.revision).toBe(1);
		expect(changed.updatedAtMs).toBeGreaterThan(first.updatedAtMs);
		const listed = await Effect.runPromise(repository.listProjectsFx);
		expect(listed).toEqual(
			[
				...listed,
			].sort(
				(left, right) =>
					right.updatedAtMs - left.updatedAtMs ||
					left.projectId.localeCompare(right.projectId),
			),
		);
		await closeRepository(repository);
	});

	it("bumps the persisted compatibility version atomically with each classified write", async () => {
		const repository = await openRepository();
		const created = await createProject(repository);
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
		await closeRepository(repository);
	});

	it("rolls back a duplicate-resource project import", async () => {
		const repository = await openRepository();
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
		await closeRepository(repository);
	});

	it("rejects item renames and occupied IDs without changing canonical state", async () => {
		const repository = await openRepository();
		await createProject(repository);
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
		await closeRepository(repository);
	});

	it("rejects stale config and resource writes without erasing newer state", async () => {
		const repository = await openRepository();
		const created = await createProject(repository);
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
		expect(canonical?.config.items.oil?.uid).toBe("oil");
		expect(canonical?.resources.map(({ id }) => id)).toEqual([
			"hero",
			"item-water",
		]);
		await closeRepository(repository);
	});

	it("renames a resource atomically and rolls back an occupied target", async () => {
		const repository = await openRepository();
		const created = await createProject(repository);

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
					bytes: new Uint8Array([
						9,
					]),
				},
			}),
		);
		expect(renamed.revision).toBe(1);
		expect(renamed.version).toBe("1.1");
		expect(renamed.resources.map(({ id }) => id)).toEqual([
			"item-water",
			"new-hero",
		]);
		expect(renamed.resources.find(({ id }) => id === "new-hero")?.bytes).toEqual(
			new Uint8Array([
				9,
			]),
		);
		await closeRepository(repository);
	});

	it("serializes concurrent writes and awaitIdle observes every admitted write", async () => {
		const repository = await openRepository();
		await createProject(repository);
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
								bytes: new Uint8Array([
									5,
								]),
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
		await closeRepository(repository);
	});

	it("rejects corrupt persisted config instead of publishing invalid state", async () => {
		const repository = await openRepository();
		await createProject(repository);
		await closeRepository(repository);

		const database = new DatabaseSync(databasePath);
		database
			.prepare("UPDATE projects SET config_json = ? WHERE project_id = ?")
			.run("{}", "project-one");
		database.close();

		const reopened = await openRepository();
		await expect(Effect.runPromise(reopened.readProjectFx("project-one"))).rejects.toThrow(
			"invalid editor project record",
		);
		await closeRepository(reopened);
	});

	it("reports a versioned but damaged schema as a typed initialization failure", async () => {
		const repository = await openRepository();
		await closeRepository(repository);
		const database = new DatabaseSync(databasePath);
		database.exec("DROP TABLE projects");
		database.close();

		const exit = await Effect.runPromiseExit(
			createSqliteEditorProjectRepositoryFx({
				databasePath,
			}),
		);
		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isSuccess(exit))
			throw new Error("Expected damaged schema initialization failure.");
		expect(Cause.hasDies(exit.cause)).toBe(false);
	});
});
