import { Effect, Option } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";
import { readOutputPlacementItemEventsFx } from "~/engine/event/read/readOutputPlacementItemEventsFx";
import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import { isSameGridLocationFn } from "~/engine/location/fn/isSameGridLocationFn";
import { ItemNotOnBoardError } from "~/engine/item/error/ItemNotOnBoardError";
import { ItemStatefulError } from "~/engine/item/error/ItemStatefulError";
import { isItemPureFx } from "~/engine/item/fx/purity/isItemPureFx";
import { applyOutputPlacementFx } from "~/engine/placement/fx/applyOutputPlacementFx";
import { PlacementSchema } from "~/engine/placement/schema/PlacementSchema";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { ItemLocationConflictError } from "~/engine/runtime/error/ItemLocationConflictError";
import { ItemStackSplitUnavailableError } from "~/engine/runtime/error/ItemStackSplitUnavailableError";
import { reviseRuntimeItemFx } from "~/engine/runtime/fx/reviseRuntimeItemFx";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import { isBoardRuntimeItemFx } from "~/engine/runtime/read/isBoardRuntimeItemFx";
import { readValidatedRuntimeItemFx } from "~/engine/runtime/read/readValidatedRuntimeItemFx";
import type { BoardRuntimeItemSchema } from "~/engine/runtime/schema/BoardRuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

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
			const sourceBefore = Option.getOrUndefined(yield* isBoardRuntimeItemFx(validatedItem));
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
				!(yield* isItemPureFx({
					item: sourceBefore,
					runtime,
				}))
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
