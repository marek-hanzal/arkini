import { gzipSync } from "node:zlib";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createGameFx } from "~/bridge/game/createGameFx";
import { encodeFx } from "~/engine/pack/fx/encodeFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

const config = GameConfigSchema.parse({
	version: "1.0",
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:bridge",
		title: "Bridge game",
		board: {
			width: 2,
			height: 2,
		},
		inventory: {
			width: 1,
			height: 1,
		},
	},
	start: {
		currentSpace: 0,
		board: [
			{
				itemId: "water",
				space: 0,
				x: 1,
				y: 0,
			},
		],
	},
	categories: {},
	items: {
		water: {
			id: "water",
			type: "simple",
			title: "Water",
			description: "Water",
			asset: {
				source: [
					"asset:water",
				],
			},
			tags: [],
			categoryId: "resource",
			scope: "any",
			maxStackSize: 10,
		},
	},
});

const createPackUrl = async () => {
	const bytes = Effect.runSync(
		encodeFx({
			config,
			resources: [
				{
					id: "hero",
					mime: "image/png",
					bytes: new Uint8Array([
						1,
					]),
				},
				{
					id: "asset:water",
					mime: "image/png",
					bytes: new Uint8Array([
						2,
					]),
				},
			],
		}),
	);
	const compressed = gzipSync(bytes);
	return `data:application/octet-stream;base64,${compressed.toString("base64")}`;
};

describe("createGameFx", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});
	it("loads one pack, starts one live game and exposes embedded resources", async () => {
		const game = await Effect.runPromise(
			createGameFx({
				packUrl: await createPackUrl(),
			}),
		);

		try {
			expect(game.config).toEqual(config);
			expect(game.getSnapshot().items).toEqual([
				expect.objectContaining({
					item: config.items.water,
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 1,
							y: 0,
						},
					},
				}),
			]);
			expect(game.getResourceUrl("asset:water")).toMatch(/^blob:/);
		} finally {
			await game.dispose();
		}
	});
	it("disposes a partial game bootstrap and revokes created resources when resource setup fails", async () => {
		const createObjectUrl = vi
			.spyOn(URL, "createObjectURL")
			.mockReturnValueOnce("blob:created")
			.mockImplementationOnce(() => {
				throw new Error("resource setup failed");
			});
		const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL");

		await expect(
			Effect.runPromise(
				createGameFx({
					packUrl: await createPackUrl(),
				}),
			),
		).rejects.toThrow("resource setup failed");

		expect(createObjectUrl).toHaveBeenCalledTimes(2);
		expect(revokeObjectUrl).toHaveBeenCalledWith("blob:created");
	});
});
