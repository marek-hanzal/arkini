import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateSources } from "./package";

const tempDirs: string[] = [];

const createTempPackageFile = async (value: unknown) => {
	const dir = await mkdtemp(join(tmpdir(), "arkini-game-package-"));
	tempDirs.push(dir);
	const path = join(dir, "package.json");

	await writeFile(path, JSON.stringify(value));

	return path;
};

afterEach(async () => {
	await Promise.all(
		tempDirs.splice(0).map((dir) =>
			rm(dir, {
				force: true,
				recursive: true,
			}),
		),
	);
});

describe("game package normalization", () => {
	it("derives missing product names from the primary output item", async () => {
		const path = await createTempPackageFile({
			version: 1,
			game: {
				id: "game:test",
				title: "Test",
				board: {
					height: 2,
					width: 2,
				},
				inventory: {
					slots: 2,
				},
			},
			resources: {
				"producer-test": {
					data: "producer-resource",
				},
				"item-plank": {
					data: "plank-resource",
				},
			},
			items: {
				"item:plank": {
					description: "Plank",
					name: "Plank",
				},
				"producer:test": {
					description: "Producer",
					name: "Producer",
				},
			},
			merge: {},
			requirements: {},
			effects: {},
			producers: {
				"producer:test": {
					productIds: [
						"product:test",
					],
				},
			},
			stashes: {},
			craftRecipes: {},
			products: {
				"product:test": {
					durationMs: 1000,
					output: [
						{
							itemId: "item:plank",
							type: "guaranteed",
						},
					],
				},
			},
			startingState: {
				board: [
					{
						itemId: "producer:test",
						x: 0,
						y: 0,
					},
				],
				inventory: [],
			},
		});

		const config = await validateSources([
			path,
		]);

		expect(config.products["product:test"]?.name).toBe("Plank");
	});
});
