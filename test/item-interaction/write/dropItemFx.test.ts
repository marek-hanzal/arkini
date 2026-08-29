import { describe, expect, it } from "vitest";
import { Effect, Result } from "effect";
import { spawnItemFx } from "~test/support/runtime/spawnItemFx";
import { readDropItemPreviewFx } from "~/item-interaction/read/readDropItemPreviewFx";
import { readRuntimeFx } from "~/game-runtime/read/readRuntimeFx";
import { DropItemResultKind } from "~/item-interaction/DropItemResult";
import { GameConfigSchema } from "~/game-config/GameConfigSchema";
import { DropItemRejectedReason } from "~/item-interaction/DropItemResult";
import { dropItemFx } from "~/item-interaction/write/dropItemFx";

import {
	config,
	emptyLocation,
	invalidMergeResultScopeConfig,
	mergeConfig,
	occupiedLocation,
	run,
	sourceLocation,
} from "./dropItemFx.test/fixture";

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
	it("advertises whole-item storage instead of swapping with the Inventory opener", () => {
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
	it("surfaces authored merge invariant failures instead of reporting a product rejection", () => {
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
				return yield* Effect.result(
					dropItemFx({
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
					}),
				);
			}),
			invalidMergeResultScopeConfig,
		);

		expect(Result.isFailure(result)).toBe(true);
		if (Result.isFailure(result)) {
			expect(result.failure).toMatchObject({
				_tag: "RuntimeInvalidError",
			});
		}
	});
});
