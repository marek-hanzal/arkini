import { Effect } from "effect";
import { match } from "ts-pattern";

import { readOutputPlacementItemEventsFx } from "~/game-event/fx/readOutputPlacementItemEventsFx";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { ItemStatefulError } from "~/game-runtime/error/ItemStatefulError";
import { isItemPureFn } from "~/game-runtime/fn/isItemPureFn";
import { resolveItemFx } from "~/item-resolution/fx/resolveItemFx";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { MergeSchema } from "~/item-merge/schema/MergeSchema";
import { SourceActionSchema } from "~/item-merge/schema/SourceActionSchema";
import { TargetEffectSchema } from "~/item-merge/schema/TargetEffectSchema";
import { assertOwnerIdleFx } from "~/production-job/fx/assertOwnerIdleFx";
import { spendActionUnitsFx } from "~/production-action/fx/spendActionUnitsFx";
import type { dropFx } from "~/production-output/fx/dropFx";
import { outputFx } from "~/production-output/fx/outputFx";
import { assertPlacementMaxCountFx } from "~/item-placement/fx/assertPlacementMaxCountFx";
import { readBoardRuntimeItemByIdFx } from "~/game-runtime/fx/readBoardRuntimeItemByIdFx";
import { applyOutputPlacementFx } from "~/item-placement/fx/applyOutputPlacementFx";
import { applyPlacementPlanFx } from "~/item-placement/fx/applyPlacementPlanFx";
import { planDropPlacementFx } from "~/item-placement/fx/planDropPlacementFx";
import { PlacementSchema } from "~/item-placement/schema/PlacementSchema";
import { createRuntimeItemFx } from "~/game-runtime/fx/createRuntimeItemFx";
import { discardRuntimeItemOwnedStateFx } from "~/game-runtime/fx/discardRuntimeItemOwnedStateFx";
import { removeRuntimeItemFx } from "~/game-runtime/fx/removeRuntimeItemFx";
import { removeRuntimeItemIdentityFx } from "~/game-runtime/fx/removeRuntimeItemIdentityFx";
import { reviseRuntimeItemFx } from "~/game-runtime/fx/reviseRuntimeItemFx";
import type { BoardRuntimeItemSchema } from "~/game-runtime/schema/BoardRuntimeItemSchema";
import type { GridRuntimeItemSchema } from "~/game-runtime/schema/GridRuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

const applyMergeSourceActionFx = Effect.fn("applyMergeSourceActionFx")(function* ({
	action,
	actionId,
	runtime,
	source,
}: {
	readonly action: SourceActionSchema.Type;
	readonly actionId: string;
	readonly runtime: RuntimeSchema.Type;
	readonly source: GridRuntimeItemSchema.Type;
}) {
	yield* assertOwnerIdleFx({
		ownerItemId: source.id,
		runtime,
	});
	if (action === SourceActionSchema.enum.Spend) {
		const spent = yield* spendActionUnitsFx({
			actionId,
			cost: 1,
			itemId: source.id,
			ownerItemId: source.id,
			runtime,
		});
		return {
			events: spent.events,
			runtime: spent.runtime,
		} satisfies {
			readonly events: readonly GameEventSchema.Type[];
			readonly returnDrop?: dropFx.Result;
			readonly runtime: RuntimeSchema.Type;
		};
	}

	if (action === SourceActionSchema.enum.Use) {
		const pure = isItemPureFn({
			item: source,
			runtime,
		});
		if (!pure) {
			return yield* Effect.fail(
				new ItemStatefulError({
					itemId: source.id,
				}),
			);
		}
	}

	let draft: RuntimeSchema.Type;
	const events: GameEventSchema.Type[] = [];
	if (source.quantity > 1) {
		const remainingSource = yield* reviseRuntimeItemFx({
			item: {
				...source,
				quantity: source.quantity - 1,
			} satisfies GridRuntimeItemSchema.Type,
		});
		draft = {
			...runtime,
			items: runtime.items.map((item) => (item.id === source.id ? remainingSource : item)),
		};
	} else {
		const withoutOwnedState =
			action === SourceActionSchema.enum.Consume
				? yield* discardRuntimeItemOwnedStateFx({
						ownerItemId: source.id,
						runtime,
					})
				: {
						runtime,
						events: [],
					};
		const removed = yield* removeRuntimeItemIdentityFx({
			item: source,
			runtime: withoutOwnedState.runtime,
		});
		draft = removed.runtime;
		events.push(...withoutOwnedState.events, ...removed.events);
	}

	return {
		events,
		returnDrop:
			action === SourceActionSchema.enum.Use
				? {
						itemId: source.item.id,
						placement: PlacementSchema.enum.Drop,
						quantity: 1,
					}
				: undefined,
		runtime: draft,
	} satisfies {
		readonly events: readonly GameEventSchema.Type[];
		readonly returnDrop?: dropFx.Result;
		readonly runtime: RuntimeSchema.Type;
	};
});

const resolveMergeReplacementUnitsFx = Effect.fn("resolveMergeReplacementUnitsFx")(function* ({
	resultItem,
	runtime,
	target,
}: {
	readonly resultItem: ItemSchema.Type;
	readonly runtime: RuntimeSchema.Type;
	readonly target: BoardRuntimeItemSchema.Type;
}) {
	const otherwisePure = isItemPureFn({
		item: {
			...target,
			remainingUnits: undefined,
			schedule: undefined,
		},
		runtime,
	});
	if (!otherwisePure) {
		return yield* Effect.fail(
			new ItemStatefulError({
				itemId: target.id,
			}),
		);
	}
	if (target.remainingUnits === undefined) return {};

	const targetCapacity = target.item.units?.amount;
	const resultCapacity = resultItem.units?.amount;
	// A unitless replacement ends the old supply; only finite results inherit spent units.
	if (resultCapacity === undefined) return {};
	if (targetCapacity === undefined || target.quantity !== 1) {
		return yield* Effect.fail(
			new ItemStatefulError({
				itemId: target.id,
			}),
		);
	}
	const remainingUnits = resultCapacity - (targetCapacity - target.remainingUnits);
	if (remainingUnits <= 0) {
		return yield* Effect.fail(
			new ItemStatefulError({
				itemId: target.id,
			}),
		);
	}

	return remainingUnits === resultCapacity
		? {}
		: {
				remainingUnits,
			};
});

const applyMergeTargetEffectFx = Effect.fn("applyMergeTargetEffectFx")(function* ({
	actionId,
	ownerItemId,
	rule,
	runtime,
	target,
}: {
	readonly actionId: string;
	readonly ownerItemId: string;
	readonly rule: MergeSchema.Type;
	readonly runtime: RuntimeSchema.Type;
	readonly target: BoardRuntimeItemSchema.Type;
}) {
	return yield* match(rule)
		.with(
			{
				effect: TargetEffectSchema.enum.Spend,
			},
			() =>
				spendActionUnitsFx({
					actionId,
					cost: 1,
					itemId: target.id,
					ownerItemId,
					runtime,
				}),
		)
		.with(
			{
				effect: TargetEffectSchema.enum.Keep,
			},
			() =>
				Effect.succeed({
					events: [],
					runtime,
				}),
		)
		.with(
			{
				effect: TargetEffectSchema.enum.Remove,
			},
			() =>
				Effect.gen(function* () {
					yield* assertOwnerIdleFx({
						ownerItemId: target.id,
						runtime,
					});
					if (target.quantity === 1) {
						return yield* removeRuntimeItemFx({
							item: target,
							runtime,
						});
					}

					const remainingTarget = yield* reviseRuntimeItemFx({
						item: {
							...target,
							quantity: target.quantity - 1,
						} satisfies BoardRuntimeItemSchema.Type,
					});
					return {
						events: [],
						runtime: {
							...runtime,
							items: runtime.items.map((item) =>
								item.id === target.id ? remainingTarget : item,
							),
						} satisfies RuntimeSchema.Type,
					};
				}),
		)
		.with(
			{
				effect: TargetEffectSchema.enum.Replace,
			},
			({ result }) =>
				Effect.gen(function* () {
					yield* assertOwnerIdleFx({
						ownerItemId: target.id,
						runtime,
					});
					const resultItem = yield* resolveItemFx({
						itemId: result,
					});
					const replacementUnits = yield* resolveMergeReplacementUnitsFx({
						resultItem,
						runtime,
						target,
					});
					// Replacement removes one target quantity; its remainder and active output
					// reservations still own capacity while the replacement is admitted.
					yield* assertPlacementMaxCountFx({
						drop: {
							itemId: resultItem.id,
							placement: PlacementSchema.enum.Drop,
							quantity: 1,
						},
						item: resultItem,
						runtime: {
							...runtime,
							items: runtime.items.flatMap((item) => {
								if (item.id !== target.id)
									return [
										item,
									];
								return item.quantity === 1
									? []
									: [
											{
												...item,
												quantity: item.quantity - 1,
											},
										];
							}),
						},
					});
					const replacement = yield* createRuntimeItemFx({
						id: target.id,
						item: resultItem,
						location: target.location,
						quantity: 1,
						...replacementUnits,
					});
					// Replacement retains the target identity, including its random-stream cursor.
					const replacedTarget = {
						...replacement,
						mergeSequence: target.mergeSequence,
					};
					const replacedRuntime = {
						...runtime,
						items: runtime.items.map((item) =>
							item.id === target.id ? replacedTarget : item,
						),
					} satisfies RuntimeSchema.Type;
					if (target.quantity === 1) {
						return {
							events: [],
							runtime: replacedRuntime,
						};
					}

					const [placement, placedRuntime] = yield* applyOutputPlacementFx({
						origin: target.location,
						output: {
							drop: [
								{
									itemId: target.item.id,
									placement: PlacementSchema.enum.Drop,
									quantity: target.quantity - 1,
								},
							],
						},
						runtime: replacedRuntime,
					});
					const placementEvents = yield* readOutputPlacementItemEventsFx({
						originItemId: target.id,
						placement,
					});
					return {
						events: [
							{
								type: GameEventEnumSchema.enum.ItemSplit,
								itemId: target.id,
								canonicalItemId: target.item.id,
								location: target.location,
								previousQuantity: target.quantity,
								quantity: 1,
							},
							...placementEvents,
						],
						runtime: placedRuntime,
					};
				}),
		)
		.exhaustive();
});

const returnMergeSourceFx = Effect.fn("returnMergeSourceFx")(function* ({
	origin,
	returnDrop,
	runtime,
}: {
	readonly origin: BoardRuntimeItemSchema.Type["location"];
	readonly returnDrop?: dropFx.Result;
	readonly runtime: RuntimeSchema.Type;
}) {
	if (returnDrop === undefined) return runtime;

	const plan = yield* planDropPlacementFx({
		drop: returnDrop,
		origin,
		runtime,
	});
	const [, nextRuntime] = yield* applyPlacementPlanFx({
		plan,
		runtime,
	});
	return nextRuntime;
});

interface ApplyMergeRuntimeProps {
	readonly rule: MergeSchema.Type;
	readonly ruleIndex: number;
	readonly runtime: RuntimeSchema.Type;
	readonly source: GridRuntimeItemSchema.Type;
	readonly target: BoardRuntimeItemSchema.Type;
}

interface ApplyMergeRuntimeResult {
	readonly events: readonly GameEventSchema.Type[];
	readonly runtime: RuntimeSchema.Type;
}

/** Applies one resolved directional merge to an immutable candidate runtime. */
export const applyMergeRuntimeFx = Effect.fn("applyMergeRuntimeFx")(function* ({
	rule,
	ruleIndex,
	runtime,
	source,
	target,
}: ApplyMergeRuntimeProps) {
	const sourceAction = yield* applyMergeSourceActionFx({
		action: rule.action,
		actionId: `merge:${ruleIndex}:${source.mergeSequence ?? 0}`,
		runtime,
		source,
	});
	// Source depletion and input returns can stack into the target before its
	// effect runs. Settle that current quantity without changing the query snapshot.
	const currentTarget = yield* readBoardRuntimeItemByIdFx({
		itemId: target.id,
		runtime: sourceAction.runtime,
	});
	const targetEffect = yield* applyMergeTargetEffectFx({
		actionId: `merge:${ruleIndex}:target:${source.mergeSequence ?? 0}`,
		ownerItemId: source.id,
		rule,
		runtime: sourceAction.runtime,
		target: currentTarget,
	});
	let draft = yield* returnMergeSourceFx({
		origin: target.location,
		returnDrop: sourceAction.returnDrop,
		runtime: targetEffect.runtime,
	});
	const events = [
		...sourceAction.events,
		...targetEffect.events,
	];
	const targetDisappeared =
		rule.effect === TargetEffectSchema.enum.Remove && currentTarget.quantity === 1;

	if (rule.output === undefined) {
		if (targetDisappeared) {
			events.push({
				type: GameEventEnumSchema.enum.ItemDisappeared,
				itemId: target.id,
				canonicalItemId: target.item.id,
				location: target.location,
				quantity: 1,
			});
		}
		return {
			events,
			runtime: draft,
		} satisfies ApplyMergeRuntimeResult;
	}
	const output = yield* outputFx({
		origin: target.location,
		output: rule.output,
	});
	const [placement, withOutput] = yield* applyOutputPlacementFx({
		origin: target.location,
		output,
		runtime: draft,
	});
	const placementEvents = yield* readOutputPlacementItemEventsFx({
		originItemId: target.id,
		placement,
	});
	events.push(...placementEvents);
	if (targetDisappeared && placementEvents.length === 0) {
		events.push({
			type: GameEventEnumSchema.enum.ItemDisappeared,
			itemId: target.id,
			canonicalItemId: target.item.id,
			location: target.location,
			quantity: 1,
		});
	}
	draft = withOutput;
	return {
		events,
		runtime: draft,
	} satisfies ApplyMergeRuntimeResult;
});
