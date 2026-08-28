import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	createFilesystemEditorProjectTestHarness,
	type FilesystemEditorProjectTestHarness,
} from "./support/createFilesystemEditorProjectTestHarness";

let harness: FilesystemEditorProjectTestHarness;

beforeEach(async () => {
	harness = await createFilesystemEditorProjectTestHarness("arkini-fs-project-delete-");
});

afterEach(async () => harness.close());

describe("filesystem Editor project deletion", () => {
	it("permanently removes a managed project root", async () => {
		const repository = await harness.openRepository();
		const created = await harness.createProject(repository);
		const root = await Effect.runPromise(repository.readProjectRootFx(created.projectId));
		if (root === null) throw new Error("Managed project root missing.");

		await Effect.runPromise(repository.deleteProjectFx(created.projectId));

		await expect(access(root)).rejects.toBeDefined();
		expect(await Effect.runPromise(repository.listProjectsFx)).toEqual([]);
		await harness.closeRepository(repository);
		const reopened = await harness.openRepository();
		expect(await Effect.runPromise(reopened.listProjectsFx)).toEqual([]);
	});

	it("keeps a managed project registered when physical removal fails", async () => {
		const seeding = await harness.openRepository();
		const created = await harness.createProject(seeding);
		const root = await Effect.runPromise(seeding.readProjectRootFx(created.projectId));
		if (root === null) throw new Error("Managed project root missing.");
		await harness.closeRepository(seeding);

		const blockedRoot = join(harness.temporaryDirectory, "blocked-remove");
		await mkdir(blockedRoot);
		await writeFile(join(blockedRoot, "preserved"), "block removal");
		const nodeFileSystem = await Effect.runPromise(
			FileSystem.FileSystem.pipe(Effect.provide(NodeServices.layer)),
		);
		const fileSystem: FileSystem.FileSystem = {
			...nodeFileSystem,
			remove: (target, options) =>
				String(target) === root
					? nodeFileSystem.remove(blockedRoot, {
							recursive: false,
						})
					: nodeFileSystem.remove(target, options),
		};
		const repository = await harness.openRepository(fileSystem);

		await expect(
			Effect.runPromise(repository.deleteProjectFx(created.projectId)),
		).rejects.toThrow("could not be deleted");
		await expect(access(root)).resolves.toBeUndefined();
		expect(await Effect.runPromise(repository.listProjectsFx)).toEqual([
			expect.objectContaining({
				type: "valid",
				ownership: "managed",
				project: expect.objectContaining({
					projectId: created.projectId,
				}),
			}),
		]);

		await harness.closeRepository(repository);
		const reopened = await harness.openRepository();
		expect(await Effect.runPromise(reopened.listProjectsFx)).toEqual([
			expect.objectContaining({
				type: "valid",
				ownership: "managed",
				project: expect.objectContaining({
					projectId: created.projectId,
				}),
			}),
		]);
	});

	it("settles deletion after the managed root reaches its point of no return", async () => {
		const seeding = await harness.openRepository();
		const created = await harness.createProject(seeding);
		const root = await Effect.runPromise(seeding.readProjectRootFx(created.projectId));
		if (root === null) throw new Error("Managed project root missing.");
		await harness.closeRepository(seeding);

		const nodeFileSystem = await Effect.runPromise(
			FileSystem.FileSystem.pipe(Effect.provide(NodeServices.layer)),
		);
		let failCatalogCommit = false;
		const missing = join(harness.temporaryDirectory, "missing-catalog-write");
		const fileSystem: FileSystem.FileSystem = {
			...nodeFileSystem,
			remove: (target, options) =>
				nodeFileSystem.remove(target, options).pipe(
					String(target) === root
						? Effect.tap(() =>
								Effect.sync(() => {
									failCatalogCommit = true;
								}),
							)
						: Effect.tap(() => Effect.void),
				),
			rename: (from, to) => {
				if (String(to) !== harness.catalogPath || !failCatalogCommit)
					return nodeFileSystem.rename(from, to);
				failCatalogCommit = false;
				return nodeFileSystem.rename(missing, to);
			},
		};
		const repository = await harness.openRepository(fileSystem);

		await expect(
			Effect.runPromise(repository.deleteProjectFx(created.projectId)),
		).resolves.toBeUndefined();
		await expect(access(root)).rejects.toBeDefined();

		await harness.closeRepository(repository);
		const reopened = await harness.openRepository();
		expect(await Effect.runPromise(reopened.listProjectsFx)).toEqual([]);
	});
});
