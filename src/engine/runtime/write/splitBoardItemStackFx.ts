import { Effect, Option } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import { readOutputPlacementItemEventsFx } from "~/game-event/readOutputPlacementItemEventsFx";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import { isSameGridLocationFn } from "~/item-location/fn/isSameGridLocationFn";
import { ItemNotOnBoardError } from "~/engine/item/error/ItemNotOnBoardError";
import { ItemStatefulError } from "~/engine/item/error/ItemStatefulError";
import { isItemPureFn } from "~/engine/item/fn/isItemPureFn";
import { applyOutputPlacementFx } from "~/item-placement/fx/applyOutputPlacementFx";
import { PlacementSchema } from "~/item-placement/schema/PlacementSchema";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { ItemLocationConflictError } from "~/game-runtime/error/ItemLocationConflictError";
import { ItemStackSplitUnavailableError } from "~/engine/runtime/error/ItemStackSplitUnavailableError";
import { reviseRuntimeItemFx } from "~/game-runtime/fx/reviseRuntimeItemFx";
import { modifyRuntimeFx } from "~/game-runtime/internal/modifyRuntimeFx";
import { isBoardRuntimeItemFn } from "~/game-runtime/read/fn/isBoardRuntimeItemFn";
import { readValidatedRuntimeItemFx } from "~/engine/runtime/read/readValidatedRuntimeItemFx";
import type { BoardRuntimeItemSchema } from "~/game-runtime/schema/BoardRuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace splitBoardItemStackFx {
	export interface Props {
		readonly itemId: IdSchema.Type;
		readonly revision: RevisionSchema.Type;
		readonly location: BoardLocationSchema.Type;
	}

	export interface Result {
		readonly placement: applyOutputPlacementFx.Result;
		readonly sourceAfter: BoardRuntimeItemSchema.Type;
		readonly sourceBefore: BoardRuntimeItemSchema.Type;
	}
}

/**
 * Atomically retains the larger half on one exact Board identity and places the
 * smaller half through the canonical output pipeline from that identity's origin.
 */
export const splitBoardItemStackFx = Effect.fn("splitBoardItemStackFx")(function* ({
	itemId,
	revision,
	location,
}: splitBoardItemStackFx.Props) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const validatedItem = yield* readValidatedRuntimeItemFx({
				itemId,
				revision,
				runtime,
			});
			const sourceBefore = Option.getOrUndefined(isBoardRuntimeItemFn(validatedItem));
			if (sourceBefore === undefined) {
				return yield* Effect.fail(
					new ItemNotOnBoardError({
						itemId,
						location: validatedItem.location,
					}),
				);
			}
			if (
				!isSameGridLocationFn({
					left: sourceBefore.location,
					right: location,
				})
			) {
				return yield* Effect.fail(
					new ItemLocationConflictError({
						itemId,
						expectedLocation: location,
						actualLocation: sourceBefore.location,
					}),
				);
			}
			if (sourceBefore.quantity < 2) {
				return yield* Effect.fail(
					new ItemStackSplitUnavailableError({
						itemId,
						quantity: sourceBefore.quantity,
					}),
				);
			}
			if (
				!isItemPureFn({
					item: sourceBefore,
					runtime,
				})
			) {
				return yield* Effect.fail(
					new ItemStatefulError({
						itemId,
					}),
				);
			}

			const retainedQuantity = Math.ceil(sourceBefore.quantity / 2);
			const splitQuantity = sourceBefore.quantity - retainedQuantity;
			const sourceAfter = yield* reviseRuntimeItemFx({
				item: {
					...sourceBefore,
					quantity: retainedQuantity,
				},
			});
			const sourceRuntime = {
				...runtime,
				items: runtime.items.map((item) => (item.id === itemId ? sourceAfter : item)),
			} satisfies RuntimeSchema.Type;
			const [placement, nextRuntime] = yield* applyOutputPlacementFx({
				excludedLocations: [
					sourceBefore.location,
				],
				origin: sourceBefore.location,
				output: {
					drop: [
						{
							itemId: sourceBefore.item.id,
							placement: PlacementSchema.enum.Drop,
							quantity: splitQuantity,
						},
					],
				},
				runtime: sourceRuntime,
			});
			const placementEvents = yield* readOutputPlacementItemEventsFx({
				originItemId: itemId,
				placement,
			});

			return [
				{
					placement,
					sourceAfter,
					sourceBefore,
				} satisfies splitBoardItemStackFx.Result,
				nextRuntime,
				[
					{
						type: GameEventEnumSchema.enum.ItemSplit,
						itemId,
						canonicalItemId: sourceBefore.item.id,
						location: sourceBefore.location,
						previousQuantity: sourceBefore.quantity,
						quantity: sourceAfter.quantity,
					},
					...placementEvents,
				],
			] as const;
		}),
	);
});
