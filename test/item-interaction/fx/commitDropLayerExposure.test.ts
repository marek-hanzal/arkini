import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { commitMoveDropFx } from "~/item-interaction/fx/commitMoveDropFx";
import { commitSwapDropFx } from "~/item-interaction/fx/commitSwapDropFx";
import { commitStackDropFx } from "~/item-interaction/fx/commitStackDropFx";
import { commitStoreInputDropFx } from "~/item-interaction/fx/commitStoreInputDropFx";
import { commitStoreInventoryDropFx } from "~/item-interaction/fx/commitStoreInventoryDropFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { inputRuntimeToolbarTestConfig } from "~test/production-input/support/inputRuntimeTestConfig";
import { emptyLocation, occupiedLocation, run, sourceLocation } from "../support/dropItemFixture";

const config = GameConfigSchema.parse({
	...inputRuntimeToolbarTestConfig,
	items: {
		...inputRuntimeToolbarTestConfig.items,
		water: {
			...inputRuntimeToolbarTestConfig.items.water,
			layer: "ground",
		},
		workshop: {
			...inputRuntimeToolbarTestConfig.items.workshop,
			layer: "ground",
		},
		inventory: {
			...inputRuntimeToolbarTestConfig.items.inventory,
			layer: "ground",
		},
	},
});

describe("drop commit exposure", () => {
	it.each([
		[
			"move",
			"source",
		],
		[
			"swap",
			"source",
		],
		[
			"swap",
			"target",
		],
		[
			"stack",
			"source",
		],
		[
			"stack",
			"target",
		],
		[
			"inventory",
			"source",
		],
		[
			"inventory",
			"target",
		],
		[
			"input",
			"source",
		],
		[
			"input",
			"target",
		],
	] as const)(
		"rejects %s when %s becomes covered without changing its revision",
		(command, covered) => {
			const result = run(
				Effect.gen(function* () {
					const source = yield* spawnItemFx({
						id: "source",
						itemId: "water",
						location: sourceLocation,
						quantity: 1,
					});
					const target = yield* spawnItemFx({
						id: "target",
						itemId:
							command === "inventory"
								? "inventory"
								: command === "input"
									? "workshop"
									: "water",
						location: occupiedLocation,
						quantity: 1,
					});
					// The planned actors stay unchanged while an independent content item covers one.
					yield* spawnItemFx({
						id: "cover",
						itemId: "stone",
						quantity: 1,
						location: covered === "source" ? sourceLocation : occupiedLocation,
					});
					const before = yield* readRuntimeFx();
					const props = {
						sourceItemId: source.id,
						sourceRevision: source.revision,
						sourceLocation,
						targetItemId: target.id,
						targetRevision: target.revision,
						targetLocation: occupiedLocation,
					};
					const outcome = yield* (() => {
						switch (command) {
							case "move":
								return commitMoveDropFx({
									...props,
									targetLocation: emptyLocation,
								});
							case "swap":
								return commitSwapDropFx(props);
							case "stack":
								return commitStackDropFx(props);
							case "inventory":
								return commitStoreInventoryDropFx({
									...props,
									inventoryItemId: target.id,
									inventoryRevision: target.revision,
									inventoryLocation: occupiedLocation,
								});
							case "input":
								return commitStoreInputDropFx({
									...props,
									lineId: "line:workshop:build",
									inputIndex: 0,
									quantity: 1,
								});
						}
					})();
					return {
						before,
						after: yield* readRuntimeFx(),
						outcome,
					};
				}),
				config,
			);
			expect(result.outcome).toMatchObject({
				kind: "reject",
				reason: covered === "source" ? "invalid-source" : "invalid-target",
			});
			expect(result.after).toEqual(result.before);
		},
	);

	it("rejects a cross-layer swap whose returning ground item would overwrite a third occupant", () => {
		const result = run(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "ground",
					itemId: "water",
					location: sourceLocation,
					quantity: 1,
				});
				const source = yield* spawnItemFx({
					id: "source",
					itemId: "stone",
					location: sourceLocation,
					quantity: 1,
				});
				const target = yield* spawnItemFx({
					id: "target",
					itemId: "water",
					location: occupiedLocation,
					quantity: 1,
				});
				const before = yield* readRuntimeFx();
				const outcome = yield* commitSwapDropFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation,
					targetItemId: target.id,
					targetRevision: target.revision,
					targetLocation: occupiedLocation,
				});
				return {
					before,
					after: yield* readRuntimeFx(),
					outcome,
				};
			}),
			config,
		);
		expect(result.outcome).toMatchObject({
			kind: "reject",
			reason: "occupied",
		});
		expect(result.after).toEqual(result.before);
	});
});
