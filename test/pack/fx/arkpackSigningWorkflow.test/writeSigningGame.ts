import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createTestPngBytes } from "~test/bridge/arkpack/support/createTestPngBytes";

export const writeSigningGame = async (root: string) => {
	const gameDirectory = join(root, "game");
	await mkdir(join(gameDirectory, "assets"), {
		recursive: true,
	});
	await mkdir(join(gameDirectory, "items"), {
		recursive: true,
	});
	await writeFile(
		join(gameDirectory, "game.json"),
		`${JSON.stringify({
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
		join(gameDirectory, "items", "items.json"),
		`${JSON.stringify({
			items: {
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
			},
		})}\n`,
	);
	await writeFile(join(gameDirectory, "assets", "item.png"), createTestPngBytes());
	return gameDirectory;
};
