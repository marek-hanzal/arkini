import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { setDefaultLineFx } from "~/engine/line/write/setDefaultLineFx";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { readCommittedTransitionFx } from "~/engine/runtime/read/readCommittedTransitionFx";
import { readDropItemPreviewFx } from "~/engine/runtime/read/readDropItemPreviewFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { DropItemRejectedReasonEnumSchema } from "~/engine/runtime/schema/command/DropItemRejectedReasonEnumSchema";
import { DropItemResultKindEnumSchema } from "~/engine/runtime/schema/command/DropItemResultKindEnumSchema";
import { DropItemResultSchema } from "~/engine/runtime/schema/command/DropItemResultSchema";
import { dropItemFx } from "~/engine/runtime/write/dropItemFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { purityTestConfig } from "~test/line/support/purityTestConfig";

const board = (x: number) => ({
	scope: "board" as const,
	space: 0,
	position: {
		x,
		y: 0,
	},
});

const mergeBeforeStackConfig = GameConfigSchema.parse({
	...purityTestConfig,
	meta: {
		...purityTestConfig.meta,
		id: "game:drop-stack-merge-precedence",
	},
	items: {
		...purityTestConfig.items,
		material: {
			...purityTestConfig.items.material,
			merge: [
				{
					target: {
						type: "item",
						itemId: "material",
					},
					action: "consume",
					effect: "keep",
				},
			],
		},
	},
});

const producerItem = purityTestConfig.items.producer;
if (producerItem.type !== "producer") {
	throw new Error("Expected the purity producer fixture.");
}

const inputBeforeStackConfig = GameConfigSchema.parse({
	...purityTestConfig,
	meta: {
		...purityTestConfig.meta,
		id: "game:drop-stack-input-precedence",
	},
	items: {
		...purityTestConfig.items,
		producer: {
			...producerItem,
			lines: [
				{
					...producerItem.lines[0],
					input: [
						{
							type: "materials",
							selector: {
								type: "item",
								itemId: "producer",
							},
							quantity: {
								type: "value",
								value: 1,
							},
							capacity: 2,
						},
					],
				},
			],
		},
	},
});

const run = <A, E, R>(
	effect: Effect.Effect<A, E, R>,
	config: GameConfigSchema.Type = purityTestConfig,
) =>
	Effect.runSync(
		effect.pipe(
			useGameFx({
				config,
			}),
		) as Effect.Effect<A, E, never>,
	);

const occupiedTarget = ({
	itemId,
	revision,
	location,
}: {
	readonly itemId: string;
	readonly revision: string;
	readonly location: GridLocationSchema.Type;
}) => ({
	kind: "slot" as const,
	location,
	occupant: {
		itemId,
		revision,
	},
});

describe("dropItemFx pure stack integration", () => {
	it("previews and commits a partial stack with exact public actor facts and no semantic event", () => {
		const result = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:source",
					itemId: "material",
					location: board(0),
					quantity: 5,
				});
				const target = yield* spawnItemFx({
					id: "runtime:target",
					itemId: "material",
					location: board(1),
					quantity: 8,
				});
				const targetDrop = occupiedTarget({
					itemId: target.id,
					revision: target.revision,
					location: target.location,
				});
				const preview = yield* readDropItemPreviewFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation: source.location,
					target: targetDrop,
				});
				const outcome = yield* dropItemFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation: source.location,
					target: targetDrop,
				});

				return {
					outcome,
					preview,
					runtime: yield* readRuntimeFx(),
					transition: yield* readCommittedTransitionFx(),
				};
			}),
		);

		expect(result.preview).toEqual({
			kind: DropItemResultKindEnumSchema.enum.Stack,
		});
		expect(result.outcome).toMatchObject({
			kind: DropItemResultKindEnumSchema.enum.Stack,
			transferredQuantity: 2,
			source: {
				itemId: "runtime:source",
				canonicalItemId: "material",
				previousLocation: board(0),
				previousQuantity: 5,
				current: {
					itemId: "runtime:source",
					canonicalItemId: "material",
					location: board(0),
					quantity: 3,
				},
			},
			target: {
				itemId: "runtime:target",
				canonicalItemId: "material",
				previousLocation: board(1),
				previousQuantity: 8,
				current: {
					itemId: "runtime:target",
					canonicalItemId: "material",
					location: board(1),
					quantity: 10,
				},
			},
		});
		expect(DropItemResultSchema.parse(result.outcome)).toEqual(result.outcome);
		expect(result.runtime.items.reduce((total, item) => total + item.quantity, 0)).toBe(13);
		expect(result.transition.events).toEqual([]);
	});

	it("returns a null public source after a full transfer and keeps the target identity", () => {
		const result = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:source",
					itemId: "material",
					location: board(0),
					quantity: 2,
				});
				const target = yield* spawnItemFx({
					id: "runtime:target",
					itemId: "material",
					location: board(1),
					quantity: 5,
				});
				const outcome = yield* dropItemFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation: source.location,
					target: occupiedTarget({
						itemId: target.id,
						revision: target.revision,
						location: target.location,
					}),
				});

				return {
					outcome,
					runtime: yield* readRuntimeFx(),
				};
			}),
		);

		expect(result.outcome).toMatchObject({
			kind: DropItemResultKindEnumSchema.enum.Stack,
			transferredQuantity: 2,
			source: {
				itemId: "runtime:source",
				previousQuantity: 2,
				current: null,
			},
			target: {
				itemId: "runtime:target",
				previousQuantity: 5,
				current: {
					itemId: "runtime:target",
					quantity: 7,
				},
			},
		});
		expect(result.runtime.items).toHaveLength(1);
		expect(result.runtime.items[0]).toMatchObject({
			id: "runtime:target",
			quantity: 7,
		});
	});

	it("rejects a full identical target as occupied without falling through to swap", () => {
		const result = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:source",
					itemId: "material",
					location: board(0),
					quantity: 2,
				});
				const target = yield* spawnItemFx({
					id: "runtime:target",
					itemId: "material",
					location: board(1),
					quantity: 10,
				});
				const targetDrop = occupiedTarget({
					itemId: target.id,
					revision: target.revision,
					location: target.location,
				});
				const preview = yield* readDropItemPreviewFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation: source.location,
					target: targetDrop,
				});
				const outcome = yield* dropItemFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation: source.location,
					target: targetDrop,
				});

				return {
					outcome,
					preview,
					runtime: yield* readRuntimeFx(),
					source,
					target,
				};
			}),
		);

		expect(result.preview).toEqual({
			kind: DropItemResultKindEnumSchema.enum.Reject,
			reason: DropItemRejectedReasonEnumSchema.enum.Occupied,
		});
		expect(result.outcome).toEqual({
			kind: DropItemResultKindEnumSchema.enum.Reject,
			reason: DropItemRejectedReasonEnumSchema.enum.Occupied,
			itemId: "runtime:source",
			targetItemId: "runtime:target",
		});
		expect(result.runtime.items).toEqual([
			result.source,
			result.target,
		]);
	});

	it("rejects an identical stateful target instead of swapping it", () => {
		const result = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:source",
					itemId: "producer",
					location: board(0),
					quantity: 1,
				});
				const target = yield* spawnItemFx({
					id: "runtime:target",
					itemId: "producer",
					location: board(1),
					quantity: 1,
				});
				yield* setDefaultLineFx({
					ownerItemId: target.id,
					lineId: "line:producer:zero",
				});
				const preview = yield* readDropItemPreviewFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation: source.location,
					target: occupiedTarget({
						itemId: target.id,
						revision: target.revision,
						location: target.location,
					}),
				});

				return {
					preview,
					runtime: yield* readRuntimeFx(),
				};
			}),
		);

		expect(result.preview).toEqual({
			kind: DropItemResultKindEnumSchema.enum.Reject,
			reason: DropItemRejectedReasonEnumSchema.enum.InvalidTarget,
		});
		expect(result.runtime.items.map((item) => item.location)).toEqual([
			board(0),
			board(1),
		]);
	});

	it("preserves authored Merge and StoreInput precedence over identical stacking", () => {
		const mergePreview = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:source",
					itemId: "material",
					location: board(0),
					quantity: 2,
				});
				const target = yield* spawnItemFx({
					id: "runtime:target",
					itemId: "material",
					location: board(1),
					quantity: 2,
				});
				return yield* readDropItemPreviewFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation: source.location,
					target: occupiedTarget({
						itemId: target.id,
						revision: target.revision,
						location: target.location,
					}),
				});
			}),
			mergeBeforeStackConfig,
		);
		const inputPreview = run(
			Effect.gen(function* () {
				const source = yield* spawnItemFx({
					id: "runtime:source",
					itemId: "producer",
					location: board(0),
					quantity: 1,
				});
				const target = yield* spawnItemFx({
					id: "runtime:target",
					itemId: "producer",
					location: board(1),
					quantity: 1,
				});
				yield* setDefaultLineFx({
					ownerItemId: target.id,
					lineId: "line:producer:zero",
				});
				return yield* readDropItemPreviewFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation: source.location,
					target: occupiedTarget({
						itemId: target.id,
						revision: target.revision,
						location: target.location,
					}),
				});
			}),
			inputBeforeStackConfig,
		);

		expect(mergePreview).toEqual({
			kind: DropItemResultKindEnumSchema.enum.Merge,
		});
		expect(inputPreview).toMatchObject({
			kind: DropItemResultKindEnumSchema.enum.StoreInput,
			lineId: "line:producer:zero",
			inputIndex: 0,
			quantity: 1,
		});
	});
});
