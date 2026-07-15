import { Effect } from "effect";
import { match } from "ts-pattern";

import { ItemStatefulError } from "~/v1/item/error/ItemStatefulError";
import { isItemPureFx } from "~/v1/item/fx/purity/isItemPureFx";
import { resolveItemFx } from "~/v1/item/fx/resolveItemFx";
import { assertOwnerIdleFx } from "~/v1/job/fx/assertOwnerIdleFx";
import { MergeTargetStackedError } from "~/v1/merge/error/MergeTargetStackedError";
import type { MergeSchema } from "~/v1/merge/schema/MergeSchema";
import { removeRuntimeItemFx } from "~/v1/runtime/fx/removeRuntimeItemFx";
import { reviseRuntimeItemFx } from "~/v1/runtime/fx/reviseRuntimeItemFx";
import type { BoardRuntimeItemSchema } from "~/v1/runtime/schema/BoardRuntimeItemSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

export namespace applyMergeTargetEffectFx {
	export interface Props {
		rule: MergeSchema.Type;
		runtime: RuntimeSchema.Type;
		target: BoardRuntimeItemSchema.Type;
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
				effect: "keep",
			},
			() => Effect.succeed(runtime),
		)
		.with(
			{
				effect: "remove",
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
						...runtime,
						items: runtime.items.map((item) =>
							item.id === target.id ? remainingTarget : item,
						),
					} satisfies RuntimeSchema.Type;
				}),
		)
		.with(
			{
				effect: "replace",
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
					const replacedTarget = yield* reviseRuntimeItemFx({
						item: {
							id: target.id,
							item: resultItem,
							location: target.location,
							quantity: 1,
							remainingDurationMs:
								resultItem.type === "temporary" ? resultItem.durationMs : undefined,
							revision: target.revision,
						} satisfies BoardRuntimeItemSchema.Type,
					});
					return {
						...runtime,
						items: runtime.items.map((item) =>
							item.id === target.id ? replacedTarget : item,
						),
					} satisfies RuntimeSchema.Type;
				}),
		)
		.exhaustive();
});
