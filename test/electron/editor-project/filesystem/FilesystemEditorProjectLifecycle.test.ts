import { access, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem, PlatformError } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ArkiniAppVersion } from "../../../../shared/ArkiniAppMetadata";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";
import {
	createFilesystemEditorProjectTestHarness,
	type FilesystemEditorProjectTestHarness,
} from "./support/createFilesystemEditorProjectTestHarness";

let harness: FilesystemEditorProjectTestHarness;

const realPath = (root: string) =>
	Effect.runPromise(
		FileSystem.FileSystem.pipe(
			Effect.flatMap((fileSystem) => fileSystem.realPath(root)),
			Effect.provide(NodeServices.layer),
		),
	);

beforeEach(async () => {
	harness = await createFilesystemEditorProjectTestHarness("arkini-fs-project-");
});

afterEach(async () => harness.close());

describe("filesystem Editor project lifecycle", () => {
	it("reopens managed projects from the user-data catalog", async () => {
		const repository = await harness.openRepository();
		const created = await harness.createProject(repository);
		const root = await Effect.runPromise(repository.readProjectRootFx(created.projectId));
		expect(root).toContain(harness.projectsRoot);
		expect(JSON.parse(await readFile(join(root ?? "", "project.json"), "utf8"))).toMatchObject({
			arkini: ArkiniAppVersion,
			revision: expect.any(Number),
		});
		expect(JSON.parse(await readFile(join(root ?? "", "game.json"), "utf8"))).toMatchObject({
			version: "1.0",
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

	it("freshly reopens the old project after an injected commit failure", async () => {
		const repository = await harness.openRepository();
		const created = await harness.createProject(repository);
		const root = await Effect.runPromise(repository.readProjectRootFx(created.projectId));
		if (root === null) throw new Error("Managed project root missing.");
		await harness.closeRepository(repository);
		const nodeFileSystem = await Effect.runPromise(
			FileSystem.FileSystem.pipe(Effect.provide(NodeServices.layer)),
		);
		const fileSystem: FileSystem.FileSystem = {
			...nodeFileSystem,
			rename: (from, to) =>
				String(to) === join(root, "game.json")
					? Effect.fail(
							PlatformError.systemError({
								_tag: "Unknown",
								module: "FileSystem",
								method: "rename",
								description: "injected commit failure",
							}),
						)
					: nodeFileSystem.rename(from, to),
		};
		const failing = await harness.openRepository(fileSystem);
		await expect(
			Effect.runPromise(
				failing.replaceConfigFx({
					projectId: created.projectId,
					expectedRevision: created.revision,
					config: {
						...created.config,
						meta: {
							...created.config.meta,
							title: "Must roll back",
						},
					},
				}),
			),
		).rejects.toBeDefined();
		await harness.closeRepository(failing);

		const reopened = await harness.openRepository();
		const restored = await Effect.runPromise(reopened.readProjectFx(created.projectId));
		expect(restored?.title).toBe(created.title);
		expect(restored?.revision).toBe(created.revision);
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

	it("preserves a managed root when its write recovery cannot complete", async () => {
		const repository = await harness.openRepository();
		const created = await harness.createProject(repository);
		const root = await Effect.runPromise(repository.readProjectRootFx(created.projectId));
		if (root === null) throw new Error("Managed project root missing.");
		await harness.closeRepository(repository);
		const recovery = join(root, "editor.lock.write");
		await mkdir(recovery);
		await writeFile(join(recovery, "preserved"), "backup");

		const reopened = await harness.openRepository();
		expect(await Effect.runPromise(reopened.listProjectsFx)).toEqual([
			expect.objectContaining({
				type: "invalid",
				root,
				validationError: expect.stringContaining(recovery),
			}),
		]);
		await expect(readFile(join(recovery, "preserved"), "utf8")).resolves.toBe("backup");
		expect(JSON.parse(await readFile(harness.catalogPath, "utf8"))).toMatchObject({
			projects: [
				{
					root,
					ownership: "managed",
				},
			],
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

	it("ignores a managed symlink that escapes the owned projects directory", async () => {
		const root = await harness.createExternalProject();
		await mkdir(harness.projectsRoot, {
			recursive: true,
		});
		const linkedRoot = join(harness.projectsRoot, "escaped-project");
		await symlink(root, linkedRoot);
		await writeFile(
			harness.catalogPath,
			JSON.stringify({
				projects: [
					{
						root: linkedRoot,
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

	it("removes a catalog alias for an already mounted canonical root", async () => {
		const root = await harness.createExternalProject();
		const alias = join(harness.temporaryDirectory, "external-alias");
		await symlink(root, alias);
		await mkdir(join(harness.temporaryDirectory, "user-data"), {
			recursive: true,
		});
		await writeFile(
			harness.catalogPath,
			JSON.stringify({
				projects: [
					{
						root,
						ownership: "external",
						createdAtMs: 1,
					},
					{
						root: alias,
						ownership: "external",
						createdAtMs: 1,
					},
				],
			}),
		);

		const repository = await harness.openRepository();
		expect(
			(await Effect.runPromise(repository.listProjectsFx)).map((candidate) =>
				candidate.type === "valid" ? candidate.project.projectId : candidate.root,
			),
		).toEqual([
			editorTestPayload.config.meta.id,
		]);
		await harness.closeRepository(repository);

		const reopened = await harness.openRepository();
		expect(
			(await Effect.runPromise(reopened.listProjectsFx)).map((candidate) =>
				candidate.type === "valid" ? candidate.project.projectId : candidate.root,
			),
		).toEqual([
			editorTestPayload.config.meta.id,
		]);
	});

	it("keeps external disk edits hidden until the explicit hard refresh", async () => {
		const root = await harness.createExternalProject();
		const repository = await harness.openRepository();
		const opened = await Effect.runPromise(
			repository.openProjectFx({
				root,
			}),
		);
		const version = await Effect.runPromise(
			repository.createVersionFx({
				projectId: opened.projectId,
				subject: "Before rename",
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
		await expect(
			Effect.runPromise(
				repository.checkoutVersionFx({
					projectId: refreshed.projectId,
					versionId: version.versionId,
				}),
			),
		).rejects.toThrow(`belongs to Editor project ${opened.projectId}`);
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

	it("keeps external version-head edits hidden until the explicit hard refresh", async () => {
		const repository = await harness.openRepository();
		const created = await harness.createProject(repository);
		const initialStatus = await Effect.runPromise(
			repository.readVersionStatusFx(created.projectId),
		);
		const first = await Effect.runPromise(
			repository.createVersionFx({
				projectId: created.projectId,
				expectedFingerprint: initialStatus.currentFingerprint,
				subject: "Initial",
			}),
		);
		const changed = await Effect.runPromise(
			repository.replaceConfigFx({
				projectId: created.projectId,
				expectedRevision: created.revision,
				config: {
					...created.config,
					meta: {
						...created.config.meta,
						title: "Changed",
					},
				},
			}),
		);
		const second = await Effect.runPromise(
			repository.createVersionFx({
				projectId: created.projectId,
				subject: "Changed",
			}),
		);
		const root = await Effect.runPromise(repository.readProjectRootFx(created.projectId));
		if (root === null) throw new Error("Managed project root missing.");
		await writeFile(
			join(root, "versions", "head.json"),
			JSON.stringify({
				current: first.versionId,
				versions: [
					first.versionId,
				],
			}),
		);

		expect(
			(await Effect.runPromise(repository.listVersionsFx(created.projectId))).map(
				({ versionId }) => versionId,
			),
		).toEqual([
			second.versionId,
			first.versionId,
		]);
		expect(changed.previousRevision).toBe(created.revision);

		await Effect.runPromise(repository.refreshProjectFx(created.projectId));
		expect(
			(await Effect.runPromise(repository.listVersionsFx(created.projectId))).map(
				({ versionId }) => versionId,
			),
		).toEqual([
			first.versionId,
		]);
	});
});
