import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { spawnItemFx } from "~test/support/runtime/spawnItemFx";
import { dropItemFx } from "~/item-interaction/write/dropItemFx";
import { readRuntimeFx } from "~/game-runtime/read/readRuntimeFx";
import { DropItemResultKind } from "~/item-interaction/DropItemResult";
import {
	occupiedLocation,
	replaceMergeConfig,
	run,
	sourceLocation,
} from "./dropItemFx.test/fixture";

describe("dropItemFx / merge replacement and remainder", () => {
	it("keeps the target runtime identity explicit across replacement", () => {
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
				return yield* dropItemFx({
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
			replaceMergeConfig,
		);

		expect(result).toMatchObject({
			kind: DropItemResultKind.Merge,
			effect: "replace",
			resultCanonicalItemId: "mud",
			source: {
				current: null,
			},
			target: {
				itemId: "runtime:stone",
				current: {
					itemId: "runtime:stone",
					canonicalItemId: "mud",
					location: occupiedLocation,
				},
			},
		});
	});
	it("merges one quantity from both stacks and places the target remainder", () => {
		const result = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:water",
					itemId: "water",
					location: sourceLocation,
					quantity: 2,
				});
				const target = yield* spawnItemFx({
					id: "runtime:stone",
					itemId: "stone",
					location: occupiedLocation,
					quantity: 2,
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
			replaceMergeConfig,
		);

		expect(result.outcome).toMatchObject({
			kind: DropItemResultKind.Merge,
			effect: "replace",
			source: {
				itemId: "runtime:water",
				previousQuantity: 2,
				current: {
					itemId: "runtime:water",
					canonicalItemId: "water",
					location: sourceLocation,
					quantity: 1,
				},
			},
			target: {
				itemId: "runtime:stone",
				previousQuantity: 2,
				current: {
					itemId: "runtime:stone",
					canonicalItemId: "mud",
					location: occupiedLocation,
					quantity: 1,
				},
			},
		});
		const targetRemainder = result.runtime.items.find((item) => item.item.id === "stone");
		expect(targetRemainder).toMatchObject({
			location: {
				scope: "board",
				space: 0,
			},
			quantity: 1,
		});
		expect(targetRemainder?.id).not.toBe("runtime:stone");
	});
});
