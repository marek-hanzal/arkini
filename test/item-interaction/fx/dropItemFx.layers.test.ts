import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { spawnItemFx } from "~test/support/spawnItemFx";
import {
	config,
	emptyLocation,
	occupiedLocation,
	replaceMergeConfig,
	run,
	sourceLocation,
} from "../support/dropItemFixture";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { dropItemFx } from "~/item-interaction/fx/dropItemFx";
import { readDropItemPreviewFx } from "~/item-interaction/fx/readDropItemPreviewFx";
import type { DropItemCommand } from "~/item-interaction/type/DropItemCommand";
import type { GridRuntimeItemSchema } from "~/game-runtime/schema/GridRuntimeItemSchema";

const command = (
	source: GridRuntimeItemSchema.Type,
	target: GridRuntimeItemSchema.Type,
): DropItemCommand => ({
	sourceItemId: source.id,
	sourceRevision: source.revision,
	sourceLocation: source.location,
	target: {
		kind: "slot",
		location: target.location,
		occupant: {
			itemId: target.id,
			revision: target.revision,
		},
	},
});

const groundConfig = GameConfigSchema.parse({
	...config,
	items: {
		...config.items,
		stone: {
			...config.items.stone,
			layer: "ground",
		},
		cover: {
			...config.items.stone,
			uid: "cover",
			id: "cover",
		},
		water: {
			...config.items.water,
			merge: [
				{
					target: {
						type: "item",
						itemId: "stone",
					},
					action: "consume",
					effect: "remove",
				},
			],
		},
	},
});

describe("Board layer drop semantics", () => {
	it("places content over ground, prevents covered targeting, and exposes the same ground identity for destruction", () => {
		run(
			Effect.gen(function* () {
				const ground = yield* spawnItemFx({
					id: "ground",
					itemId: "stone",
					location: occupiedLocation,
					quantity: 1,
				});
				const cover = yield* spawnItemFx({
					id: "cover",
					itemId: "cover",
					location: sourceLocation,
					quantity: 1,
				});
				const tool = yield* spawnItemFx({
					id: "tool",
					itemId: "water",
					location: emptyLocation,
					quantity: 1,
				});
				const coverCommand = command(cover, ground);
				expect(yield* readDropItemPreviewFx(coverCommand)).toEqual({
					kind: "move",
				});
				const placed = yield* dropItemFx(coverCommand);
				expect(placed.kind).toBe("move");
				expect(
					(yield* readRuntimeFx()).items.filter(
						(item) => item.location.scope === "board" && item.location.position.x === 1,
					),
				).toHaveLength(2);
				expect(yield* dropItemFx(command(tool, ground))).toMatchObject({
					kind: "reject",
					reason: "stale-target",
				});
				if (placed.kind !== "move") throw new Error("Expected cover movement");
				yield* dropItemFx({
					sourceItemId: cover.id,
					sourceRevision: placed.revision,
					sourceLocation: occupiedLocation,
					target: {
						kind: "slot",
						location: sourceLocation,
						occupant: null,
					},
				});
				expect(yield* readDropItemPreviewFx(command(tool, ground))).toEqual({
					kind: "merge",
				});
				expect(yield* dropItemFx(command(tool, ground))).toMatchObject({
					kind: "merge",
					effect: "remove",
				});
				expect((yield* readRuntimeFx()).items.map((item) => item.id)).toEqual([
					"cover",
				]);
			}),
			groundConfig,
		);
	});

	it("moves ground under content without swapping either item into a different layer", () => {
		run(
			Effect.gen(function* () {
				const ground = yield* spawnItemFx({
					id: "ground",
					itemId: "stone",
					location: sourceLocation,
					quantity: 1,
				});
				const cover = yield* spawnItemFx({
					id: "cover",
					itemId: "cover",
					location: occupiedLocation,
					quantity: 1,
				});
				expect(yield* readDropItemPreviewFx(command(ground, cover))).toEqual({
					kind: "move",
				});
				expect(yield* dropItemFx(command(ground, cover))).toMatchObject({
					kind: "move",
				});
				expect(
					(yield* readRuntimeFx()).items.every(
						(item) => item.location.scope === "board" && item.location.position.x === 1,
					),
				).toBe(true);
			}),
			groundConfig,
		);
	});

	it.each([
		false,
		true,
	])(
		"merge replacement uses its authored layer and rolls back a collision (occupied=%s)",
		(occupied) => {
			const replacementConfig = GameConfigSchema.parse({
				...replaceMergeConfig,
				items: {
					...replaceMergeConfig.items,
					mud: {
						...replaceMergeConfig.items.mud,
						layer: "ground",
					},
					ground: {
						...config.items.stone,
						id: "ground",
						uid: "ground",
						layer: "ground",
					},
				},
			});
			run(
				Effect.gen(function* () {
					const source = yield* spawnItemFx({
						id: "tool",
						itemId: "water",
						location: sourceLocation,
						quantity: 1,
					});
					const target = yield* spawnItemFx({
						id: "target",
						itemId: "stone",
						location: occupiedLocation,
						quantity: 1,
					});
					if (occupied)
						yield* spawnItemFx({
							id: "ground",
							itemId: "ground",
							location: occupiedLocation,
							quantity: 1,
						});
					const before = yield* readRuntimeFx();
					const result = yield* dropItemFx(command(source, target));
					const after = yield* readRuntimeFx();
					if (occupied) {
						expect(result).toMatchObject({
							kind: "reject",
							reason: "blocked",
						});
						expect(after).toBe(before);
					} else {
						expect(result.kind).toBe("merge");
						expect(after.items).toHaveLength(1);
						expect(after.items[0]).toMatchObject({
							id: target.id,
							item: {
								id: "mud",
								layer: "ground",
							},
							location: occupiedLocation,
						});
					}
				}),
				replacementConfig,
			);
		},
	);
});
