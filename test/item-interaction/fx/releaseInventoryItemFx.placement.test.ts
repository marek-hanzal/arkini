import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { releaseInventoryItemFx } from "~/item-interaction/fx/releaseInventoryItemFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { run } from "../support/dropItemFixture";

const inventory = {
	scope: "inventory" as const,
	position: {
		x: 0,
		y: 0,
	},
};
const board = (x: number, y: number) => ({
	scope: "board" as const,
	space: 0,
	position: {
		x,
		y,
	},
});

describe("releaseInventoryItemFx placement", () => {
	it("releases the exact whole stack without an opener into the first free cell, without stacking", () => {
		const result = run(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "blocked:0",
					itemId: "water",
					location: board(0, 0),
					quantity: 8,
				});
				yield* spawnItemFx({
					id: "blocked:1",
					itemId: "stone",
					location: board(1, 0),
					quantity: 1,
				});
				const source = yield* spawnItemFx({
					id: "source",
					itemId: "water",
					location: inventory,
					quantity: 4,
				});
				yield* releaseInventoryItemFx({
					itemId: source.id,
					revision: source.revision,
					location: inventory,
				});
				return yield* readRuntimeFx();
			}),
		);
		expect(result.items.find((item) => item.id === "source")).toMatchObject({
			quantity: 4,
			location: board(2, 0),
		});
		expect(result.items.find((item) => item.id === "blocked:0")?.quantity).toBe(8);
	});
	it("falls back to the first Toolbar cell when Board is full, even when Board stacks have capacity", () => {
		const result = run(
			Effect.gen(function* () {
				for (let y = 0; y < 2; y++)
					for (let x = 0; x < 3; x++) {
						yield* spawnItemFx({
							id: `block:${x}:${y}`,
							itemId: "water",
							location: board(x, y),
							quantity: 1,
						});
					}
				const source = yield* spawnItemFx({
					id: "source",
					itemId: "water",
					location: inventory,
					quantity: 4,
				});
				yield* releaseInventoryItemFx({
					itemId: source.id,
					revision: source.revision,
					location: inventory,
				});
				return yield* readRuntimeFx();
			}),
		);
		expect(result.items.find((item) => item.id === "source")).toMatchObject({
			quantity: 4,
			location: {
				scope: "toolbar",
				position: {
					x: 0,
					y: 0,
				},
			},
		});
	});
});
