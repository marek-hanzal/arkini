import { Effect } from "effect";
import { match } from "ts-pattern";

import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import { EffectEnumSchema } from "~/engine/merge/schema/EffectEnumSchema";
import { ItemStatefulError } from "~/engine/item/error/ItemStatefulError";
import { isItemPureFx } from "~/engine/item/fx/purity/isItemPureFx";
import { resolveItemFx } from "~/engine/item/fx/resolveItemFx";
import { assertOwnerIdleFx } from "~/engine/job/fx/assertOwnerIdleFx";
import { MergeTargetStackedError } from "~/engine/merge/error/MergeTargetStackedError";
import type { MergeSchema } from "~/engine/merge/schema/MergeSchema";
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
				effect: EffectEnumSchema.enum.Keep,
			},
			() =>
				Effect.succeed({
					events: [],
					runtime,
				} satisfies applyMergeTargetEffectFx.Result),
		)
		.with(
			{
				effect: EffectEnumSchema.enum.Remove,
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
				effect: EffectEnumSchema.enum.Replace,
			},
			({ result }) =>
				Effect.gen(function* () {
					yield* assertOwnerIdleFx({
						ownerItemId: target.id,
						runtime,
					});
					if (target.quantity !== 1) {
						return yield* Effect.fail(
							new MergeTargetStackedError({
								targetItemId: target.id,
								quantity: target.quantity,
							}),
						);
					}
					const pure = yield* isItemPureFx({
						item: target,
						runtime,
					});
					if (!pure) {
						return yield* Effect.fail(
							new ItemStatefulError({
								itemId: target.id,
							}),
						);
					}

					const resultItem = yield* resolveItemFx({
						itemId: result,
					});
					const replacedTarget = yield* createRuntimeItemFx({
						id: target.id,
						item: resultItem,
						location: target.location,
						quantity: 1,
					});
					return {
						events: [],
						runtime: {
							...runtime,
							items: runtime.items.map((item) =>
								item.id === target.id ? replacedTarget : item,
							),
						} satisfies RuntimeSchema.Type,
					} satisfies applyMergeTargetEffectFx.Result;
				}),
		)
		.exhaustive();
});
