import { parseVersionFn } from "~/game-version/fn/parseVersionFn";
import { access, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem, PlatformError } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SerakkiAppVersion } from "~shared/SerakkiAppMetadata";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
import {
	createProjectTestHarness,
	type ProjectTestHarness,
} from "./support/createProjectTestHarness";
import { createTestSerapack } from "~test/serapack-support/fx/createTestSerapack";
import { packDirectoryFx } from "~/serapack-artifact/fx/packDirectoryFx";
import {
	musicOgg,
	sfxOgg,
	writeGameProjectFixtureFx,
} from "~test/serapack-artifact/fx/packDirectoryFx.test/gameProjectFixture";

let harness: ProjectTestHarness;

const realPath = (root: string) =>
	Effect.runPromise(
		FileSystem.FileSystem.pipe(
			Effect.flatMap((fileSystem) => fileSystem.realPath(root)),
			Effect.provide(NodeServices.layer),
		),
	);

beforeEach(async () => {
	harness = await createProjectTestHarness("serakki-fs-project-");
});

afterEach(async () => harness.close());

describe("filesystem Editor project lifecycle", () => {
	it("imports nameless packed audio as fresh paired metadata without changing IDs, references or bytes", async () => {
		const repository = await harness.openRepository();
		const imported = await Effect.runPromise(
			Effect.gen(function* () {
				const source = yield* writeGameProjectFixtureFx();
				const packed = yield* packDirectoryFx({
					input: source,
				});
				return yield* repository.importSerapackFileFx(packed.serapack);
			}).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
		);
		expect(imported.resources).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					uid: "theme",
					type: "music",
					title: "theme",
				}),
				expect.objectContaining({
					uid: "job-start",
					type: "sfx",
					title: "job-start",
				}),
			]),
		);
		expect(imported.config.music?.playlist).toEqual([
			"theme",
		]);
		expect(Object.values(imported.config.sfx?.events ?? {})).toContain("job-start");
		const root = await Effect.runPromise(repository.readProjectRootFx(imported.projectId));
		if (root === null) throw new Error("Imported project root missing.");
		for (const [type, id, , bytes] of [
			[
				"music",
				"theme",
				"Theme",
				musicOgg,
			],
			[
				"sfx",
				"job-start",
				"Job Start",
				sfxOgg,
			],
		] as const) {
			expect(JSON.parse(await readFile(join(root, type, `${id}.json`), "utf8"))).toEqual({
				title: id,
			});
			expect(new Uint8Array(await readFile(join(root, type, `${id}.ogg`)))).toEqual(
				Uint8Array.from(bytes),
			);
		}
		await harness.closeRepository(repository);
		const reopened = await harness.openRepository();
		expect(await Effect.runPromise(reopened.readProjectFx(imported.projectId))).toEqual(
			imported,
		);
	});

	it("imports an Serapack through the shared filesystem extraction pipeline", async () => {
		const repository = await harness.openRepository();
		const serapackPath = join(harness.temporaryDirectory, "import.serapack");
		await writeFile(serapackPath, createTestSerapack());

		const imported = await Effect.runPromise(repository.importSerapackFileFx(serapackPath));

		expect(imported).toMatchObject({
			projectId: "game:test",
			config: {
				meta: {
					id: "game:test",
				},
			},
		});
		expect(imported.resources.map(({ uid }) => uid).sort()).toEqual([
			"asset-water",
			"hero",
		]);
		const hero = await Effect.runPromise(
			repository.readResourceLocationFx({
				projectId: imported.projectId,
				resourceUid: "hero",
			}),
		);
		expect(hero).not.toBeNull();
		if (hero === null) throw new Error("Imported Hero is unavailable.");
		expect((await readFile(hero.path)).subarray(0, 8)).toEqual(
			Buffer.from([
				137,
				80,
				78,
				71,
				13,
				10,
				26,
				10,
			]),
		);
	});

	it("creates and reopens a project with no authored items", async () => {
		const repository = await harness.openRepository();
		const created = await Effect.runPromise(
			repository.createProjectFx({
				version: parseVersionFn(editorTestPayload.version),
				config: {
					...editorTestPayload.config,
					meta: {
						...editorTestPayload.config.meta,
						id: "empty-project",
					},
					start: {
						...editorTestPayload.config.start,
						spaces: [],
					},
					templates: [],
					items: {},
				},
				resources: editorTestPayload.resources.filter(({ uid }) => uid === "hero"),
			}),
		);
		const root = await Effect.runPromise(repository.readProjectRootFx(created.projectId));
		if (root === null) throw new Error("Managed project root missing.");
		expect(await readdir(join(root, "items"))).toEqual([]);

		await harness.closeRepository(repository);
		const reopened = await harness.openRepository();
		expect(await Effect.runPromise(reopened.readProjectFx(created.projectId))).toEqual(created);
	});

	it("reopens an imported project's selected build version", async () => {
		const repository = await harness.openRepository();
		const version = {
			major: 4,
			minor: 2,
			suffix: "test",
		};
		const created = await Effect.runPromise(
			repository.createProjectFx({
				version,
				config: editorTestPayload.config,
				resources: editorTestPayload.resources,
			}),
		);
		await harness.closeRepository(repository);
		const reopened = await harness.openRepository();
		expect(await Effect.runPromise(reopened.readProjectFx(created.projectId))).toMatchObject({
			version,
		});
	});

	it("does not expose a managed project before its complete root is published", async () => {
		const nodeFileSystem = await Effect.runPromise(
			FileSystem.FileSystem.pipe(Effect.provide(NodeServices.layer)),
		);
		const fileSystem: FileSystem.FileSystem = {
			...nodeFileSystem,
			rename: (from, to) =>
				String(from).includes(".project-staging") &&
				!String(to).includes(".project-staging")
					? Effect.fail(
							PlatformError.systemError({
								_tag: "Unknown",
								module: "FileSystem",
								method: "rename",
								description: "injected project publication failure",
							}),
						)
					: nodeFileSystem.rename(from, to),
		};
		const repository = await harness.openRepository(fileSystem);
		await expect(
			Effect.runPromise(
				repository.createProjectFx({
					version: {
						major: 4,
						minor: 2,
					},
					config: editorTestPayload.config,
					resources: editorTestPayload.resources,
				}),
			),
		).rejects.toBeDefined();
		expect(await Effect.runPromise(repository.listProjectsFx)).toEqual([]);
		expect(
			(await readdir(harness.projectsRoot)).filter((name) => name !== ".projects.lock"),
		).toEqual([]);
	});

	it("reopens managed projects from the user-data catalog", async () => {
		const repository = await harness.openRepository();
		const created = await harness.createProject(repository, "managed.\ud800");
		const root = await Effect.runPromise(repository.readProjectRootFx(created.projectId));
		expect(root).toContain(harness.projectsRoot);
		expect(root).toContain("managed.%ED%A0%80-");
		expect(JSON.parse(await readFile(join(root ?? "", "project.json"), "utf8"))).toMatchObject({
			serakki: SerakkiAppVersion,
			revision: expect.any(Number),
		});
		expect(JSON.parse(await readFile(join(root ?? "", "game.json"), "utf8"))).toMatchObject({
			version: {
				major: 1,
				minor: 0,
			},
		});
		expect(JSON.parse(await readFile(harness.catalogPath, "utf8"))).toMatchObject({
			projects: [
				{
					root,
					ownership: "managed",
					createdAtMs: expect.any(Number),
				},
			],
		});
		expect(await readFile(harness.catalogPath, "utf8")).not.toContain("projectId");

		await harness.closeRepository(repository);
		const reopened = await harness.openRepository();
		expect(await Effect.runPromise(reopened.readProjectFx(created.projectId))).toEqual(created);
	});

	it("reconciles healthy and incomplete managed directories when the catalog is missing", async () => {
		const seedingRepository = await harness.openRepository();
		const healthy = await harness.createProject(seedingRepository, "healthy-missing-catalog");
		const healthyRoot = await Effect.runPromise(
			seedingRepository.readProjectRootFx(healthy.projectId),
		);
		if (healthyRoot === null) throw new Error("Managed project root missing.");
		await harness.closeRepository(seedingRepository);
		await rm(harness.catalogPath);
		await mkdir(harness.projectsRoot, {
			recursive: true,
		});
		const root = join(harness.projectsRoot, "incomplete-project");
		await mkdir(root);
		await writeFile(join(root, "project.json"), "partial");
		const canonicalRoot = await realPath(root);

		const repository = await harness.openRepository();
		expect(await Effect.runPromise(repository.listProjectsFx)).toEqual([
			{
				type: "valid",
				ownership: "managed",
				project: expect.objectContaining({
					projectId: healthy.projectId,
				}),
			},
			expect.objectContaining({
				type: "invalid",
				root: canonicalRoot,
				validationError: expect.stringContaining(canonicalRoot),
			}),
		]);
		await expect(access(root)).resolves.toBeUndefined();
		expect(JSON.parse(await readFile(harness.catalogPath, "utf8"))).toEqual({
			projects: [
				healthyRoot,
				canonicalRoot,
			]
				.sort()
				.map((root) => ({
					root,
					ownership: "managed",
					createdAtMs: 0,
				})),
		});
	});

	it("drops a managed catalog entry whose interrupted deletion removed its root", async () => {
		const repository = await harness.openRepository();
		const created = await harness.createProject(repository);
		const root = await Effect.runPromise(repository.readProjectRootFx(created.projectId));
		if (root === null) throw new Error("Managed project root missing.");
		await harness.closeRepository(repository);
		await rm(root, {
			recursive: true,
		});

		const reopened = await harness.openRepository();
		expect(await Effect.runPromise(reopened.listProjectsFx)).toEqual([]);
		expect(JSON.parse(await readFile(harness.catalogPath, "utf8"))).toEqual({
			projects: [],
		});
	});

	it("opens an external folder in place and unregisters it without deleting its files", async () => {
		const root = await harness.createExternalProject();
		await rm(join(root, ".gitignore"));
		const repository = await harness.openRepository();
		const opened = await Effect.runPromise(
			repository.openProjectFx({
				root,
			}),
		);
		expect(await Effect.runPromise(repository.readProjectRootFx(opened.projectId))).toBe(
			await realPath(root),
		);
		await expect(access(join(root, ".gitignore"))).rejects.toBeDefined();

		await Effect.runPromise(repository.deleteProjectFx(opened.projectId));
		await expect(access(join(root, "project.json"))).resolves.toBeUndefined();
		await harness.closeRepository(repository);

		const reopened = await harness.openRepository();
		expect(await Effect.runPromise(reopened.listProjectsFx)).toEqual([]);
	});

	it("ignores a catalog entry that claims an outside folder is managed", async () => {
		const root = await harness.createExternalProject();
		await mkdir(join(harness.temporaryDirectory, "user-data"), {
			recursive: true,
		});
		await writeFile(
			harness.catalogPath,
			JSON.stringify({
				projects: [
					{
						root: await realPath(root),
						ownership: "managed",
						createdAtMs: 1,
					},
				],
			}),
		);

		const repository = await harness.openRepository();
		expect(await Effect.runPromise(repository.listProjectsFx)).toEqual([]);
		await expect(access(join(root, "project.json"))).resolves.toBeUndefined();
		expect(JSON.parse(await readFile(harness.catalogPath, "utf8"))).toEqual({
			projects: [],
		});
	});

	it("keeps external disk edits hidden until the explicit hard refresh", async () => {
		const root = await harness.createExternalProject();
		const repository = await harness.openRepository();
		const opened = await Effect.runPromise(
			repository.openProjectFx({
				root,
			}),
		);
		const gamePath = join(root, "game.json");
		const game = JSON.parse(await readFile(gamePath, "utf8")) as {
			meta: {
				id: string;
				title: string;
			};
		};
		game.meta.id = "renamed-project";
		game.meta.title = "Changed outside the Editor";
		await writeFile(gamePath, `${JSON.stringify(game, null, "\t")}\n`);

		expect((await Effect.runPromise(repository.readProjectFx(opened.projectId)))?.title).toBe(
			opened.title,
		);
		expect(await Effect.runPromise(repository.listProjectsFx)).toEqual([
			{
				type: "valid",
				ownership: "external",
				project: expect.objectContaining({
					projectId: opened.projectId,
					title: opened.title,
				}),
			},
		]);
		const refreshed = await Effect.runPromise(repository.refreshProjectFx(opened.projectId));
		expect(refreshed.projectId).toBe("renamed-project");
		expect(refreshed.title).toBe("Changed outside the Editor");
		expect(await Effect.runPromise(repository.readProjectFx(opened.projectId))).toBeNull();
		expect(
			(await Effect.runPromise(repository.readProjectFx(refreshed.projectId)))?.title,
		).toBe("Changed outside the Editor");
		expect(await Effect.runPromise(repository.readProjectRootFx(refreshed.projectId))).toBe(
			await realPath(root),
		);
		expect(
			(await Effect.runPromise(repository.readProjectFx(refreshed.projectId)))?.projectId,
		).toBe(refreshed.projectId);
	});

	it("rejects a second root with the same authored project ID", async () => {
		const firstRoot = await harness.createExternalProject("shared-project");
		const secondRoot = await harness.createExternalProject("shared-project");
		const repository = await harness.openRepository();
		const first = await Effect.runPromise(
			repository.openProjectFx({
				root: firstRoot,
			}),
		);

		await expect(
			Effect.runPromise(
				repository.openProjectFx({
					root: secondRoot,
				}),
			),
		).rejects.toThrow("already open from another folder");
		expect(first.projectId).toBe("shared-project");
		expect(await Effect.runPromise(repository.listProjectsFx)).toHaveLength(1);
	});
});
