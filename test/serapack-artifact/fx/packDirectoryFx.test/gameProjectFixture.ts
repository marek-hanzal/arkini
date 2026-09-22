import { FileSystem, Path } from "effect";
import { Effect } from "effect";

import { GameProjectJsonSchema } from "~/game-config-source/schema/GameProjectJsonSchema";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { SerakkiAppVersion } from "~shared/SerakkiAppMetadata";
import { createTestOggOpusBytesFn } from "~test/game-config-resource/support/createTestOggOpusBytesFn";
import sharp from "sharp";

export const png = Uint8Array.from(
	Buffer.from(
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
		"base64",
	),
);

/** 512 × 128 RGBA PNG with uniform half-opacity for resize and alpha assertions. */
export const assetPng = Uint8Array.from(
	Buffer.from(
		"iVBORw0KGgoAAAANSUhEUgAAAgAAAACACAYAAAB9V9ELAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAB0UlEQVR42u3WMQ0AAAjAMOSgCTXIQxY2SOhRA7sWk9UAwC8hAgAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAAAwAACAAQAADAAAYAAAAAMAABgAAMAAAAAGAAAwAACAAQAADAAAYAAAAAMAABgAAMAAAAAGAAAwAABgAAAAAwAAGAAAwAAAAAYAADAAAIABAAAMAABgAAAAAwAAGAAAwAAAAAYAADAAAIABAAAMAABgAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAACAARACAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAMgAgAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAADAAAAABgAAMAAAgAEAAAwAAGAAAAADAAAYAAAwAACAAQAADAAAYAAAAAMAABgAAMAAAAAGAAAwAACAAQAADAAAYAAAAAMAABgAAMAAAAAGAAAwAABgAAAAAwAAGAAAwAAAAAYAADAAAMBtC+C0GtcxrB0UAAAAAElFTkSuQmCC",
		"base64",
	),
);

export const musicOgg = createTestOggOpusBytesFn();
export const sfxOgg = createTestOggOpusBytesFn();

const config = GameConfigSchema.parse({
	meta: {
		id: "project-game",
		title: "Project game",
		board: {
			width: 2,
			height: 2,
		},
	},
	resources: {
		hero: "hero",
	},
	music: {
		playlist: [
			"theme",
		],
	},
	sfx: {
		events: {
			"job:started": "job-start",
		},
	},
	start: {
		currentSpace: 0,
		board: [],
	},
	items: {
		portal: {
			uid: "portal",
			id: "portal",

			lines: [
				{
					id: "travel",
					title: "Travel",
					description: "Travel",
					default: true,
					runtimeMs: 0,
					input: [
						{
							type: "simple",
						},
					],
					rules: [],
					outcome: {
						set: [
							{
								rules: [],
								roll: [
									{
										type: "guaranteed",
										outcome: [
											{
												type: "space",
												space: 9,
												rules: [],
											},
										],
									},
								],
							},
						],
					},
				},
			],

			title: "Portal",
			description: "Portal",
			artwork: {
				scale: 1,
				default: [
					"item-water",
				],
			},
		},
		water: {
			maxQueueSize: 1,
			lines: [],

			uid: "water",
			id: "water",

			title: "Water",
			description: "Water",
			artwork: {
				scale: 0.65,
				default: [
					"item-water",
				],
			},
		},
	},
});

export const writeGameProjectFixtureFx = Effect.fn("writeGameProjectFixtureFx")(function* () {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const input = yield* fileSystem.makeTempDirectoryScoped();
	const itemDirectory = path.join(input, "items");
	const artwork = path.join(input, "artwork");
	const image = path.join(input, "image");
	const musicDirectory = path.join(input, "music");
	const sfxDirectory = path.join(input, "sfx");
	const { items: authoredItems, ...root } = config;

	yield* fileSystem.makeDirectory(itemDirectory, {
		recursive: true,
	});
	yield* fileSystem.makeDirectory(artwork, {
		recursive: true,
	});
	yield* fileSystem.makeDirectory(image, {
		recursive: true,
	});
	yield* fileSystem.makeDirectory(musicDirectory, {
		recursive: true,
	});
	yield* fileSystem.makeDirectory(sfxDirectory, {
		recursive: true,
	});
	yield* fileSystem.writeFileString(
		path.join(input, "project.json"),
		JSON.stringify({
			serakki: SerakkiAppVersion,
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
			version: {
				major: 2,
				minor: 3,
			},
			...root,
		}),
	);
	yield* fileSystem.writeFileString(
		path.join(itemDirectory, "water.json"),
		JSON.stringify({
			$schema: "../schema.json",
			item: authoredItems.water,
		}),
	);
	yield* fileSystem.writeFileString(
		path.join(itemDirectory, "portal.json"),
		JSON.stringify({
			$schema: "../schema.json",
			item: authoredItems.portal,
		}),
	);
	yield* fileSystem.writeFile(path.join(image, "hero.png"), png);
	yield* fileSystem.writeFile(path.join(musicDirectory, "theme.ogg"), musicOgg);
	yield* fileSystem.writeFile(path.join(musicDirectory, "unused-theme.ogg"), musicOgg);
	yield* fileSystem.writeFile(path.join(sfxDirectory, "job-start.ogg"), sfxOgg);
	for (const [directory, id, name] of [
		[
			musicDirectory,
			"theme",
			"Editor-only Dusty Plains",
		],
		[
			musicDirectory,
			"unused-theme",
			"Editor-only Quiet Shore",
		],
		[
			sfxDirectory,
			"job-start",
			"Editor-only Workshop Bell",
		],
	] as const)
		yield* fileSystem.writeFileString(
			path.join(directory, `${id}.json`),
			JSON.stringify({
				name,
			}),
		);
	const squareArtworkPng = yield* Effect.promise(() =>
		sharp(assetPng)
			.resize(512, 512, {
				fit: "fill",
			})
			.png()
			.toBuffer(),
	);
	yield* fileSystem.writeFile(path.join(artwork, "item-water.png"), squareArtworkPng);

	return input;
});
