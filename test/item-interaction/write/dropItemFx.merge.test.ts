import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { spawnItemFx } from "~test/support/runtime/spawnItemFx";
import { dropItemFx } from "~/item-interaction/write/dropItemFx";
import { readRuntimeFx } from "~/game-runtime/read/readRuntimeFx";
import { DropItemResultKind } from "~/item-interaction/DropItemResult";
import {
	mergeConfig,
	occupiedLocation,
	removeMergeConfig,
	run,
	sourceLocation,
} from "./dropItemFx.test/fixture";

describe("dropItemFx / merge identity", () => {
	it("commits a matching authored merge and returns exact surviving actor identities", () => {
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
					source,
					target,
				};
			}),
			mergeConfig,
		);

		expect(result.outcome).toMatchObject({
			kind: DropItemResultKind.Merge,
			action: "consume",
			effect: "keep",
			source: {
				itemId: "runtime:water",
				previousRevision: result.source.revision,
				previousLocation: sourceLocation,
				previousQuantity: 1,
				current: null,
			},
			target: {
				itemId: "runtime:stone",
				previousRevision: result.target.revision,
				previousLocation: occupiedLocation,
				previousQuantity: 1,
				current: {
					itemId: "runtime:stone",
					canonicalItemId: "stone",
					location: occupiedLocation,
					quantity: 1,
				},
			},
		});
		expect(result.runtime.items).toHaveLength(1);
		expect(result.runtime.items[0]?.id).toBe("runtime:stone");
	});
	it("returns the surviving source stack identity after consuming one merge quantity", () => {
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
			mergeConfig,
		);

		expect(result).toMatchObject({
			kind: DropItemResultKind.Merge,
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
		});
	});
	it("reports both actor identities as removed when merge consumes and removes them", () => {
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
			removeMergeConfig,
		);

		expect(result.outcome).toMatchObject({
			kind: DropItemResultKind.Merge,
			effect: "remove",
			source: {
				itemId: "runtime:water",
				current: null,
			},
			target: {
				itemId: "runtime:stone",
				current: null,
			},
		});
		expect(result.runtime.items).toEqual([]);
	});
});
