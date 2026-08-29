import { Array, Effect, Option, pipe } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { ItemNotFoundError } from "~/engine/item/error/ItemNotFoundError";
import { ItemLocationConflictError } from "~/game-runtime/error/ItemLocationConflictError";
import { ItemNotOnGridError } from "~/engine/item/error/ItemNotOnGridError";
import { readGridLocationClaimAtFn } from "~/item-location/fn/readGridLocationClaimAtFn";
import { readGridLocationClaimsFn } from "~/item-location/fn/readGridLocationClaimsFn";
import { isSameGridLocationFn } from "~/item-location/fn/isSameGridLocationFn";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import { assertRevisionFx } from "~/engine/revision/fx/assertRevisionFx";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { LocationOccupiedError } from "~/engine/runtime/error/LocationOccupiedError";
import { CrossSpaceBoardOperationError } from "~/item-location/error/CrossSpaceBoardOperationError";
import { reviseRuntimeItemFx } from "~/game-runtime/fx/reviseRuntimeItemFx";
import { modifyRuntimeFx } from "~/game-runtime/internal/modifyRuntimeFx";
import { isGridRuntimeItemFn } from "~/game-runtime/read/fn/isGridRuntimeItemFn";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";

export namespace moveItemFx {
	export interface Props {
		itemId: IdSchema.Type;
		location: GridLocationSchema.Type;
		revision: RevisionSchema.Type;
		expectedLocation?: GridLocationSchema.Type;
	}

	export interface Result {
		readonly item: RuntimeItemSchema.Type;
		readonly previousLocation: GridLocationSchema.Type;
	}
}

/**
 * Atomically moves one live item to an unoccupied location.
 */
export const moveItemFx = Effect.fn("moveItemFx")(function* ({
	itemId,
	location,
	revision,
	expectedLocation,
}: moveItemFx.Props) {
	return yield* modifyRuntimeFx((runtime) => {
		return Effect.gen(function* () {
			const runtimeItem = pipe(
				runtime.items,
				Array.findFirst((candidate) => candidate.id === itemId),
				Option.getOrUndefined,
			);
			if (runtimeItem === undefined) {
				return yield* Effect.fail(
					new ItemNotFoundError({
						itemId,
					}),
				);
			}
			yield* assertRevisionFx({
				actualRevision: runtimeItem.revision,
				entityId: runtimeItem.id,
				expectedRevision: revision,
			});
			const item = Option.getOrUndefined(isGridRuntimeItemFn(runtimeItem));
			if (item === undefined) {
				return yield* Effect.fail(
					new ItemNotOnGridError({
						itemId,
						location: runtimeItem.location,
					}),
				);
			}

			if (
				expectedLocation !== undefined &&
				!isSameGridLocationFn({
					left: item.location,
					right: expectedLocation,
				})
			) {
				return yield* Effect.fail(
					new ItemLocationConflictError({
						itemId,
						expectedLocation,
						actualLocation: item.location,
					}),
				);
			}
			if (
				isSameGridLocationFn({
					left: item.location,
					right: location,
				})
			) {
				return [
					{
						item,
						previousLocation: item.location,
					} satisfies moveItemFx.Result,
					runtime,
				] as const;
			}

			if (
				item.location.scope === LocationScopeEnumSchema.enum.Board &&
				location.scope === LocationScopeEnumSchema.enum.Board &&
				item.location.space !== location.space
			) {
				return yield* Effect.fail(
					new CrossSpaceBoardOperationError({
						fromSpace: item.location.space,
						toSpace: location.space,
					}),
				);
			}
			if (
				(item.location.scope === LocationScopeEnumSchema.enum.Inventory ||
					item.location.scope === LocationScopeEnumSchema.enum.Toolbar) &&
				location.scope === LocationScopeEnumSchema.enum.Board &&
				location.space !== runtime.currentSpace
			) {
				return yield* Effect.fail(
					new CrossSpaceBoardOperationError({
						fromSpace: runtime.currentSpace,
						toSpace: location.space,
					}),
				);
			}

			const claim = readGridLocationClaimAtFn({
				claims: readGridLocationClaimsFn({
					runtime,
				}).filter((candidate) => candidate.itemId !== itemId),
				location,
			});
			if (claim !== undefined) {
				return yield* Effect.fail(
					new LocationOccupiedError({
						itemId: claim.itemId,
						location,
					}),
				);
			}

			const movedItem = yield* reviseRuntimeItemFx({
				item: {
					...item,
					location,
				} satisfies RuntimeItemSchema.Type,
			});
			const result = {
				item: movedItem,
				previousLocation: item.location,
			} satisfies moveItemFx.Result;

			const nextRuntime = {
				...runtime,
				items: runtime.items.map((candidate) => {
					return candidate.id === itemId ? movedItem : candidate;
				}),
			} satisfies RuntimeSchema.Type;

			return [
				result,
				nextRuntime,
			] as const;
		});
	});
});
