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
					producer: {
						lines: [
							{
								durationMs: 1000,
								id: "line:test",
								output: [
									{
										itemId: "item:plank",
										type: "guaranteed",
									},
								],
							},
						],
					},
				},
			},
			effects: {},
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

		expect(config.items["producer:test"]?.producer?.lines[0]?.name).toBe("Plank");
		expect(config.assets["asset:item:plank"]).not.toHaveProperty("kind");
		expect(config.assets["asset:producer:test"]).not.toHaveProperty("kind");
	});
});
