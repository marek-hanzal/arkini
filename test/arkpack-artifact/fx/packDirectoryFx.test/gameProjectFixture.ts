import { FileSystem, Path } from "effect";
import { Effect } from "effect";

import { GameProjectJsonSchema } from "~/game-config-source/schema/GameProjectJsonSchema";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { ArkiniAppVersion } from "../../../../shared/ArkiniAppMetadata";

/** Smallest signature-bearing PNG fixture needed by artifact packing. */
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
		portal: {
			uid: "portal",
			id: "portal",
			type: "space",
			space: 9,
			title: "Portal",
			description: "Portal",
			asset: {
				default: [
					"item-water",
				],
			},
			scope: "any",
			maxStackSize: 1,
		},
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
	const simpleItems = path.join(input, "items", "simple");
	const spaceItems = path.join(input, "items", "space");
	const assets = path.join(input, "assets");
	const resources = path.join(input, "resources");
	const { items: authoredItems, ...root } = config;

	yield* fileSystem.makeDirectory(simpleItems, {
		recursive: true,
	});
	yield* fileSystem.makeDirectory(spaceItems, {
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
		JSON.stringify(GameProjectJsonSchema),
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
		path.join(simpleItems, "water.json"),
		JSON.stringify({
			$schema: "../../schema.json",
			item: authoredItems.water,
		}),
	);
	yield* fileSystem.writeFileString(
		path.join(spaceItems, "portal.json"),
		JSON.stringify({
			$schema: "../../schema.json",
			item: authoredItems.portal,
		}),
	);
	yield* fileSystem.writeFile(path.join(resources, "hero.png"), png);
	yield* fileSystem.writeFile(path.join(assets, "item-water.png"), png);

	return input;
});
