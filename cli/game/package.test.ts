import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { compileDirectory, validateSources } from "./package";
import { GAME_HERO_ASSET_ID } from "../../src/config/GameWellKnownAssetIds";
import { loadGameConfigPackFromFile } from "../../src/config/pack/loadGameConfigPackFromFile";

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
	it("derives missing line names from the primary output item", async () => {
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

const pngMagicBytes = Buffer.from("89504e470d0a1a0a", "hex");

const createTempSourcePackage = async (value: unknown) => {
	const dir = await mkdtemp(join(tmpdir(), "arkini-game-source-package-"));
	tempDirs.push(dir);
	await writeFile(join(dir, "game.json"), JSON.stringify(value));
	return dir;
};

describe("game package compiler", () => {
	it("ignores JSON Schema files alongside source fragments", async () => {
		const sourceDir = await createTempSourcePackage({
			$schema: "./arkini.schema.json",
			version: 1,
			game: {
				id: "game:test",
				title: "Test",
				board: {
					height: 1,
					width: 1,
				},
				inventory: {
					slots: 1,
				},
			},
			resources: {
				"item-test": {
					data: "item-resource",
				},
			},
			items: {
				"item:test": {
					description: "Test item",
					name: "Test item",
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:test",
						x: 0,
						y: 0,
					},
				],
				inventory: [],
			},
		});
		await writeFile(
			join(sourceDir, "arkini.schema.json"),
			JSON.stringify({
				$schema: "https://json-schema.org/draft/2020-12/schema",
				type: "not-a-game-config-fragment",
			}),
		);

		const config = await validateSources([
			sourceDir,
		]);

		expect(config.items["item:test"]?.name).toBe("Test item");
	});

	it("writes a binary arkpack and does not require split compiled artifacts", async () => {
		const sourceDir = await createTempSourcePackage({
			version: 1,
			game: {
				id: "game:test",
				title: "Test",
				board: {
					height: 1,
					width: 1,
				},
				inventory: {
					slots: 1,
				},
			},
			items: {
				"item:test": {
					description: "Test item",
					name: "Test item",
				},
			},
			startingState: {
				board: [
					{
						itemId: "item:test",
						x: 0,
						y: 0,
					},
				],
				inventory: [],
			},
		});
		await mkdir(join(sourceDir, "assets"));
		await writeFile(join(sourceDir, "assets", "hero.png"), pngMagicBytes);
		await writeFile(join(sourceDir, "assets", "item-test.png"), pngMagicBytes);

		const result = await compileDirectory({
			inputDir: sourceDir,
		});
		const decoded = await loadGameConfigPackFromFile(result.packPath);

		expect(result.packPath.endsWith(".game.arkpack")).toBe(true);
		expect(decoded.items["item:test"]?.name).toBe("Test item");
		expect(decoded.assets[GAME_HERO_ASSET_ID]).toMatchObject({
			resourceId: "hero",
		});
		expect(decoded.resources["hero"]?.data).toBe(pngMagicBytes.toString("base64"));
		expect(decoded.resources["item-test"]?.data).toBe(pngMagicBytes.toString("base64"));
	});
});
