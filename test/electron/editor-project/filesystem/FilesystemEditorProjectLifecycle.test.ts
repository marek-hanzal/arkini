import { access, mkdir, readFile, realpath, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

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
		expect(JSON.parse(await readFile(join(root ?? "", "editor.json"), "utf8"))).toMatchObject({
			format: "arkini-editor",
			formatVersion: 1,
			arkpackVersion: "1.0",
		});

		await harness.closeRepository(repository);
		const reopened = await harness.openRepository();
		expect(await Effect.runPromise(reopened.readProjectFx(created.projectId))).toEqual(created);
	});

	it("opens an external folder in place and unregisters it without deleting its files", async () => {
		const root = await harness.createExternalProject();
		const repository = await harness.openRepository();
		const opened = await Effect.runPromise(
			repository.openProjectFx({
				root,
			}),
		);
		expect(await Effect.runPromise(repository.readProjectRootFx(opened.projectId))).toBe(
			await realpath(root),
		);

		await Effect.runPromise(repository.deleteProjectFx(opened.projectId));
		await expect(access(join(root, "editor.json"))).resolves.toBeUndefined();
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
				formatVersion: 1,
				projects: [
					{
						projectId: "unsafe-managed-project",
						root: await realpath(root),
						ownership: "managed",
						createdAtMs: 1,
					},
				],
			}),
		);

		const repository = await harness.openRepository();
		expect(await Effect.runPromise(repository.listProjectsFx)).toEqual([]);
		await expect(access(join(root, "editor.json"))).resolves.toBeUndefined();
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
				formatVersion: 1,
				projects: [
					{
						projectId: "unsafe-symlink-project",
						root: linkedRoot,
						ownership: "managed",
						createdAtMs: 1,
					},
				],
			}),
		);

		const repository = await harness.openRepository();
		expect(await Effect.runPromise(repository.listProjectsFx)).toEqual([]);
		await expect(access(join(root, "editor.json"))).resolves.toBeUndefined();
	});

	it("keeps valid catalog entries when a neighboring entry is malformed", async () => {
		const root = await harness.createExternalProject();
		await mkdir(join(harness.temporaryDirectory, "user-data"), {
			recursive: true,
		});
		await writeFile(
			harness.catalogPath,
			JSON.stringify({
				formatVersion: 1,
				projects: [
					{
						projectId: "broken",
					},
					{
						projectId: "valid-external",
						root: await realpath(root),
						ownership: "external",
						createdAtMs: 1,
					},
				],
			}),
		);

		const repository = await harness.openRepository();
		expect(await Effect.runPromise(repository.listProjectsFx)).toEqual([
			expect.objectContaining({
				projectId: "valid-external",
			}),
		]);
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
				formatVersion: 1,
				projects: [
					{
						projectId: "canonical",
						root,
						ownership: "external",
						createdAtMs: 1,
					},
					{
						projectId: "alias",
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
			"canonical",
		]);
		await harness.closeRepository(repository);

		const reopened = await harness.openRepository();
		expect(
			(await Effect.runPromise(reopened.listProjectsFx)).map(({ projectId }) => projectId),
		).toEqual([
			"canonical",
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
		const gamePath = join(root, "game.json");
		const game = JSON.parse(await readFile(gamePath, "utf8")) as {
			meta: {
				title: string;
			};
		};
		game.meta.title = "Changed outside the Editor";
		await writeFile(gamePath, `${JSON.stringify(game, null, "\t")}\n`);

		expect((await Effect.runPromise(repository.readProjectFx(opened.projectId)))?.title).toBe(
			opened.title,
		);
		const refreshed = await Effect.runPromise(repository.refreshProjectFx(opened.projectId));
		expect(refreshed.title).toBe("Changed outside the Editor");
		expect((await Effect.runPromise(repository.readProjectFx(opened.projectId)))?.title).toBe(
			"Changed outside the Editor",
		);
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
				versionId: first.versionId,
				versionIds: [
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
