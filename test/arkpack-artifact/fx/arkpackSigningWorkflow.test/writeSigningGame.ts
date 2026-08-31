import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ArkiniAppVersion } from "~shared/ArkiniAppMetadata";
import { GameProjectJsonSchema } from "~/game-config-source/schema/GameProjectJsonSchema";
import { createTestPngBytes } from "~test/arkpack-support/fn/createTestPngBytes";

export const writeSigningGame = async (root: string) => {
	const gameDirectory = join(root, "game");
	await mkdir(join(gameDirectory, "assets"), {
		recursive: true,
	});
	await mkdir(join(gameDirectory, "items", "simple"), {
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
			version: "1.0",
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
				hero: "item",
			},
			start: {
				currentSpace: 0,
			},
		})}\n`,
	);
	await writeFile(
		join(gameDirectory, "items", "simple", "item.json"),
		`${JSON.stringify({
			$schema: "../../schema.json",
			item: {
				uid: "item",
				id: "item",
				type: "simple",
				title: "Item",
				description: "Signing fixture item.",
				asset: {
					default: [
						"item",
					],
				},
				scope: "any",
				maxStackSize: 1,
			},
		})}\n`,
	);
	await writeFile(join(gameDirectory, "assets", "item.png"), createTestPngBytes());
	return gameDirectory;
};
