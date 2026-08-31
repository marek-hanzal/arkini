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
import type { dropFx } from "~/production-output/fx/dropFx";
import { outputFx } from "~/production-output/fx/outputFx";
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
	runtime,
	source,
}: {
	readonly action: SourceActionSchema.Type;
	readonly runtime: RuntimeSchema.Type;
	readonly source: GridRuntimeItemSchema.Type;
}) {
	yield* assertOwnerIdleFx({
		ownerItemId: source.id,
		runtime,
	});

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
				: runtime;
		draft = yield* removeRuntimeItemIdentityFx({
			item: source,
			runtime: withoutOwnedState,
		});
	}

	return {
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
		readonly returnDrop?: dropFx.Result;
		readonly runtime: RuntimeSchema.Type;
	};
});

const resolveMergeReplacementChargesFx = Effect.fn("resolveMergeReplacementChargesFx")(function* ({
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
			remainingCharges: undefined,
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
	if (target.remainingCharges === undefined) return {};

	const targetCapacity = target.item.charges?.amount;
	const resultCapacity = resultItem.charges?.amount;
	if (targetCapacity === undefined || resultCapacity === undefined || target.quantity !== 1) {
		return yield* Effect.fail(
			new ItemStatefulError({
				itemId: target.id,
			}),
		);
	}
	const remainingCharges = resultCapacity - (targetCapacity - target.remainingCharges);
	if (remainingCharges <= 0) {
		return yield* Effect.fail(
			new ItemStatefulError({
				itemId: target.id,
			}),
		);
	}

	return remainingCharges === resultCapacity
		? {}
		: {
				remainingCharges,
			};
});

const applyMergeTargetEffectFx = Effect.fn("applyMergeTargetEffectFx")(function* ({
	rule,
	runtime,
	target,
}: {
	readonly rule: MergeSchema.Type;
	readonly runtime: RuntimeSchema.Type;
	readonly target: BoardRuntimeItemSchema.Type;
}) {
	return yield* match(rule)
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
					const replacementCharges = yield* resolveMergeReplacementChargesFx({
						resultItem,
						runtime,
						target,
					});
					const replacedTarget = yield* createRuntimeItemFx({
						id: target.id,
						item: resultItem,
						location: target.location,
						quantity: 1,
						...replacementCharges,
					});
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
	runtime,
	source,
	target,
}: ApplyMergeRuntimeProps) {
	const sourceAction = yield* applyMergeSourceActionFx({
		action: rule.action,
		runtime,
		source,
	});
	const targetEffect = yield* applyMergeTargetEffectFx({
		rule,
		runtime: sourceAction.runtime,
		target,
	});
	let draft = yield* returnMergeSourceFx({
		origin: target.location,
		returnDrop: sourceAction.returnDrop,
		runtime: targetEffect.runtime,
	});
	const events = [
		...targetEffect.events,
	];

	if (rule.output === undefined) {
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
	events.push(
		...(yield* readOutputPlacementItemEventsFx({
			originItemId: target.id,
			placement,
		})),
	);
	draft = withOutput;
	return {
		events,
		runtime: draft,
	} satisfies ApplyMergeRuntimeResult;
});
