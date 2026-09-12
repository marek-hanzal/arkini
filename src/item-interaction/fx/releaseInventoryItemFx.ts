import { Effect, Option } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import { GameConfigFx } from "~/game-config/context/GameConfigFx";
import { ItemNotOnGridError } from "~/item-location/error/ItemNotOnGridError";
import { isSameGridLocationFn } from "~/item-location/fn/isSameGridLocationFn";
import type { InventoryLocationSchema } from "~/item-location/schema/InventoryLocationSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { PlacementUnavailableError } from "~/item-placement/error/PlacementUnavailableError";
import { reviseRuntimeItemFx } from "~/game-runtime/fx/reviseRuntimeItemFx";
import { readEmptyLocationsFn } from "~/item-placement/fn/readEmptyLocationsFn";
import { readToolbarLocationsFn } from "~/item-placement/fn/readToolbarLocationsFn";
import { isItemLocationScopeAllowedFn } from "~/item-location/fn/isItemLocationScopeAllowedFn";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { readBoardLocationsFn } from "~/item-placement/fn/readBoardLocationsFn";
import { PlacementSchema } from "~/item-placement/schema/PlacementSchema";
import { assertRevisionFx } from "~/item-revision/fx/assertRevisionFx";
import type { RevisionSchema } from "~/item-revision/schema/RevisionSchema";
import { ItemLocationConflictError } from "~/item-location/error/ItemLocationConflictError";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";
import { narrowGridRuntimeItemFn } from "~/game-runtime/fn/narrowGridRuntimeItemFn";
import { readRuntimeItemByIdFx } from "~/game-runtime/fx/readRuntimeItemByIdFx";

export namespace releaseInventoryItemFx {
	export interface Props {
		readonly itemId: IdSchema.Type;
		readonly revision: RevisionSchema.Type;
		readonly location: InventoryLocationSchema.Type;
	}
}

/** Releases one whole exact Inventory tile to its permitted Board or Toolbar scope. */
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
			const item = Option.getOrUndefined(narrowGridRuntimeItemFn(runtimeItem));
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
			const config = yield* GameConfigFx;
			const target = readEmptyLocationsFn({
				locations: [
					...readBoardLocationsFn({
						size: config.meta.board,
						space: runtime.currentSpace,
					}),
					...readToolbarLocationsFn({
						size: config.meta.toolbarSize ?? 0,
					}),
				].filter((candidate) =>
					isItemLocationScopeAllowedFn({
						item: item.item,
						locationScope: candidate.scope,
					}),
				),
				runtime,
			})[0];
			if (target === undefined) {
				return yield* Effect.fail(
					new PlacementUnavailableError({
						itemId: item.item.id,
						placement: PlacementSchema.enum.Drop,
						quantity: item.quantity,
						reason:
							item.item.scope === "toolbar"
								? PlacementUnavailableError.Reason.ToolbarFull
								: PlacementUnavailableError.Reason.BoardFull,
						remainingQuantity: item.quantity,
					}),
				);
			}
			const released = yield* reviseRuntimeItemFx({
				item: {
					...item,
					location: target,
				},
			});
			const nextRuntime = {
				...runtime,
				items: runtime.items.map((candidate) =>
					candidate.id === itemId ? released : candidate,
				),
			};
			const events: GameEventSchema.Type[] = [];
			return [
				{
					runtime: nextRuntime,
					events,
				},
				nextRuntime,
				events,
			] as const;
		}),
	);
});
