import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	createProjectTestHarness,
	type ProjectTestHarness,
} from "./support/createProjectTestHarness";

let harness: ProjectTestHarness;
beforeEach(async () => {
	harness = await createProjectTestHarness("arkini-write-admission-");
});
afterEach(async () => harness.close());

describe("incremental write admission", () => {
	it.each([
		"key mismatch",
		"duplicate UID",
	] as const)(
		"rejects %s without publishing any part of a replacement config",
		async (failure) => {
			const repository = await harness.openRepository();
			const project = await harness.createProject(repository);
			const root = await Effect.runPromise(repository.readProjectRootFx(project.projectId));
			if (root === null) throw new Error("Project root missing.");
			const files = [
				"game.json",
				"project.json",
				"items/water.json",
			];
			const before = await Promise.all(files.map((file) => readFile(join(root, file))));
			const water = project.config.items.water;
			const items: typeof project.config.items =
				failure === "key mismatch"
					? {
							wrong: water,
						}
					: {
							water,
							other: {
								...water,
								id: "other",
							},
						};
			await expect(
				Effect.runPromise(
					repository.replaceConfigFx({
						projectId: project.projectId,
						expectedRevision: project.revision,
						config: {
							...project.config,
							items,
						},
					}),
				),
			).rejects.toBeDefined();
			expect(await Effect.runPromise(repository.readProjectFx(project.projectId))).toEqual(
				project,
			);
			expect(await Promise.all(files.map((file) => readFile(join(root, file))))).toEqual(
				before,
			);
		},
	);

	it("rejects a new asset colliding with an unchanged filename on case-insensitive filesystems", async () => {
		const repository = await harness.openRepository();
		const initial = await harness.createProject(repository);
		const project = await Effect.runPromise(
			repository.upsertResourcesFx({
				projectId: initial.projectId,
				resources: [
					{
						id: "Ore",
						mime: "image/png",
						bytes: Uint8Array.of(1, 2, 3),
					},
				],
			}),
		);
		const root = await Effect.runPromise(repository.readProjectRootFx(project.projectId));
		if (root === null) throw new Error("Project root missing.");
		const marker = await readFile(join(root, "project.json"));
		await expect(
			Effect.runPromise(
				repository.upsertResourcesFx({
					projectId: project.projectId,
					resources: [
						{
							id: "ore",
							mime: "image/png",
							bytes: Uint8Array.of(4, 5, 6),
						},
					],
				}),
			),
		).rejects.toBeDefined();
		expect(new Uint8Array(await readFile(join(root, "assets", "Ore.png")))).toEqual(
			Uint8Array.of(1, 2, 3),
		);
		expect(await readFile(join(root, "project.json"))).toEqual(marker);
		expect(await Effect.runPromise(repository.readProjectFx(project.projectId))).toEqual(
			project,
		);
	});

	it("keeps returned commit objects isolated from authoritative repository state", async () => {
		const repository = await harness.openRepository();
		const project = await harness.createProject(repository);
		const commit = await Effect.runPromise(
			repository.upsertItemFx({
				projectId: project.projectId,
				expectedRevision: project.revision,
				item: {
					...project.config.items.water,
					title: "Clean water",
				},
			}),
		);
		commit.config.items.water.title = "Mutated response";
		commit.version.major += 1;
		const current = await Effect.runPromise(repository.readProjectFx(project.projectId));
		expect(current?.config.items.water.title).toBe("Clean water");
		expect(current?.version).toEqual(project.version);
	});
});
