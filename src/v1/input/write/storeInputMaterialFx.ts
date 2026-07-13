import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";
import type { PositiveIntegerSchema } from "~/v1/common/schema/PositiveIntegerSchema";
import { InputMaterialUnavailableError } from "~/v1/input/error/InputMaterialUnavailableError";
import { applyInputMaterialStorePlanFx } from "~/v1/input/fx/applyInputMaterialStorePlanFx";
import { planInputMaterialStoreFx } from "~/v1/input/fx/planInputMaterialStoreFx";
import type { InputMaterialStoreResultSchema } from "~/v1/input/schema/command/InputMaterialStoreResultSchema";
import { ItemNotOnGridError } from "~/v1/item/error/ItemNotOnGridError";
import { assertRevisionFx } from "~/v1/revision/fx/assertRevisionFx";
import type { RevisionSchema } from "~/v1/revision/schema/RevisionSchema";
import { modifyRuntimeFx } from "~/v1/runtime/internal/modifyRuntimeFx";
import { filterInputSlotItemsFx } from "~/v1/input/read/filterInputSlotItemsFx";
import { readItemMaterialInputFx } from "~/v1/input/read/readItemMaterialInputFx";
import { isGridRuntimeItem } from "~/v1/runtime/read/isGridRuntimeItem";
import { readRuntimeItemByIdFx } from "~/v1/runtime/read/readRuntimeItemByIdFx";

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

			const [result, nextRuntime] = yield* applyInputMaterialStorePlanFx({
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

			return [
				result satisfies InputMaterialStoreResultSchema.Type,
				nextRuntime,
			] as const;
		});
	});
});
