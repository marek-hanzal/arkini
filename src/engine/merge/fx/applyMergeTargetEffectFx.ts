import { Effect } from "effect";
import { match } from "ts-pattern";

import { readOutputPlacementItemEventsFx } from "~/engine/event/read/readOutputPlacementItemEventsFx";
import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";
import { TargetEffectSchema } from "~/engine/merge/schema/TargetEffectSchema";
import { resolveItemFx } from "~/engine/item/fx/resolveItemFx";
import { assertOwnerIdleFx } from "~/production-job/fx/assertOwnerIdleFx";
import type { MergeSchema } from "~/engine/merge/schema/MergeSchema";
import { resolveMergeReplacementChargesFx } from "~/engine/merge/fx/resolveMergeReplacementChargesFx";
import { applyOutputPlacementFx } from "~/engine/placement/fx/applyOutputPlacementFx";
import { PlacementSchema } from "~/engine/placement/schema/PlacementSchema";
import { createRuntimeItemFx } from "~/engine/runtime/fx/createRuntimeItemFx";
import { removeRuntimeItemFx } from "~/engine/runtime/fx/removeRuntimeItemFx";
import { reviseRuntimeItemFx } from "~/engine/runtime/fx/reviseRuntimeItemFx";
import type { BoardRuntimeItemSchema } from "~/engine/runtime/schema/BoardRuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace applyMergeTargetEffectFx {
	export interface Props {
		rule: MergeSchema.Type;
		runtime: RuntimeSchema.Type;
		target: BoardRuntimeItemSchema.Type;
	}

	export interface Result {
		readonly events: readonly GameEventSchema.Type[];
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Applies one explicit authored target effect to the selected board item. */
export const applyMergeTargetEffectFx = Effect.fn("applyMergeTargetEffectFx")(function* ({
	rule,
	runtime,
	target,
}: applyMergeTargetEffectFx.Props) {
	return yield* match(rule)
		.with(
			{
				effect: TargetEffectSchema.enum.Keep,
			},
			() =>
				Effect.succeed({
					events: [],
					runtime,
				} satisfies applyMergeTargetEffectFx.Result),
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
					} satisfies applyMergeTargetEffectFx.Result;
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
						} satisfies applyMergeTargetEffectFx.Result;
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
					} satisfies applyMergeTargetEffectFx.Result;
				}),
		)
		.exhaustive();
});
