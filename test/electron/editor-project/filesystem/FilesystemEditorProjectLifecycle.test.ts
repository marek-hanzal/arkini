import { access, mkdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ArkiniAppVersion } from "../../../../shared/ArkiniAppMetadata";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";
import {
	createFilesystemEditorProjectTestHarness,
	type FilesystemEditorProjectTestHarness,
} from "./support/createFilesystemEditorProjectTestHarness";

let harness: FilesystemEditorProjectTestHarness;

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
		let markerReplaced = false;
		let syncFailed = false;
		const fileSystem: FileSystem.FileSystem = {
			...nodeFileSystem,
			rename: (from, to) =>
				nodeFileSystem
					.rename(from, to)
					.pipe(
						Effect.tap(() =>
							Effect.sync(
								() =>
									(markerReplaced ||= String(to) === join(root, "project.json")),
							),
						),
					),
			open: (target, options) => {
				if (markerReplaced && !syncFailed && String(target) === root) {
					syncFailed = true;
					return nodeFileSystem.open(
						join(harness.temporaryDirectory, "missing"),
						options,
					);
				}
				return nodeFileSystem.open(target, options);
			},
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

	it("removes an unregistered managed directory left by interrupted creation", async () => {
		await mkdir(harness.projectsRoot, {
			recursive: true,
		});
		const orphan = join(harness.projectsRoot, "orphan");
		await mkdir(orphan);
		await writeFile(join(orphan, "project.json"), "partial");

		const repository = await harness.openRepository();
		expect(await Effect.runPromise(repository.listProjectsFx)).toEqual([]);
		await expect(access(orphan)).rejects.toBeDefined();
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
		expect(await Effect.runPromise(reopened.listProjectsFx)).toEqual([]);
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
			await realpath(root),
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
						root: await realpath(root),
						ownership: "managed",
						createdAtMs: 1,
					},
				],
			}),
		);

		const repository = await harness.openRepository();
		expect(await Effect.runPromise(repository.listProjectsFx)).toEqual([]);
		await expect(access(join(root, "project.json"))).resolves.toBeUndefined();
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
			(await Effect.runPromise(repository.listProjectsFx)).map(({ projectId }) => projectId),
		).toEqual([
			editorTestPayload.config.meta.id,
		]);
		await harness.closeRepository(repository);

		const reopened = await harness.openRepository();
		expect(
			(await Effect.runPromise(reopened.listProjectsFx)).map(({ projectId }) => projectId),
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
		const refreshed = await Effect.runPromise(repository.refreshProjectFx(opened.projectId));
		expect(refreshed.projectId).toBe("renamed-project");
		expect(refreshed.title).toBe("Changed outside the Editor");
		expect(await Effect.runPromise(repository.readProjectFx(opened.projectId))).toBeNull();
		expect(
			(await Effect.runPromise(repository.readProjectFx(refreshed.projectId)))?.title,
		).toBe("Changed outside the Editor");
		expect(await Effect.runPromise(repository.readProjectRootFx(refreshed.projectId))).toBe(
			await realpath(root),
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
