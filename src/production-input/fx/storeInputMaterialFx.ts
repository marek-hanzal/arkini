import { canControlItemProductionFn } from "~/production-line/fn/canControlItemProductionFn";
import { Effect, Option } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";
import { reconcileOutboundDeliveriesRuntimeFx } from "~/production-delivery/fx/reconcileOutboundDeliveriesRuntimeFx";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { InputMaterialUnavailableError } from "~/production-input/error/InputMaterialUnavailableError";
import { applyInputMaterialStorePlanFx } from "~/production-input/fx/applyInputMaterialStorePlanFx";
import { planInputMaterialStoreFn } from "~/production-input/fn/planInputMaterialStoreFn";
import { filterInputSlotItemsFn } from "~/production-input/fn/filterInputSlotItemsFn";
import { readItemMaterialInputFx } from "~/production-input/fx/readItemMaterialInputFx";
import { ItemNotOnGridError } from "~/item-location/error/ItemNotOnGridError";
import { LineInputClosedError } from "~/production-line/error/LineInputClosedError";
import { isLineInputClosedFn } from "~/production-line/fn/isLineInputClosedFn";
import { isSameGridLocationFn } from "~/item-location/fn/isSameGridLocationFn";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { assertRevisionFx } from "~/item-revision/fx/assertRevisionFx";
import type { RevisionSchema } from "~/item-revision/schema/RevisionSchema";
import { ItemLocationConflictError } from "~/item-location/error/ItemLocationConflictError";
import { discardRuntimeItemIdentityStateFx } from "~/game-runtime/fx/discardRuntimeItemIdentityStateFx";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";
import { narrowBoardRuntimeItemFn } from "~/game-runtime/fn/narrowBoardRuntimeItemFn";
import { readRuntimeItemByIdFx } from "~/game-runtime/fx/readRuntimeItemByIdFx";
import type { BoardRuntimeItemSchema } from "~/game-runtime/schema/BoardRuntimeItemSchema";
import type { InputRuntimeItemSchema } from "~/game-runtime/schema/InputRuntimeItemSchema";
import { CrossSpaceBoardOperationError } from "~/item-location/error/CrossSpaceBoardOperationError";

export namespace storeInputMaterialFx {
	export interface Props {
		ownerItemId: IdSchema.Type;
		ownerItemRevision?: RevisionSchema.Type;
		expectedOwnerLocation?: BoardLocationSchema.Type;
		lineId: IdSchema.Type;
		inputIndex: NonNegativeIntegerSchema.Type;
		sourceItemId: IdSchema.Type;
		sourceItemRevision: RevisionSchema.Type;
		expectedSourceLocation?: BoardLocationSchema.Type;
	}

	export interface Result {
		readonly sourceBefore: BoardRuntimeItemSchema.Type;
		readonly ownerItem: BoardRuntimeItemSchema.Type;
		readonly storedItem: InputRuntimeItemSchema.Type;
	}
}

/**
 * Atomically stores accepted material from one grid item in one owner line input.
 *
 * Optimistic owner/source facts, spatial scope, line availability, selector, and
 * capacity are all rechecked inside the serialized mutation. The exact source identity
 * and its passive owned state move together.
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
			const gridOwner = Option.getOrUndefined(narrowBoardRuntimeItemFn(owner));
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
			const source = Option.getOrUndefined(narrowBoardRuntimeItemFn(runtimeSource));
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
			const boardOwner = Option.getOrUndefined(narrowBoardRuntimeItemFn(owner));
			const boardSource = Option.getOrUndefined(narrowBoardRuntimeItemFn(source));
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
				ownerItemId,
				lineId,
				runtime,
			});
			if (closed || !canControlItemProductionFn(owner.item)) {
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
			const storedQuantity = storedItems.length;
			const plan = planInputMaterialStoreFn({
				input,
				item: source,
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
				runtime: inputSourceRuntime,
				source,
			});
			const reconciledRuntime = yield* reconcileOutboundDeliveriesRuntimeFx({
				runtime: inputRuntime,
			});
			const runtimeOwnerItem = yield* readRuntimeItemByIdFx({
				itemId: ownerItemId,
				runtime: reconciledRuntime,
			});
			const ownerItem = Option.getOrUndefined(narrowBoardRuntimeItemFn(runtimeOwnerItem));
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
						ownerItemId,
						lineId,
						inputIndex,
					} satisfies GameEventSchema.Type,
				],
			] as const;
		});
	});
});
