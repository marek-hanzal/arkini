import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/useGameFx";
import type { SourceActionSchema } from "~/item-merge/schema/SourceActionSchema";
import type { TargetEffectSchema } from "~/item-merge/schema/TargetEffectSchema";
import type { MergeSchema } from "~/item-merge/schema/MergeSchema";
import { mergeItemsFx } from "~/item-merge/fx/mergeItemsFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import type { StateSchema } from "~/game-persistence/schema/StateSchema";
import {
	createMergeTestConfig,
	guaranteedMergeOutput,
} from "~test/item-merge/support/createMergeTestConfig";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import { CommittedTransitionsFx } from "~/game-runtime/context/CommittedTransitionsFx";

const makeState = ({
	sourceLocation = {
		scope: "board" as const,
		space: 0,
		position: {
			x: 0,
			y: 0,
		},
	},
	targetLocation = {
		scope: "board" as const,
		space: 0,
		position: {
			x: 1,
			y: 0,
		},
	},
}: {
	sourceLocation?: StateSchema.Type["items"][number]["location"];
	targetLocation?: StateSchema.Type["items"][number]["location"];
} = {}) =>
	({
		cheats: {
			enabled: false,
			everEnabled: false,
			speedUpGameplay: false,
		},
		currentSpace: 0,
		templateUidBySpace: {},
		items: [
			{
				id: "runtime:source",
				itemUid: "source",
				location: sourceLocation,
			},
			{
				id: "runtime:target",
				itemUid: "target",
				location: targetLocation,
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
		const { event } = yield* mergeItemsFx({
			sourceItemId: source.id,
			sourceRevision: source.revision,
			targetItemId: target.id,
			targetRevision: target.revision,
		});
		const after = yield* readRuntimeFx();
		const transition = yield* (yield* CommittedTransitionsFx).read;
		return {
			after,
			before,
			event,
			transition,
		};
	});

const spendRule = {
	target: {
		type: "item",
		itemUid: "target",
	},
	action: "spend",
	effect: "keep",
} satisfies MergeSchema.Type;

const targetSpendRule = {
	target: {
		type: "item",
		itemUid: "target",
	},
	action: "consume",
	effect: "spend",
} satisfies MergeSchema.Type;

const combinations: ReadonlyArray<{
	action: Exclude<SourceActionSchema.Type, "space">;
	effect: TargetEffectSchema.Type;
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
		it(`applies ${action} + ${effect} explicitly to one source and target identity`, () => {
			const targetSelector = {
				type: "item" as const,
				itemUid: "target",
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
						state: makeState({
							targetLocation: {
								scope: "board",
								space: 0,
								position: {
									x: 3,
									y: 1,
								},
							},
						}),
					}),
				),
			);

			const sourceQuantity = result.after.items.filter(
				(item) => item.item.uid === "source",
			).length;
			expect(sourceQuantity).toBe(action === "use" ? 1 : 0);
			if (action === "use") {
				const sourceBefore = result.before.items.find(
					(item) => item.id === "runtime:source",
				);
				const sourceAfter = result.after.items.find((item) => item.id === "runtime:source");
				expect(sourceAfter?.location).toEqual({
					scope: "board",
					space: 0,
					position:
						effect === "remove"
							? {
									x: 3,
									y: 1,
								}
							: {
									x: 3,
									y: 0,
								},
				});
				expect(result.transition.events).toContainEqual({
					type: GameEventEnumSchema.enum.ItemPlaced,
					itemId: "runtime:source",
					itemUid: "source",
					originItemId: "runtime:target",
					previousLocation: sourceBefore?.location,
					location: sourceAfter?.location,
				});
				expect(sourceAfter?.revision).not.toBe(sourceBefore?.revision);
			}

			const target = result.after.items.find((item) => item.id === "runtime:target");
			if (effect === "keep") expect(target?.item.uid).toBe("target");
			if (effect === "remove") expect(target).toBeUndefined();
			if (effect === "replace") expect(target?.item.uid).toBe("result");

			expect(result.event).toEqual({
				type: GameEventEnumSchema.enum.ItemMerged,
				sourceItemId: "runtime:source",
				sourceItemUid: "source",
				targetItemId: "runtime:target",
				targetItemUid: "target",
				action,
				effect,
				resultItemUid: effect === "replace" ? "result" : undefined,
			});
			expect(
				result.transition.events
					.filter((event) => event.type !== GameEventEnumSchema.enum.ItemPlaced)
					.map((event) => event.type),
			).toEqual(
				effect === "remove"
					? [
							GameEventEnumSchema.enum.ItemMerged,
							...(action === "consume"
								? [
										GameEventEnumSchema.enum.ItemRemoved,
									]
								: []),
							GameEventEnumSchema.enum.ItemRemoved,
							GameEventEnumSchema.enum.ItemDisappeared,
						]
					: [
							GameEventEnumSchema.enum.ItemMerged,
							...(action === "consume"
								? [
										GameEventEnumSchema.enum.ItemRemoved,
									]
								: []),
						],
			);
		});
	}

	it("reuses the tool's own cell when a use drop has no closer free cell on a full board", () => {
		const result = Effect.runSync(
			runMergeFx().pipe(
				useGameFx({
					config: createMergeTestConfig({
						board: {
							width: 2,
							height: 1,
						},
						rule: {
							action: "use",
							effect: "keep",
							target: {
								type: "item",
								itemUid: "target",
							},
						},
					}),
					state: makeState(),
				}),
			),
		);
		const sourceBefore = result.before.items.find((item) => item.id === "runtime:source");
		const sourceAfter = result.after.items.find((item) => item.id === "runtime:source");
		expect(sourceAfter?.location).toEqual(sourceBefore?.location);
		expect(result.after.items).toHaveLength(2);
		expect(result.transition.events).toContainEqual(
			expect.objectContaining({
				type: GameEventEnumSchema.enum.ItemPlaced,
				itemId: "runtime:source",
				originItemId: "runtime:target",
				location: sourceBefore?.location,
			}),
		);
	});

	it("treats placed merge output as the removed target's replacement", () => {
		const result = Effect.runSync(
			runMergeFx().pipe(
				useGameFx({
					config: createMergeTestConfig({
						rule: {
							target: {
								type: "item",
								itemUid: "target",
							},
							action: "consume",
							effect: "remove",
							outcome: guaranteedMergeOutput(),
						},
					}),
					state: makeState(),
				}),
			),
		);

		expect(
			result.transition.events.some(
				(event) => event.type === GameEventEnumSchema.enum.ItemDisappeared,
			),
		).toBe(false);
		expect(
			result.transition.events.some(
				(event) => event.type === GameEventEnumSchema.enum.ItemSpawned,
			),
		).toBe(true);
	});

	it("spends one real source unit for a Spend merge", () => {
		const result = Effect.runSync(
			runMergeFx().pipe(
				useGameFx({
					config: createMergeTestConfig({
						rule: spendRule,
						sourceUnits: {
							amount: 2,
						},
					}),
					state: makeState({}),
				}),
			),
		);

		expect(result.after.items.find((item) => item.id === "runtime:source")).toMatchObject({
			remainingUnits: 1,
		});
		expect(result.after.items.find((item) => item.id === "runtime:target")).toMatchObject({
			item: {
				uid: "target",
			},
		});
	});

	it("rejects a Spend merge when the source has no units without changing runtime", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const before = yield* readRuntimeFx();
				const attempt = yield* Effect.result(runMergeFx());
				return {
					after: yield* readRuntimeFx(),
					attempt,
					before,
				};
			}).pipe(
				useGameFx({
					config: createMergeTestConfig({
						rule: spendRule,
					}),
					state: makeState({}),
				}),
			),
		);

		expect(Result.isFailure(result.attempt)).toBe(true);
		if (Result.isFailure(result.attempt)) {
			expect(result.attempt.failure).toMatchObject({
				_tag: "ItemUnitsUnavailableError",
				itemId: "runtime:source",
				remainingUnits: 0,
			});
		}
		expect(result.after).toEqual(result.before);
	});

	it("queues the source termination line after its last spent unit", () => {
		const result = Effect.runSync(
			runMergeFx().pipe(
				useGameFx({
					config: createMergeTestConfig({
						rule: spendRule,
						sourceUnits: {
							amount: 1,
						},
						sourceTerminationOutcome: guaranteedMergeOutput(),
					}),
					state: makeState(),
				}),
			),
		);
		expect(
			result.after.items.find((item) => item.id === "runtime:source")?.remainingUnits,
		).toBe(0);
		expect(result.after.jobQueue).toMatchObject([
			{
				ownerItemId: "runtime:source",
				lineUid: "termination:source",
			},
		]);
		expect(result.transition.events).toContainEqual(
			expect.objectContaining({
				type: "job:queued",
				ownerItemId: "runtime:source",
			}),
		);
	});

	it("spends one real unit from a Spend merge target", () => {
		const result = Effect.runSync(
			runMergeFx().pipe(
				useGameFx({
					config: createMergeTestConfig({
						rule: targetSpendRule,
						targetUnits: {
							amount: 2,
						},
					}),
					state: makeState(),
				}),
			),
		);

		expect(result.after.items.find((item) => item.id === "runtime:target")).toMatchObject({
			remainingUnits: 1,
		});
		expect(result.transition.events).toEqual([
			result.event,
			expect.objectContaining({
				type: "item:removed",
				snapshot: expect.objectContaining({
					id: "runtime:source",
				}),
			}),
			{
				type: GameEventEnumSchema.enum.ItemUnitSpent,
				itemId: "runtime:target",
				itemUid: "target",
				location: result.before.items.find((item) => item.id === "runtime:target")
					?.location,
				previousUnits: 2,
				resultingUnits: 1,
			},
		]);
	});

	it("queues the target termination line after its last spent unit", () => {
		const result = Effect.runSync(
			runMergeFx().pipe(
				useGameFx({
					config: createMergeTestConfig({
						rule: targetSpendRule,
						targetUnits: {
							amount: 1,
						},
						targetTerminationOutcome: guaranteedMergeOutput(),
					}),
					state: makeState(),
				}),
			),
		);
		expect(
			result.after.items.find((item) => item.id === "runtime:target")?.remainingUnits,
		).toBe(0);
		expect(result.after.jobQueue).toMatchObject([
			{
				ownerItemId: "runtime:target",
				lineUid: "termination:target",
			},
		]);
		expect(result.transition.events).toContainEqual(
			expect.objectContaining({
				type: "job:queued",
				ownerItemId: "runtime:target",
			}),
		);
	});

	it("rejects a Spend target without Units without changing runtime", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const before = yield* readRuntimeFx();
				const attempt = yield* Effect.result(runMergeFx());
				return {
					after: yield* readRuntimeFx(),
					attempt,
					before,
				};
			}).pipe(
				useGameFx({
					config: createMergeTestConfig({
						rule: targetSpendRule,
					}),
					state: makeState(),
				}),
			),
		);

		expect(Result.isFailure(result.attempt)).toBe(true);
		if (Result.isFailure(result.attempt)) {
			expect(result.attempt.failure).toMatchObject({
				_tag: "ItemUnitsUnavailableError",
				itemId: "runtime:target",
				remainingUnits: 0,
			});
		}
		expect(result.after).toEqual(result.before);
	});

	it("uses the first source-owned matching rule and never synthesizes the reverse direction", () => {
		const config = createMergeTestConfig({
			rule: [
				{
					target: {
						type: "item",
						itemUid: "target",
					},
					action: "use",
					effect: "keep",
				},
				{
					target: {
						type: "item",
						itemUid: "target",
					},
					action: "use",
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
			result.forward.after.items.find((item) => item.id === "runtime:target")?.item.uid,
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

	it("rejects same identity and stale source or target revisions without changing runtime", () => {
		const config = createMergeTestConfig({
			rule: {
				target: {
					type: "item",
					itemUid: "target",
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
