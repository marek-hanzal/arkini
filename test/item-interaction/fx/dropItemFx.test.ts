import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { readDropItemPreviewFx } from "~/item-interaction/fx/readDropItemPreviewFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { DropItemResultKind } from "~/item-interaction/type/DropItemResult";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { DropItemRejectedReason } from "~/item-interaction/type/DropItemResult";
import { dropItemFx } from "~/item-interaction/fx/dropItemFx";

import {
	config,
	emptyLocation,
	inventoryMergeResultScopeConfig,
	mergeConfig,
	occupiedLocation,
	run,
	sourceLocation,
} from "../support/dropItemFixture";

describe("readDropItemPreviewFx / preview", () => {
	it("reports move for one live source over an empty slot without mutating runtime", () => {
		const result = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:water",
					itemId: "water",
					location: sourceLocation,
					quantity: 1,
				});
				const preview = yield* readDropItemPreviewFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation,
					target: {
						kind: "slot",
						location: emptyLocation,
						occupant: null,
					},
				});
				return {
					preview,
					runtime: yield* readRuntimeFx(),
				};
			}),
		);

		expect(result.preview).toEqual({
			kind: DropItemResultKind.Move,
		});
		expect(result.runtime.items[0]?.location).toEqual(sourceLocation);
	});
	it("distinguishes non-combinable swap from authored merge", () => {
		const preview = (gameConfig: GameConfigSchema.Type) =>
			run(
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
					return yield* readDropItemPreviewFx({
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
				}),
				gameConfig,
			);

		expect(preview(config)).toEqual({
			kind: DropItemResultKind.Swap,
		});
		expect(preview(mergeConfig)).toEqual({
			kind: DropItemResultKind.Merge,
		});
	});
	it("rejects a stale source before advertising an empty-slot move", () => {
		const preview = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:water",
					itemId: "water",
					location: sourceLocation,
					quantity: 1,
				});
				return yield* readDropItemPreviewFx({
					sourceItemId: source.id,
					sourceRevision: "revision:stale",
					sourceLocation,
					target: {
						kind: "slot",
						location: emptyLocation,
						occupant: null,
					},
				});
			}),
		);

		expect(preview).toEqual({
			kind: DropItemResultKind.Reject,
			reason: DropItemRejectedReason.StaleSource,
		});
	});
	it("previews Inventory storage when the occupied target has an Inventory action", () => {
		const result = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:water",
					itemId: "water",
					location: sourceLocation,
					quantity: 3,
				});
				const inventory = yield* spawnItemFx({
					id: "runtime:backpack",
					itemId: "backpack",
					location: occupiedLocation,
					quantity: 1,
				});
				return yield* readDropItemPreviewFx({
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
			}),
		);

		expect(result).toEqual({
			kind: DropItemResultKind.StoreInventory,
		});
	});
	it("keeps ordinary Inventory slot semantics around a stored Inventory action item", () => {
		const result = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:water",
					itemId: "water",
					location: {
						scope: "inventory",
						position: {
							x: 0,
							y: 0,
						},
					},
					quantity: 1,
				});
				const inventory = yield* spawnItemFx({
					id: "runtime:backpack",
					itemId: "backpack",
					location: {
						scope: "inventory",
						position: {
							x: 1,
							y: 0,
						},
					},
					quantity: 1,
				});
				return yield* readDropItemPreviewFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation: source.location,
					target: {
						kind: "slot",
						location: inventory.location,
						occupant: {
							itemId: inventory.id,
							revision: inventory.revision,
						},
					},
				});
			}),
		);

		expect(result).toEqual({
			kind: DropItemResultKind.Swap,
		});
	});
	it("places a replacement through its authored storage scope", () => {
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
			inventoryMergeResultScopeConfig,
		);

		expect(result.outcome).toMatchObject({
			kind: DropItemResultKind.Merge,
			effect: "replace",
			resultCanonicalItemId: "mud",
			target: {
				itemId: "runtime:stone",
				current: {
					itemId: "runtime:stone",
					canonicalItemId: "mud",
					location: {
						scope: "inventory",
						position: {
							x: 0,
							y: 0,
						},
					},
				},
			},
		});
		expect(result.runtime.items.some((item) => item.id === "runtime:water")).toBe(false);
	});
});
