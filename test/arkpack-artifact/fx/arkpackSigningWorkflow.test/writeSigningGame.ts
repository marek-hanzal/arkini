import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ArkiniAppVersion } from "~shared/ArkiniAppMetadata";
import { GameProjectJsonSchema } from "~/game-config-source/schema/GameProjectJsonSchema";
import { createTestPngBytes } from "~test/arkpack-support/fn/createTestPngBytes";

export const writeSigningGame = async (root: string) => {
	const gameDirectory = join(root, "game");
	await mkdir(join(gameDirectory, "artwork"), {
		recursive: true,
	});
	await mkdir(join(gameDirectory, "image"), {
		recursive: true,
	});
	await mkdir(join(gameDirectory, "items"), {
		recursive: true,
	});
	await writeFile(
		join(gameDirectory, "project.json"),
		`${JSON.stringify({
			arkini: ArkiniAppVersion,
			revision: 1,
		})}\n`,
	);
	await writeFile(
		join(gameDirectory, "schema.json"),
		`${JSON.stringify(GameProjectJsonSchema)}\n`,
	);
	await writeFile(
		join(gameDirectory, "game.json"),
		`${JSON.stringify({
			$schema: "./schema.json",
			version: {
				major: 1,
				minor: 0,
			},
			meta: {
				id: "game:signing-workflow",
				title: "Signing workflow",
				board: {
					width: 2,
					height: 2,
				},
				inventory: {
					width: 1,
					height: 1,
				},
			},
			resources: {
				hero: "hero",
			},
			start: {
				currentSpace: 0,
			},
		})}\n`,
	);
	await writeFile(
		join(gameDirectory, "items", "item.json"),
		`${JSON.stringify({
			$schema: "../schema.json",
			item: {
				maxQueueSize: 1,
				lines: [],

				uid: "item",
				id: "item",

				title: "Item",
				description: "Signing fixture item.",
				artwork: {
					scale: 0.8,
					default: [
						"item",
					],
				},
				scope: "any",
				maxStackSize: 1,
			},
		})}\n`,
	);
	await writeFile(join(gameDirectory, "artwork", "item.png"), createTestPngBytes());
	await writeFile(join(gameDirectory, "image", "hero.png"), createTestPngBytes());
	return gameDirectory;
};
