import * as NodeServices from "@effect/platform-node/NodeServices";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Effect, FileSystem, PlatformError } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	createProjectTestHarness,
	type ProjectTestHarness,
} from "./support/createProjectTestHarness";

let harness: ProjectTestHarness;
beforeEach(async () => {
	harness = await createProjectTestHarness("arkini-resource-recovery-");
});
afterEach(async () => harness.close());

describe("resource metadata commit recovery", () => {
	it("rolls back a postwrite metadata failure and builds restored PNGs without refreshing", async () => {
		const fs = await Effect.runPromise(
			FileSystem.FileSystem.pipe(Effect.provide(NodeServices.layer)),
		);
		let inject = false;
		let published = false;
		let failures = 0;
		const repository = await harness.openRepository({
			...fs,
			rename: (from, to) =>
				fs.rename(from, to).pipe(
					Effect.tap(() =>
						Effect.sync(() => {
							if (inject && to.endsWith(".png") && from === `${to}.arkini-replace`)
								published = true;
						}),
					),
				),
			stat: (path) => {
				if (inject && published && path.endsWith(".png")) {
					inject = false;
					failures += 1;
					return Effect.fail(
						PlatformError.systemError({
							_tag: "Unknown",
							module: "FileSystem",
							method: "stat",
							description: "Injected postwrite stat failure",
						}),
					);
				}
				return fs.stat(path);
			},
		});
		const project = await harness.createProject(repository);
		const root = await Effect.runPromise(repository.readProjectRootFx(project.projectId));
		if (root === null) throw new Error("Project root missing.");
		const assetPath = join(root, "assets", "item-water.png");
		const markerPath = join(root, "project.json");
		const before = await Promise.all([
			readFile(assetPath),
			readFile(markerPath),
		]);
		inject = true;
		await expect(
			Effect.runPromise(
				repository.replaceResourceFx({
					projectId: project.projectId,
					expectedRevision: project.revision,
					config: project.config,
					currentId: "item-water",
					resource: {
						id: "item-water",
						mime: "image/png",
						bytes: Uint8Array.of(1, 2, 3),
					},
				}),
			),
		).rejects.toBeDefined();
		expect(failures).toBe(1);
		expect(
			await Promise.all([
				readFile(assetPath),
				readFile(markerPath),
			]),
		).toEqual(before);
		expect(await Effect.runPromise(repository.readProjectFx(project.projectId))).toEqual(
			project,
		);
		await expect(
			Effect.runPromise(
				repository.buildProjectFx({
					projectId: project.projectId,
					expectedRevision: project.revision,
					expectedVersion: project.version,
				}),
			),
		).resolves.toMatchObject({
			revision: project.revision,
			version: "1.0",
		});
		expect(
			await Promise.all([
				readFile(assetPath),
				readFile(markerPath),
			]),
		).toEqual(before);
		await harness.closeRepository(repository);
		const reopened = await harness.openRepository();
		const restored = await Effect.runPromise(reopened.readProjectFx(project.projectId));
		expect(restored?.config).toEqual(project.config);
		expect(restored?.revision).toBe(project.revision);
	});
});
