import { Effect, Option } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/game-config/schema/NonNegativeIntegerSchema";
import type { PositiveIntegerSchema } from "~/game-config/schema/PositiveIntegerSchema";
import { reconcileOutboundDeliveriesRuntimeFx } from "~/production-delivery/fx/reconcileOutboundDeliveriesRuntimeFx";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { InputMaterialUnavailableError } from "~/production-input/error/InputMaterialUnavailableError";
import { applyInputMaterialStorePlanFx } from "~/production-input/fx/applyInputMaterialStorePlanFx";
import { planInputMaterialStoreFn } from "~/production-input/fn/planInputMaterialStoreFn";
import { filterInputSlotItemsFn } from "~/production-input/fn/filterInputSlotItemsFn";
import { readItemMaterialInputFx } from "~/production-input/read/readItemMaterialInputFx";
import { ItemNotOnGridError } from "~/item-location/error/ItemNotOnGridError";
import { isolateStatefulOwnerTransitionFx } from "~/item-state-isolation/fx/isolateStatefulOwnerTransitionFx";
import { LineInputClosedError } from "~/production-line/error/LineInputClosedError";
import { isLineInputClosedFn } from "~/production-line/fn/isLineInputClosedFn";
import { isSameGridLocationFn } from "~/item-location/fn/isSameGridLocationFn";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { assertRevisionFx } from "~/item-revision/fx/assertRevisionFx";
import type { RevisionSchema } from "~/item-revision/schema/RevisionSchema";
import { ItemLocationConflictError } from "~/game-runtime/error/ItemLocationConflictError";
import { discardRuntimeItemIdentityStateFx } from "~/game-runtime/fx/discardRuntimeItemIdentityStateFx";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";
import { isBoardRuntimeItemFn } from "~/game-runtime/fn/isBoardRuntimeItemFn";
import { isGridRuntimeItemFn } from "~/game-runtime/fn/isGridRuntimeItemFn";
import { readRuntimeItemByIdFx } from "~/game-runtime/fx/readRuntimeItemByIdFx";
import type { GridRuntimeItemSchema } from "~/game-runtime/schema/GridRuntimeItemSchema";
import type { InputRuntimeItemSchema } from "~/game-runtime/schema/InputRuntimeItemSchema";
import { CrossSpaceBoardOperationError } from "~/item-location/error/CrossSpaceBoardOperationError";

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

	export interface Result {
		readonly sourceBefore: GridRuntimeItemSchema.Type;
		readonly ownerItem: GridRuntimeItemSchema.Type;
		readonly storedItem: InputRuntimeItemSchema.Type;
		readonly sourceItem?: GridRuntimeItemSchema.Type;
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
			const gridOwner = Option.getOrUndefined(isGridRuntimeItemFn(owner));
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
					!isSameGridLocationFn({
						left: gridOwner.location,
						right: expectedOwnerLocation,
					})
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
			const source = Option.getOrUndefined(isGridRuntimeItemFn(runtimeSource));
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
				!isSameGridLocationFn({
					left: source.location,
					right: expectedSourceLocation,
				})
			) {
				return yield* Effect.fail(
					new ItemLocationConflictError({
						itemId: source.id,
						expectedLocation: expectedSourceLocation,
						actualLocation: source.location,
					}),
				);
			}
			const boardOwner = Option.getOrUndefined(isBoardRuntimeItemFn(owner));
			const boardSource = Option.getOrUndefined(isBoardRuntimeItemFn(source));
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

			const input = yield* readItemMaterialInputFx({
				inputIndex,
				item: owner.item,
				lineId,
				ownerItemId,
			});
			const closed = isLineInputClosedFn({
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

			const storedItems = filterInputSlotItemsFn({
				inputIndex,
				items: runtime.items,
				lineId,
				ownerItemId,
			});
			const storedQuantity = storedItems.reduce((total, item) => total + item.quantity, 0);
			const plan = planInputMaterialStoreFn({
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

			if (runtime.jobs.some((job) => job.ownerItemId === source.id)) {
				return yield* Effect.fail(
					new InputMaterialUnavailableError({
						ownerItemId,
						lineId,
						inputIndex,
						sourceItemId,
					}),
				);
			}
			const inputSourceRuntime = yield* discardRuntimeItemIdentityStateFx({
				ownerItemIds: new Set([
					source.id,
				]),
				runtime,
			});
			const [result, inputRuntime] = yield* applyInputMaterialStorePlanFx({
				location: {
					scope: LocationScopeEnumSchema.enum.Input,
					ownerItemId,
					lineId,
					inputIndex,
				},
				plan,
				runtime: inputSourceRuntime,
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
			const ownerItem = Option.getOrUndefined(isGridRuntimeItemFn(runtimeOwnerItem));
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
				} satisfies storeInputMaterialFx.Result,
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
