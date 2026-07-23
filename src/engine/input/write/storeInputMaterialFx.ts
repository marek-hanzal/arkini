import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import { InputMaterialUnavailableError } from "~/engine/input/error/InputMaterialUnavailableError";
import { applyInputMaterialStorePlanFx } from "~/engine/input/fx/applyInputMaterialStorePlanFx";
import { planInputMaterialStoreFx } from "~/engine/input/fx/planInputMaterialStoreFx";
import { filterInputSlotItemsFx } from "~/engine/input/read/filterInputSlotItemsFx";
import { readItemMaterialInputFx } from "~/engine/input/read/readItemMaterialInputFx";
import type { InputMaterialStoreResultSchema } from "~/engine/input/schema/command/InputMaterialStoreResultSchema";
import { ItemNotOnGridError } from "~/engine/item/error/ItemNotOnGridError";
import { isolateStatefulOwnerTransitionFx } from "~/engine/item/fx/isolateStatefulOwnerTransitionFx";
import { LineInputClosedError } from "~/engine/line/error/LineInputClosedError";
import { isLineInputClosedFx } from "~/engine/line/fx/input/isLineInputClosedFx";
import { isSameGridLocation } from "~/engine/location/read/isSameGridLocation";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import { assertRevisionFx } from "~/engine/revision/fx/assertRevisionFx";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { ItemLocationConflictError } from "~/engine/runtime/error/ItemLocationConflictError";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import { isBoardRuntimeItem } from "~/engine/runtime/read/isBoardRuntimeItem";
import { isGridRuntimeItem } from "~/engine/runtime/read/isGridRuntimeItem";
import { readRuntimeItemByIdFx } from "~/engine/runtime/read/readRuntimeItemByIdFx";
import { CrossSpaceBoardOperationError } from "~/engine/space/error/CrossSpaceBoardOperationError";

export namespace storeInputMaterialFx {
	export interface Props {
		ownerItemId: IdSchema.Type;
		ownerItemRevision?: RevisionSchema.Type;
		expectedOwnerLocation?: GridLocationSchema.Type;
		lineId: IdSchema.Type;
		inputIndex: NonNegativeIntegerSchema.Type;
		sourceItemId: IdSchema.Type;
		sourceItemRevision: RevisionSchema.Type;
		expectedSourceLocation?: GridLocationSchema.Type;
		quantity: PositiveIntegerSchema.Type;
	}
}

/**
 * Atomically stores accepted material from one grid item in one owner line input.
 */
export const storeInputMaterialFx = Effect.fn("storeInputMaterialFx")(function* ({
	ownerItemId,
	ownerItemRevision,
	expectedOwnerLocation,
	lineId,
	inputIndex,
	sourceItemId,
	sourceItemRevision,
	expectedSourceLocation,
	quantity,
}: storeInputMaterialFx.Props) {
	return yield* modifyRuntimeFx((runtime) => {
		return Effect.gen(function* () {
			const owner = yield* readRuntimeItemByIdFx({
				itemId: ownerItemId,
				runtime,
			});
			if (ownerItemRevision !== undefined) {
				yield* assertRevisionFx({
					actualRevision: owner.revision,
					entityId: owner.id,
					expectedRevision: ownerItemRevision,
				});
			}
			if (expectedOwnerLocation !== undefined) {
				if (!isGridRuntimeItem(owner)) {
					return yield* Effect.fail(
						new ItemNotOnGridError({
							itemId: owner.id,
							location: owner.location,
						}),
					);
				}
				if (!isSameGridLocation(owner.location, expectedOwnerLocation)) {
					return yield* Effect.fail(
						new ItemLocationConflictError({
							itemId: owner.id,
							expectedLocation: expectedOwnerLocation,
							actualLocation: owner.location,
						}),
					);
				}
			}
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
				expectedSourceLocation !== undefined &&
				!isSameGridLocation(source.location, expectedSourceLocation)
			) {
				return yield* Effect.fail(
					new ItemLocationConflictError({
						itemId: source.id,
						expectedLocation: expectedSourceLocation,
						actualLocation: source.location,
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
			if (
				isBoardRuntimeItem(owner) &&
				!isBoardRuntimeItem(source) &&
				owner.location.space !== runtime.currentSpace
			) {
				return yield* Effect.fail(
					new CrossSpaceBoardOperationError({
						fromSpace: runtime.currentSpace,
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
					scope: LocationScopeEnumSchema.enum.Input,
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
			const ownerItem = yield* readRuntimeItemByIdFx({
				itemId: ownerItemId,
				runtime: isolation.runtime,
			});
			if (!isGridRuntimeItem(ownerItem)) {
				return yield* Effect.dieMessage(
					`Stored input owner ${ownerItemId} lost its grid identity before commit.`,
				);
			}

			return [
				{
					...result,
					sourceBefore: source,
					ownerItem,
				} satisfies InputMaterialStoreResultSchema.Type,
				isolation.runtime,
				isolation.events,
			] as const;
		});
	});
});
