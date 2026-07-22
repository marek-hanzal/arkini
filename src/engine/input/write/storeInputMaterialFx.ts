import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import { InputMaterialUnavailableError } from "~/engine/input/error/InputMaterialUnavailableError";
import { applyInputMaterialStorePlanFx } from "~/engine/input/fx/applyInputMaterialStorePlanFx";
import { planInputMaterialStoreFx } from "~/engine/input/fx/planInputMaterialStoreFx";
import type { InputMaterialStoreResultSchema } from "~/engine/input/schema/command/InputMaterialStoreResultSchema";
import { isolateStatefulOwnerTransitionFx } from "~/engine/item/fx/isolateStatefulOwnerTransitionFx";
import { ItemNotOnGridError } from "~/engine/item/error/ItemNotOnGridError";
import { LineInputClosedError } from "~/engine/line/error/LineInputClosedError";
import { isLineInputClosedFx } from "~/engine/line/fx/input/isLineInputClosedFx";
import { assertRevisionFx } from "~/engine/revision/fx/assertRevisionFx";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import { filterInputSlotItemsFx } from "~/engine/input/read/filterInputSlotItemsFx";
import { readItemMaterialInputFx } from "~/engine/input/read/readItemMaterialInputFx";
import { isBoardRuntimeItem } from "~/engine/runtime/read/isBoardRuntimeItem";
import { isGridRuntimeItem } from "~/engine/runtime/read/isGridRuntimeItem";
import { CrossSpaceBoardOperationError } from "~/engine/space/error/CrossSpaceBoardOperationError";
import { readRuntimeItemByIdFx } from "~/engine/runtime/read/readRuntimeItemByIdFx";

export namespace storeInputMaterialFx {
	export interface Props {
		ownerItemId: IdSchema.Type;
		lineId: IdSchema.Type;
		inputIndex: NonNegativeIntegerSchema.Type;
		sourceItemId: IdSchema.Type;
		sourceItemRevision: RevisionSchema.Type;
		quantity: PositiveIntegerSchema.Type;
	}
}

/**
 * Atomically stores accepted material from one grid item in one owner line input.
 */
export const storeInputMaterialFx = Effect.fn("storeInputMaterialFx")(function* ({
	ownerItemId,
	lineId,
	inputIndex,
	sourceItemId,
	sourceItemRevision,
	quantity,
}: storeInputMaterialFx.Props) {
	return yield* modifyRuntimeFx((runtime) => {
		return Effect.gen(function* () {
			const owner = yield* readRuntimeItemByIdFx({
				itemId: ownerItemId,
				runtime,
			});
			const source = yield* readRuntimeItemByIdFx({
				itemId: sourceItemId,
				runtime,
			});
			yield* assertRevisionFx({
				actualRevision: source.revision,
				entityId: source.id,
				expectedRevision: sourceItemRevision,
			});
			if (!isGridRuntimeItem(source)) {
				return yield* Effect.fail(
					new ItemNotOnGridError({
						itemId: sourceItemId,
						location: source.location,
					}),
				);
			}
			if (
				isBoardRuntimeItem(owner) &&
				isBoardRuntimeItem(source) &&
				owner.location.space !== source.location.space
			) {
				return yield* Effect.fail(
					new CrossSpaceBoardOperationError({
						fromSpace: source.location.space,
						toSpace: owner.location.space,
					}),
				);
			}
			if (ownerItemId === sourceItemId) {
				return yield* Effect.fail(
					new InputMaterialUnavailableError({
						ownerItemId,
						lineId,
						inputIndex,
						sourceItemId,
					}),
				);
			}

			const input = yield* readItemMaterialInputFx({
				inputIndex,
				item: owner.item,
				lineId,
				ownerItemId,
			});
			const closed = yield* isLineInputClosedFx({
				input,
				ownerItemId,
				lineId,
				runtime,
			});
			if (closed) {
				return yield* Effect.fail(
					new LineInputClosedError({
						ownerItemId,
						lineId,
						inputIndex,
					}),
				);
			}

			const storedItems = yield* filterInputSlotItemsFx({
				inputIndex,
				items: runtime.items,
				lineId,
				ownerItemId,
			});
			const storedQuantity = storedItems.reduce((total, item) => total + item.quantity, 0);
			const plan = yield* planInputMaterialStoreFx({
				input,
				item: source,
				requestedQuantity: quantity,
				storedQuantity,
			});
			if (plan === undefined) {
				return yield* Effect.fail(
					new InputMaterialUnavailableError({
						ownerItemId,
						lineId,
						inputIndex,
						sourceItemId,
					}),
				);
			}

			const [result, inputRuntime] = yield* applyInputMaterialStorePlanFx({
				location: {
					scope: "input",
					ownerItemId,
					lineId,
					inputIndex,
				},
				plan,
				runtime,
				source,
			});
			const isolation = yield* isolateStatefulOwnerTransitionFx({
				ownerItemId,
				runtime: inputRuntime,
			});

			return [
				result satisfies InputMaterialStoreResultSchema.Type,
				isolation.runtime,
				isolation.events,
			] as const;
		});
	});
});
