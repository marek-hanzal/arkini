import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createTestPngBytes } from "~test/arkpack-support/fn/createTestPngBytes";
import {
	createProjectTestHarness,
	type ProjectTestHarness,
} from "./support/createProjectTestHarness";

let harness: ProjectTestHarness;
beforeEach(async () => {
	harness = await createProjectTestHarness("arkini-resource-admission-");
});
afterEach(async () => harness.close());

describe("resource write admission", () => {
	it.each([
		[
			"item-water",
			"ITEM-WATER",
		],
		[
			"café",
			"cafe\u0301",
		],
	])("rejects an aliased rename %s → %s before changing any files", async (from, to) => {
		const repository = await harness.openRepository();
		const initial = await harness.createProject(repository);
		const bytes = createTestPngBytes();
		const source = join(harness.temporaryDirectory, "source.png");
		await writeFile(source, bytes);
		const project = await Effect.runPromise(
			repository.upsertResourceFilesFx({
				projectId: initial.projectId,
				resources: [
					{
						id: from,
						type: "artwork",
						path: source,
						size: bytes.byteLength,
					},
				],
			}),
		);
		const root = await Effect.runPromise(repository.readProjectRootFx(project.projectId));
		if (root === null) throw new Error("Project root missing.");
		const files = [
			"game.json",
			"project.json",
			"items/water.json",
			`artwork/${from}.png`,
		];
		const before = await Promise.all(files.map((file) => readFile(join(root, file))));
		const names = await readdir(join(root, "artwork"));

		await expect(
			Effect.runPromise(
				repository.replaceResourceFx({
					projectId: project.projectId,
					expectedRevision: project.revision,
					currentId: from,
					config: project.config,
					resource: {
						id: to,
						type: "artwork",
					},
				}),
			),
		).rejects.toBeDefined();

		expect(await Promise.all(files.map((file) => readFile(join(root, file))))).toEqual(before);
		expect(await readdir(join(root, "artwork"))).toEqual(names);
		expect(await Effect.runPromise(repository.readProjectFx(project.projectId))).toEqual(
			project,
		);
	});

	it("rejects a cross-type import before replacing source bytes or references", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository);
		const root = await Effect.runPromise(repository.readProjectRootFx(project.projectId));
		if (root === null) throw new Error("Project root missing.");
		const files = [
			"game.json",
			"project.json",
			"items/water.json",
			"artwork/item-water.png",
		];
		const before = await Promise.all(files.map((file) => readFile(join(root, file))));
		const source = join(harness.temporaryDirectory, "image.png");
		const bytes = createTestPngBytes();
		await writeFile(source, bytes);

		await expect(
			Effect.runPromise(
				repository.upsertResourceFilesFx({
					projectId: project.projectId,
					resources: [
						{
							id: "new-image",
							type: "image",
							path: source,
							size: bytes.byteLength,
						},
						{
							id: "item-water",
							type: "image",
							path: source,
							size: bytes.byteLength,
						},
					],
				}),
			),
		).rejects.toMatchObject({
			operation: "upsert-resource",
		});

		expect(await Promise.all(files.map((file) => readFile(join(root, file))))).toEqual(before);
		expect(await readdir(join(root, "image"))).not.toContain("new-image.png");
		expect(await Effect.runPromise(repository.readProjectFx(project.projectId))).toEqual(
			project,
		);
	});
});
