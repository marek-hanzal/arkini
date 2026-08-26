import { FileSystem, Path } from "effect";
import { Effect } from "effect";

import { createGameProjectJsonSchema } from "~/engine/schema/fx/writeGameProjectJsonSchemaFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { ArkiniAppVersion } from "../../../../shared/ArkiniAppMetadata";

export const png = new Uint8Array([
	0x89,
	0x50,
	0x4e,
	0x47,
	0x0d,
	0x0a,
	0x1a,
	0x0a,
]);

const config = GameConfigSchema.parse({
	meta: {
		id: "project-game",
		title: "Project game",
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
		board: [],
		inventory: [],
	},
	items: {
		water: {
			uid: "water",
			id: "water",
			type: "simple",
			title: "Water",
			description: "Water",
			asset: {
				default: [
					"item-water",
				],
			},
			scope: "any",
			maxStackSize: 10,
		},
	},
});

export const writeGameProjectFixtureFx = Effect.fn("writeGameProjectFixtureFx")(function* () {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const input = yield* fileSystem.makeTempDirectoryScoped();
	const items = path.join(input, "items", "simple");
	const assets = path.join(input, "assets");
	const resources = path.join(input, "resources");
	const { items: authoredItems, ...root } = config;

	yield* fileSystem.makeDirectory(items, {
		recursive: true,
	});
	yield* fileSystem.makeDirectory(assets, {
		recursive: true,
	});
	yield* fileSystem.makeDirectory(resources, {
		recursive: true,
	});
	yield* fileSystem.writeFileString(
		path.join(input, "project.json"),
		JSON.stringify({
			arkini: ArkiniAppVersion,
			revision: 1,
		}),
	);
	yield* fileSystem.writeFileString(
		path.join(input, "schema.json"),
		JSON.stringify(createGameProjectJsonSchema()),
	);
	yield* fileSystem.writeFileString(
		path.join(input, "game.json"),
		JSON.stringify({
			$schema: "./schema.json",
			version: "2.3",
			...root,
		}),
	);
	yield* fileSystem.writeFileString(
		path.join(items, "water.json"),
		JSON.stringify({
			$schema: "../../schema.json",
			item: authoredItems.water,
		}),
	);
	yield* fileSystem.writeFile(path.join(resources, "hero.png"), png);
	yield* fileSystem.writeFile(path.join(assets, "item-water.png"), png);

	return input;
});
