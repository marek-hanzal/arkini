import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import type { ActionEnumSchema } from "~/engine/merge/schema/ActionEnumSchema";
import type { EffectEnumSchema } from "~/engine/merge/schema/EffectEnumSchema";
import type { MergeSchema } from "~/engine/merge/schema/MergeSchema";
import { mergeItemsFx } from "~/engine/merge/write/mergeItemsFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import type { StateSchema } from "~/engine/state/schema/StateSchema";
import { createMergeTestConfig } from "~test/merge/support/createMergeTestConfig";
import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";

const makeState = ({
	sourceLocation = {
		scope: "board" as const,
		space: 0,
		position: {
			x: 0,
			y: 0,
		},
	},
	sourceQuantity = 2,
	targetLocation = {
		scope: "board" as const,
		space: 0,
		position: {
			x: 1,
			y: 0,
		},
	},
	targetQuantity = 1,
}: {
	sourceLocation?: StateSchema.Type["items"][number]["location"];
	sourceQuantity?: number;
	targetLocation?: StateSchema.Type["items"][number]["location"];
	targetQuantity?: number;
} = {}) =>
	({
		cheats: {
			enabled: false,
			everEnabled: false,
			instantGameplay: false,
		},
		currentSpace: 0,
		items: [
			{
				id: "runtime:source",
				itemId: "source",
				location: sourceLocation,
				quantity: sourceQuantity,
			},
			{
				id: "runtime:target",
				itemId: "target",
				location: targetLocation,
				quantity: targetQuantity,
			},
		],
		jobQueue: [],
		jobs: [],
	}) satisfies StateSchema.Type;

const runMergeFx = () =>
	Effect.gen(function* () {
		const before = yield* readRuntimeFx();
		const source = before.items.find((item) => item.id === "runtime:source");
		const target = before.items.find((item) => item.id === "runtime:target");
		if (source === undefined || target === undefined) {
			return yield* Effect.die(new Error("Expected merge participants."));
		}
		const event = yield* mergeItemsFx({
			sourceItemId: source.id,
			sourceRevision: source.revision,
			targetItemId: target.id,
			targetRevision: target.revision,
		});
		const after = yield* readRuntimeFx();
		return {
			after,
			before,
			event,
		};
	});

const combinations: ReadonlyArray<{
	action: ActionEnumSchema.Type;
	effect: EffectEnumSchema.Type;
}> = [
	{
		action: "use",
		effect: "keep",
	},
	{
		action: "use",
		effect: "remove",
	},
	{
		action: "use",
		effect: "replace",
	},
	{
		action: "consume",
		effect: "keep",
	},
	{
		action: "consume",
		effect: "remove",
	},
	{
		action: "consume",
		effect: "replace",
	},
];

describe("mergeItemsFx", () => {
	for (const { action, effect } of combinations) {
		it(`applies ${action} + ${effect} explicitly to one source and target quantity`, () => {
			const targetSelector = {
				type: "item" as const,
				itemId: "target",
			};
			const rule: MergeSchema.Type =
				effect === "replace"
					? {
							target: targetSelector,
							action,
							effect,
							result: "result",
						}
					: {
							target: targetSelector,
							action,
							effect,
						};
			const config = createMergeTestConfig({
				rule,
			});
			const result = Effect.runSync(
				runMergeFx().pipe(
					useGameFx({
						config,
						state: makeState(),
					}),
				),
			);

			const sourceQuantity = result.after.items
				.filter((item) => item.item.id === "source")
				.reduce((total, item) => total + item.quantity, 0);
			expect(sourceQuantity).toBe(action === "use" ? 2 : 1);

			const target = result.after.items.find((item) => item.id === "runtime:target");
			if (effect === "keep") expect(target?.item.id).toBe("target");
			if (effect === "remove") expect(target).toBeUndefined();
			if (effect === "replace") expect(target?.item.id).toBe("result");

			expect(result.event).toEqual({
				type: GameEventEnumSchema.enum.ItemMerged,
				sourceItemId: "runtime:source",
				sourceCanonicalItemId: "source",
				targetItemId: "runtime:target",
				targetCanonicalItemId: "target",
				action,
				effect,
				resultCanonicalItemId: effect === "replace" ? "result" : undefined,
			});
		});
	}

	it("isolates a stacked replacement target through standard placement", () => {
		const result = Effect.runSync(
			runMergeFx().pipe(
				useGameFx({
					config: createMergeTestConfig({
						rule: {
							target: {
								type: "item",
								itemId: "target",
							},
							action: "consume",
							effect: "replace",
							result: "result",
						},
					}),
					state: makeState({
						sourceQuantity: 2,
						targetQuantity: 2,
					}),
				}),
			),
		);

		expect(result.after.items.find((item) => item.id === "runtime:source")).toMatchObject({
			item: {
				id: "source",
			},
			location: result.before.items.find((item) => item.id === "runtime:source")?.location,
			quantity: 1,
		});
		expect(result.after.items.find((item) => item.id === "runtime:target")).toMatchObject({
			item: {
				id: "result",
			},
			location: result.before.items.find((item) => item.id === "runtime:target")?.location,
			quantity: 1,
		});

		const targetRemainder = result.after.items.find((item) => item.item.id === "target");
		expect(targetRemainder).toMatchObject({
			location: {
				scope: "board",
				space: 0,
			},
			quantity: 1,
		});
		expect(targetRemainder?.id).not.toBe("runtime:target");
		expect(targetRemainder?.location).not.toEqual(
			result.before.items.find((item) => item.id === "runtime:target")?.location,
		);
	});

	it("uses the first source-owned matching rule and never synthesizes the reverse direction", () => {
		const config = createMergeTestConfig({
			rule: [
				{
					target: {
						type: "item",
						itemId: "target",
					},
					action: "consume",
					effect: "keep",
				},
				{
					target: {
						type: "item",
						itemId: "target",
					},
					action: "consume",
					effect: "replace",
					result: "result",
				},
			],
		});
		const result = Effect.runSync(
			Effect.gen(function* () {
				const forward = yield* runMergeFx();
				const reverseBefore = yield* readRuntimeFx();
				const reverseSource = reverseBefore.items.find(
					(item) => item.id === "runtime:target",
				);
				const reverseTarget = reverseBefore.items.find(
					(item) => item.id === "runtime:source",
				);
				if (reverseSource === undefined || reverseTarget === undefined) {
					return yield* Effect.die(new Error("Expected reverse participants."));
				}
				const reverse = yield* Effect.result(
					mergeItemsFx({
						sourceItemId: reverseSource.id,
						sourceRevision: reverseSource.revision,
						targetItemId: reverseTarget.id,
						targetRevision: reverseTarget.revision,
					}),
				);
				return {
					forward,
					reverse,
				};
			}).pipe(
				useGameFx({
					config,
					state: makeState(),
				}),
			),
		);

		expect(result.forward.event.effect).toBe("keep");
		expect(
			result.forward.after.items.find((item) => item.id === "runtime:target")?.item.id,
		).toBe("target");
		expect(Result.isFailure(result.reverse)).toBe(true);
		if (Result.isFailure(result.reverse)) {
			expect(result.reverse.failure).toMatchObject({
				_tag: "MergeRuleNotFoundError",
				sourceItemId: "runtime:target",
				targetItemId: "runtime:source",
			});
		}
	});

	it("accepts an inventory source but requires the target to remain on the board", () => {
		const config = createMergeTestConfig({
			rule: {
				target: {
					type: "item",
					itemId: "target",
				},
				action: "consume",
				effect: "keep",
			},
		});
		const inventorySource = Effect.runSync(
			runMergeFx().pipe(
				useGameFx({
					config,
					state: makeState({
						sourceLocation: {
							scope: "inventory",
							position: {
								x: 0,
								y: 0,
							},
						},
					}),
				}),
			),
		);
		expect(inventorySource.event.type).toBe(GameEventEnumSchema.enum.ItemMerged);

		const inventoryTarget = Effect.runSync(
			Effect.gen(function* () {
				const runtime = yield* readRuntimeFx();
				const source = runtime.items.find((item) => item.id === "runtime:source");
				const target = runtime.items.find((item) => item.id === "runtime:target");
				if (source === undefined || target === undefined) {
					return yield* Effect.die(new Error("Expected participants."));
				}
				return yield* Effect.result(
					mergeItemsFx({
						sourceItemId: source.id,
						sourceRevision: source.revision,
						targetItemId: target.id,
						targetRevision: target.revision,
					}),
				);
			}).pipe(
				useGameFx({
					config,
					state: makeState({
						targetLocation: {
							scope: "inventory",
							position: {
								x: 0,
								y: 0,
							},
						},
					}),
				}),
			),
		);
		expect(Result.isFailure(inventoryTarget)).toBe(true);
		if (Result.isFailure(inventoryTarget)) {
			expect(inventoryTarget.failure).toMatchObject({
				_tag: "ItemNotOnBoardError",
				itemId: "runtime:target",
			});
		}
	});

	it("rejects same identity and stale source or target revisions without changing runtime", () => {
		const config = createMergeTestConfig({
			rule: {
				target: {
					type: "item",
					itemId: "target",
				},
				action: "consume",
				effect: "keep",
			},
		});
		const result = Effect.runSync(
			Effect.gen(function* () {
				const runtime = yield* readRuntimeFx();
				const source = runtime.items.find((item) => item.id === "runtime:source");
				const target = runtime.items.find((item) => item.id === "runtime:target");
				if (source === undefined || target === undefined) {
					return yield* Effect.die(new Error("Expected participants."));
				}
				const same = yield* Effect.result(
					mergeItemsFx({
						sourceItemId: source.id,
						sourceRevision: source.revision,
						targetItemId: source.id,
						targetRevision: source.revision,
					}),
				);
				const staleSource = yield* Effect.result(
					mergeItemsFx({
						sourceItemId: source.id,
						sourceRevision: "revision:stale",
						targetItemId: target.id,
						targetRevision: target.revision,
					}),
				);
				const staleTarget = yield* Effect.result(
					mergeItemsFx({
						sourceItemId: source.id,
						sourceRevision: source.revision,
						targetItemId: target.id,
						targetRevision: "revision:stale",
					}),
				);
				return {
					after: yield* readRuntimeFx(),
					before: runtime,
					same,
					staleSource,
					staleTarget,
				};
			}).pipe(
				useGameFx({
					config,
					state: makeState(),
				}),
			),
		);

		expect(Result.isFailure(result.same)).toBe(true);
		if (Result.isFailure(result.same))
			expect(result.same.failure._tag).toBe("MergeSameItemError");
		expect(Result.isFailure(result.staleSource)).toBe(true);
		if (Result.isFailure(result.staleSource))
			expect(result.staleSource.failure._tag).toBe("RevisionConflictError");
		expect(Result.isFailure(result.staleTarget)).toBe(true);
		if (Result.isFailure(result.staleTarget))
			expect(result.staleTarget.failure._tag).toBe("RevisionConflictError");
		expect(result.after).toEqual(result.before);
	});
});
