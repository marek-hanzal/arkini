import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { dropItemFx } from "~/engine/runtime/write/dropItemFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { DropItemResultKind } from "~/engine/runtime/DropItemResult";

import { emptyLocation, occupiedLocation, run, sourceLocation } from "./dropItemFx.test/fixture";

describe("dropItemFx / move storage and swap", () => {
	it("moves one exact source to an empty slot and returns explicit identities", () => {
		const result = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:water",
					itemId: "water",
					location: sourceLocation,
					quantity: 1,
				});
				const outcome = yield* dropItemFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation,
					target: {
						kind: "slot",
						location: emptyLocation,
						occupant: null,
					},
				});
				const runtime = yield* readRuntimeFx();
				return {
					outcome,
					runtime,
				};
			}),
		);

		expect(result.outcome).toMatchObject({
			kind: DropItemResultKind.Move,
			itemId: "runtime:water",
			previousLocation: sourceLocation,
			location: emptyLocation,
		});
		expect(result.runtime.items[0]?.location).toEqual(emptyLocation);
	});
	it("stores the whole source stack through the Inventory opener atomically", () => {
		const result = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:water-source",
					itemId: "water",
					location: sourceLocation,
					quantity: 3,
				});
				yield* spawnItemFx({
					id: "runtime:water-stack",
					itemId: "water",
					location: {
						scope: "inventory",
						position: {
							x: 0,
							y: 0,
						},
					},
					quantity: 8,
				});
				const inventory = yield* spawnItemFx({
					id: "runtime:backpack",
					itemId: "backpack",
					location: occupiedLocation,
					quantity: 1,
				});
				const outcome = yield* dropItemFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation,
					target: {
						kind: "slot",
						location: occupiedLocation,
						occupant: {
							itemId: inventory.id,
							revision: inventory.revision,
						},
					},
				});
				return {
					outcome,
					runtime: yield* readRuntimeFx(),
				};
			}),
		);

		expect(result.outcome).toMatchObject({
			kind: DropItemResultKind.StoreInventory,
			source: {
				itemId: "runtime:water-source",
				previousQuantity: 3,
				current: null,
			},
			inventory: {
				itemId: "runtime:backpack",
				location: occupiedLocation,
			},
		});
		expect(
			result.runtime.items
				.filter((item) => item.item.id === "water" && item.location.scope === "inventory")
				.map((item) => item.quantity)
				.sort((left, right) => left - right),
		).toEqual([
			1,
			10,
		]);
		expect(result.runtime.items.some((item) => item.id === "runtime:water-source")).toBe(false);
	});
	it("swaps two non-mergeable occupied Board items and returns both actor identities", () => {
		const result = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:water",
					itemId: "water",
					location: sourceLocation,
					quantity: 1,
				});
				const target = yield* spawnItemFx({
					id: "runtime:stone",
					itemId: "stone",
					location: occupiedLocation,
					quantity: 1,
				});
				const outcome = yield* dropItemFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation,
					target: {
						kind: "slot",
						location: occupiedLocation,
						occupant: {
							itemId: target.id,
							revision: target.revision,
						},
					},
				});
				return {
					outcome,
					runtime: yield* readRuntimeFx(),
				};
			}),
		);

		expect(result.outcome).toMatchObject({
			kind: DropItemResultKind.Swap,
			source: {
				itemId: "runtime:water",
				previousLocation: sourceLocation,
				location: occupiedLocation,
			},
			target: {
				itemId: "runtime:stone",
				previousLocation: occupiedLocation,
				location: sourceLocation,
			},
		});
		expect(result.runtime.items.find((item) => item.id === "runtime:water")?.location).toEqual(
			occupiedLocation,
		);
		expect(result.runtime.items.find((item) => item.id === "runtime:stone")?.location).toEqual(
			sourceLocation,
		);
	});
});
