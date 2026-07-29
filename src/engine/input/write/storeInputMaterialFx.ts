import { Effect, Option } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import { reconcileOutboundDeliveriesRuntimeFx } from "~/engine/delivery/fx/reconcileOutboundDeliveriesRuntimeFx";
import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";
import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
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
import { isSameGridLocationFx } from "~/engine/location/read/isSameGridLocationFx";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import { assertRevisionFx } from "~/engine/revision/fx/assertRevisionFx";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { ItemLocationConflictError } from "~/engine/runtime/error/ItemLocationConflictError";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import { isBoardRuntimeItemFx } from "~/engine/runtime/read/isBoardRuntimeItemFx";
import { isGridRuntimeItemFx } from "~/engine/runtime/read/isGridRuntimeItemFx";
import { readRuntimeItemByIdFx } from "~/engine/runtime/read/readRuntimeItemByIdFx";
import { CrossSpaceBoardOperationError } from "~/engine/space/error/CrossSpaceBoardOperationError";
import { assertDropDestinationExpectationFx } from "~/engine/runtime/read/assertDropDestinationExpectationFx";

export namespace storeInputMaterialFx {
	export interface Props {
		readonly destinationLocation?: GridLocationSchema.Type;
		readonly expectedCollisions?: ReadonlyArray<{
			readonly itemId: IdSchema.Type;
			readonly revision: RevisionSchema.Type;
		}>;
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
 *
 * Optimistic owner/source facts, spatial scope, line availability, selector, and
 * capacity are all rechecked inside the serialized mutation. Once buffered state
 * attaches to the owner identity, a stacked owner is isolated to quantity one and
 * its pure remainder is delivered through canonical placement in the same commit.
 */
export const storeInputMaterialFx = Effect.fn("storeInputMaterialFx")(function* ({
	destinationLocation,
	expectedCollisions,
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
			const gridOwner = Option.getOrUndefined(yield* isGridRuntimeItemFx(owner));
			if (expectedOwnerLocation !== undefined) {
				if (gridOwner === undefined) {
					return yield* Effect.fail(
						new ItemNotOnGridError({
							itemId: owner.id,
							location: owner.location,
						}),
					);
				}
				if (
					!(yield* isSameGridLocationFx({
						left: gridOwner.location,
						right: expectedOwnerLocation,
					}))
				) {
					return yield* Effect.fail(
						new ItemLocationConflictError({
							itemId: owner.id,
							expectedLocation: expectedOwnerLocation,
							actualLocation: gridOwner.location,
						}),
					);
				}
			}
			const runtimeSource = yield* readRuntimeItemByIdFx({
				itemId: sourceItemId,
				runtime,
			});
			yield* assertRevisionFx({
				actualRevision: runtimeSource.revision,
				entityId: runtimeSource.id,
				expectedRevision: sourceItemRevision,
			});
			const source = Option.getOrUndefined(yield* isGridRuntimeItemFx(runtimeSource));
			if (source === undefined) {
				return yield* Effect.fail(
					new ItemNotOnGridError({
						itemId: sourceItemId,
						location: runtimeSource.location,
					}),
				);
			}
			if (
				expectedSourceLocation !== undefined &&
				!(yield* isSameGridLocationFx({
					left: source.location,
					right: expectedSourceLocation,
				}))
			) {
				return yield* Effect.fail(
					new ItemLocationConflictError({
						itemId: source.id,
						expectedLocation: expectedSourceLocation,
						actualLocation: source.location,
					}),
				);
			}
			const boardOwner = Option.getOrUndefined(yield* isBoardRuntimeItemFx(owner));
			const boardSource = Option.getOrUndefined(yield* isBoardRuntimeItemFx(source));
			if (
				boardOwner !== undefined &&
				boardSource !== undefined &&
				boardOwner.location.space !== boardSource.location.space
			) {
				return yield* Effect.fail(
					new CrossSpaceBoardOperationError({
						fromSpace: boardSource.location.space,
						toSpace: boardOwner.location.space,
					}),
				);
			}
			if (
				boardOwner !== undefined &&
				boardSource === undefined &&
				boardOwner.location.space !== runtime.currentSpace
			) {
				return yield* Effect.fail(
					new CrossSpaceBoardOperationError({
						fromSpace: runtime.currentSpace,
						toSpace: boardOwner.location.space,
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
			if (destinationLocation !== undefined && expectedCollisions !== undefined) {
				yield* assertDropDestinationExpectationFx({
					allowAdditionalOccupants: false,
					expectedCollisions,
					explicitTargetItemId: owner.id,
					location: destinationLocation,
					runtime,
					source,
				});
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
			const reconciledRuntime = yield* reconcileOutboundDeliveriesRuntimeFx({
				runtime: isolation.runtime,
			});
			const runtimeOwnerItem = yield* readRuntimeItemByIdFx({
				itemId: ownerItemId,
				runtime: reconciledRuntime,
			});
			const ownerItem = Option.getOrUndefined(yield* isGridRuntimeItemFx(runtimeOwnerItem));
			if (ownerItem === undefined) {
				return yield* Effect.die(
					new Error(
						`Stored input owner ${ownerItemId} lost its grid identity before commit.`,
					),
				);
			}

			return [
				{
					...result,
					sourceBefore: source,
					ownerItem,
				} satisfies InputMaterialStoreResultSchema.Type,
				reconciledRuntime,
				[
					{
						type: GameEventEnumSchema.enum.ItemInputStored,
						sourceItemId: source.id,
						canonicalItemId: source.item.id,
						previousSourceLocation: source.location,
						previousQuantity: source.quantity,
						storedQuantity: result.storedItem.quantity,
						resultingQuantity: result.sourceItem?.quantity ?? 0,
						ownerItemId,
						lineId,
						inputIndex,
					} satisfies GameEventSchema.Type,
					...isolation.events,
				],
			] as const;
		});
	});
});
