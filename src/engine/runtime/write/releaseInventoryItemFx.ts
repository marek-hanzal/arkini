import { Effect, Option } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import { ItemNotOnGridError } from "~/engine/item/error/ItemNotOnGridError";
import { isItemLocationScopeAllowedFn } from "~/engine/location/fn/isItemLocationScopeAllowedFn";
import { isSameGridLocationFn } from "~/engine/location/fn/isSameGridLocationFn";
import type { InventoryLocationSchema } from "~/engine/location/schema/InventoryLocationSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import { PlacementUnavailableError } from "~/engine/placement/error/PlacementUnavailableError";
import { placeRuntimeItemFx } from "~/engine/placement/fx/placeRuntimeItemFx";
import { readBoardLocationsFx } from "~/engine/placement/fx/readBoardLocationsFx";
import { PlacementSchema } from "~/engine/placement/schema/PlacementSchema";
import { assertRevisionFx } from "~/engine/revision/fx/assertRevisionFx";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { ItemLocationConflictError } from "~/engine/runtime/error/ItemLocationConflictError";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import { isGridRuntimeItemFx } from "~/engine/runtime/read/isGridRuntimeItemFx";
import { readRuntimeItemByIdFx } from "~/engine/runtime/read/readRuntimeItemByIdFx";
import { readRuntimeInventoryOpenerFx } from "~/engine/runtime/read/readRuntimeInventoryOpenerFx";

export namespace releaseInventoryItemFx {
	export interface Props {
		readonly itemId: IdSchema.Type;
		readonly revision: RevisionSchema.Type;
		readonly location: InventoryLocationSchema.Type;
	}
}

/** Places one whole exact Inventory tile from the first available Board seed. */
export const releaseInventoryItemFx = Effect.fn("releaseInventoryItemFx")(function* ({
	itemId,
	revision,
	location,
}: releaseInventoryItemFx.Props) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const runtimeItem = yield* readRuntimeItemByIdFx({
				itemId,
				runtime,
			});
			yield* assertRevisionFx({
				actualRevision: runtimeItem.revision,
				entityId: runtimeItem.id,
				expectedRevision: revision,
			});
			const item = Option.getOrUndefined(yield* isGridRuntimeItemFx(runtimeItem));
			if (item === undefined) {
				return yield* Effect.fail(
					new ItemNotOnGridError({
						itemId,
						location: runtimeItem.location,
					}),
				);
			}
			if (
				item.location.scope !== LocationScopeEnumSchema.enum.Inventory ||
				!isSameGridLocationFn({
					left: item.location,
					right: location,
				})
			) {
				return yield* Effect.fail(
					new ItemLocationConflictError({
						itemId,
						expectedLocation: location,
						actualLocation: item.location,
					}),
				);
			}
			const inventoryOpener = yield* readRuntimeInventoryOpenerFx({
				itemId,
				runtime,
			});
			const canOwnBoardLocation = isItemLocationScopeAllowedFn({
				item: item.item,
				locationScope: LocationScopeEnumSchema.enum.Board,
			});
			const config = yield* GameConfigFx;
			const boardLocations = yield* readBoardLocationsFx({
				size: config.meta.board,
				space: runtime.currentSpace,
			});
			const [origin] = boardLocations;
			if (!canOwnBoardLocation || origin === undefined) {
				return yield* Effect.fail(
					new PlacementUnavailableError({
						itemId: item.item.id,
						placement: PlacementSchema.enum.Drop,
						quantity: item.quantity,
						reason: PlacementUnavailableError.Reason.BoardFull,
						remainingQuantity: item.quantity,
					}),
				);
			}
			const placed = yield* placeRuntimeItemFx({
				itemId,
				origin,
				originItemId: inventoryOpener.id,
				runtime,
			});
			if (
				placed.events.some(
					(event) =>
						!("location" in event) ||
						event.location.scope !== LocationScopeEnumSchema.enum.Board,
				)
			) {
				return yield* Effect.fail(
					new PlacementUnavailableError({
						itemId: item.item.id,
						placement: PlacementSchema.enum.Drop,
						quantity: item.quantity,
						reason: PlacementUnavailableError.Reason.BoardFull,
						remainingQuantity: item.quantity,
					}),
				);
			}
			return [
				placed,
				placed.runtime,
				placed.events,
			] as const;
		}),
	);
});
