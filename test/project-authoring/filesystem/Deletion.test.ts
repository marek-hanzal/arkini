import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	createProjectTestHarness,
	type ProjectTestHarness,
} from "./support/createProjectTestHarness";

let harness: ProjectTestHarness;

beforeEach(async () => {
	harness = await createProjectTestHarness("arkini-fs-project-delete-");
});

afterEach(async () => harness.close());

describe("filesystem Editor project deletion", () => {
	it("dismisses the exact duplicate root without deleting either project's files", async () => {
		const seed = await harness.openRepository();
		const healthy = await harness.createProject(seed, "same-id");
		const healthyRoot = await Effect.runPromise(seed.readProjectRootFx(healthy.projectId));
		const duplicateRoot = await harness.createExternalProject("same-id");
		await harness.closeRepository(seed);
		const catalog = JSON.parse(await readFile(harness.catalogPath, "utf8"));
		catalog.projects.push({
			root: duplicateRoot,
			ownership: "external",
			createdAtMs: 1,
		});
		await writeFile(harness.catalogPath, JSON.stringify(catalog));
		const repository = await harness.openRepository();
		expect(await Effect.runPromise(repository.listProjectsFx)).toContainEqual(
			expect.objectContaining({
				type: "invalid",
				root: duplicateRoot,
			}),
		);
		for (const root of [
			healthyRoot!,
			"/unregistered",
		]) {
			await expect(
				Effect.runPromise(repository.dismissInvalidProjectFx(root)),
			).rejects.toThrow("not a currently blocked project");
		}
		await Effect.runPromise(repository.dismissInvalidProjectFx(duplicateRoot));
		await expect(access(join(duplicateRoot, "game.json"))).resolves.toBeUndefined();
		await expect(access(join(healthyRoot!, "game.json"))).resolves.toBeUndefined();
		await harness.closeRepository(repository);
		const reopened = await harness.openRepository();
		expect(await Effect.runPromise(reopened.listProjectsFx)).toEqual([
			expect.objectContaining({
				type: "valid",
				project: expect.objectContaining({
					projectId: "same-id",
				}),
			}),
		]);
	});

	it("keeps a dismissed managed folder off Recent across discovery and allows explicit reopen after repair", async () => {
		const seed = await harness.openRepository();
		const project = await harness.createProject(seed);
		const root = await Effect.runPromise(seed.readProjectRootFx(project.projectId));
		if (root === null) throw new Error("Managed root missing.");
		const manifest = join(root, "game.json");
		const original = await readFile(manifest, "utf8");
		await harness.closeRepository(seed);
		await writeFile(manifest, "{broken");
		const repository = await harness.openRepository();
		await Effect.runPromise(repository.dismissInvalidProjectFx(root));
		// A separate catalog update also reconciles managed directories.
		await harness.createProject(repository, "another-project");
		await harness.closeRepository(repository);
		const reopened = await harness.openRepository();
		expect(await Effect.runPromise(reopened.listProjectsFx)).toHaveLength(1);
		expect(await readFile(manifest, "utf8")).toBe("{broken");
		await writeFile(manifest, original);
		await Effect.runPromise(
			reopened.openProjectFx({
				root,
			}),
		);
		expect(await Effect.runPromise(reopened.listProjectsFx)).toContainEqual(
			expect.objectContaining({
				ownership: "managed",
				project: expect.objectContaining({
					projectId: project.projectId,
				}),
			}),
		);
		await Effect.runPromise(reopened.deleteProjectFx(project.projectId));
		await expect(access(root)).rejects.toBeDefined();
		await harness.closeRepository(reopened);
		const restored = await harness.openRepository();
		expect(await Effect.runPromise(restored.listProjectsFx)).toHaveLength(1);
	});

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
