import { Effect, Option } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { ItemNotOnGridError } from "~/engine/item/error/ItemNotOnGridError";
import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";
import { isItemLocationScopeAllowedFx } from "~/engine/location/read/isItemLocationScopeAllowedFx";
import { isSameGridLocationFx } from "~/engine/location/read/isSameGridLocationFx";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import { assertRevisionFx } from "~/engine/revision/fx/assertRevisionFx";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { ItemInventoryStorageUnavailableError } from "~/engine/runtime/error/ItemInventoryStorageUnavailableError";
import { ItemInventoryTargetInvalidError } from "~/engine/runtime/error/ItemInventoryTargetInvalidError";
import { ItemLocationConflictError } from "~/engine/runtime/error/ItemLocationConflictError";
import { applyStoreItemInInventoryPlanFx } from "~/engine/runtime/fx/applyStoreItemInInventoryPlanFx";
import { readStoreItemInInventoryPlanFx } from "~/engine/runtime/fx/readStoreItemInInventoryPlanFx";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import { isGridRuntimeItemFx } from "~/engine/runtime/read/isGridRuntimeItemFx";
import { readRuntimeItemByIdFx } from "~/engine/runtime/read/readRuntimeItemByIdFx";
import type { GridRuntimeItemSchema } from "~/engine/runtime/schema/GridRuntimeItemSchema";

export namespace storeItemInInventoryFx {
	export interface Props {
		readonly sourceItemId: IdSchema.Type;
		readonly sourceRevision: RevisionSchema.Type;
		readonly sourceLocation: GridLocationSchema.Type;
		readonly inventoryItemId: IdSchema.Type;
		readonly inventoryRevision: RevisionSchema.Type;
		readonly inventoryLocation: GridLocationSchema.Type;
	}

	export interface Result {
		readonly sourceBefore: GridRuntimeItemSchema.Type;
		readonly sourceAfter?: GridRuntimeItemSchema.Type;
		readonly inventoryItem: GridRuntimeItemSchema.Type;
	}
}

/** Atomically stores one whole exact grid item through the live Inventory opener. */
export const storeItemInInventoryFx = Effect.fn("storeItemInInventoryFx")(function* ({
	sourceItemId,
	sourceRevision,
	sourceLocation,
	inventoryItemId,
	inventoryRevision,
	inventoryLocation,
}: storeItemInInventoryFx.Props) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const runtimeSource = yield* readRuntimeItemByIdFx({
				itemId: sourceItemId,
				runtime,
			});
			const runtimeInventory = yield* readRuntimeItemByIdFx({
				itemId: inventoryItemId,
				runtime,
			});
			yield* assertRevisionFx({
				actualRevision: runtimeSource.revision,
				entityId: runtimeSource.id,
				expectedRevision: sourceRevision,
			});
			yield* assertRevisionFx({
				actualRevision: runtimeInventory.revision,
				entityId: runtimeInventory.id,
				expectedRevision: inventoryRevision,
			});
			const source = Option.getOrUndefined(yield* isGridRuntimeItemFx(runtimeSource));
			const inventory = Option.getOrUndefined(yield* isGridRuntimeItemFx(runtimeInventory));
			if (source === undefined) {
				return yield* Effect.fail(
					new ItemNotOnGridError({
						itemId: sourceItemId,
						location: runtimeSource.location,
					}),
				);
			}
			if (
				!(yield* isSameGridLocationFx({
					left: source.location,
					right: sourceLocation,
				}))
			) {
				return yield* Effect.fail(
					new ItemLocationConflictError({
						itemId: sourceItemId,
						expectedLocation: sourceLocation,
						actualLocation: source.location,
					}),
				);
			}
			if (
				inventory === undefined ||
				inventory.item.type !== ItemEnumSchema.enum.Inventory ||
				!(yield* isSameGridLocationFx({
					left: inventory.location,
					right: inventoryLocation,
				}))
			) {
				return yield* Effect.fail(
					new ItemInventoryTargetInvalidError({
						itemId: inventoryItemId,
					}),
				);
			}
			if (
				source.location.scope === LocationScopeEnumSchema.enum.Inventory ||
				!(yield* isItemLocationScopeAllowedFx({
					item: source.item,
					locationScope: LocationScopeEnumSchema.enum.Inventory,
				}))
			) {
				return yield* Effect.fail(
					new ItemInventoryStorageUnavailableError({
						itemId: source.id,
					}),
				);
			}
			const plan = yield* readStoreItemInInventoryPlanFx({
				item: source,
				runtime,
			});
			const stored = yield* applyStoreItemInInventoryPlanFx({
				item: source,
				plan,
				runtime,
			});
			return [
				{
					sourceBefore: source,
					...(stored.current === null
						? {}
						: {
								sourceAfter: stored.current,
							}),
					inventoryItem: inventory,
				} satisfies storeItemInInventoryFx.Result,
				stored.runtime,
			] as const;
		}),
	);
});
