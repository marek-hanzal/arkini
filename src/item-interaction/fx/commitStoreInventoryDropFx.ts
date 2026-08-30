import { Data, Effect, Option } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import { ItemNotOnGridError } from "~/item-location/error/ItemNotOnGridError";
import { assertRevisionFx } from "~/item-revision/fx/assertRevisionFx";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import type { RevisionSchema } from "~/item-revision/schema/RevisionSchema";
import { ItemLocationConflictError } from "~/game-runtime/error/ItemLocationConflictError";
import { reviseRuntimeItemFx } from "~/game-runtime/fx/reviseRuntimeItemFx";
import { modifyRuntimeFx } from "~/game-runtime/internal/modifyRuntimeFx";
import { isGridRuntimeItemFn } from "~/game-runtime/read/fn/isGridRuntimeItemFn";
import { readRuntimeItemByIdFx } from "~/game-runtime/read/readRuntimeItemByIdFx";
import type { GridRuntimeItemSchema } from "~/game-runtime/schema/GridRuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { TypeSchema } from "~/item-definition/schema/TypeSchema";
import { isItemLocationScopeAllowedFn } from "~/item-location/fn/isItemLocationScopeAllowedFn";
import { isSameGridLocationFn } from "~/item-location/fn/isSameGridLocationFn";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { DropItemRejectedReason } from "~/item-interaction/type/DropItemResult";
import type { DropItemResult } from "~/item-interaction/type/DropItemResult";
import { DropItemResultKind } from "~/item-interaction/type/DropItemResult";
import { makeDropRejectedResultFn } from "~/item-interaction/fn/makeDropRejectedResultFn";
import { projectDropTransferActorFn } from "~/item-interaction/fn/projectDropTransferActorFn";
import type { InventoryStoragePlan } from "~/item-interaction/fx/planInventoryStorageFx";
import { planInventoryStorageFx } from "~/item-interaction/fx/planInventoryStorageFx";
import { applyPlacementPlanFx } from "~/item-placement/fx/applyPlacementPlanFx";

/** One canonical item cannot own a passive Inventory location. */
class ItemInventoryStorageUnavailableError extends Data.TaggedError(
	"ItemInventoryStorageUnavailableError",
)<{
	readonly itemId: IdSchema.Type;
}> {}

/** A requested inventory-storage target is not the live Inventory opener. */
class ItemInventoryTargetInvalidError extends Data.TaggedError("ItemInventoryTargetInvalidError")<{
	readonly itemId: IdSchema.Type;
}> {}

interface StoreItemInInventoryResult {
	readonly sourceBefore: GridRuntimeItemSchema.Type;
	readonly sourceAfter?: GridRuntimeItemSchema.Type;
	readonly inventoryItem: GridRuntimeItemSchema.Type;
}

const applyInventoryStoragePlanFx = Effect.fn("applyInventoryStoragePlanFx")(function* ({
	item,
	plan,
	runtime,
}: {
	readonly item: GridRuntimeItemSchema.Type;
	readonly plan: InventoryStoragePlan;
	readonly runtime: RuntimeSchema.Type;
}) {
	if (plan.kind === "pure") {
		const [, nextRuntime] = yield* applyPlacementPlanFx({
			plan: plan.plan,
			runtime: plan.detachedRuntime,
		});
		return {
			current: null,
			runtime: nextRuntime,
		} as const;
	}
	const revisedItem = yield* reviseRuntimeItemFx({
		item: {
			...item,
			location: plan.location,
		} satisfies GridRuntimeItemSchema.Type,
	});
	return {
		current: revisedItem,
		runtime: {
			...runtime,
			items: runtime.items.map((candidate) =>
				candidate.id === item.id ? revisedItem : candidate,
			),
		} satisfies RuntimeSchema.Type,
	} as const;
});

const storeItemInInventoryFx = Effect.fn("storeItemInInventoryFx")(function* (
	props: commitStoreInventoryDropFx.Props,
) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const runtimeSource = yield* readRuntimeItemByIdFx({
				itemId: props.sourceItemId,
				runtime,
			});
			const runtimeInventory = yield* readRuntimeItemByIdFx({
				itemId: props.inventoryItemId,
				runtime,
			});
			yield* assertRevisionFx({
				actualRevision: runtimeSource.revision,
				entityId: runtimeSource.id,
				expectedRevision: props.sourceRevision,
			});
			yield* assertRevisionFx({
				actualRevision: runtimeInventory.revision,
				entityId: runtimeInventory.id,
				expectedRevision: props.inventoryRevision,
			});
			const source = Option.getOrUndefined(isGridRuntimeItemFn(runtimeSource));
			const inventory = Option.getOrUndefined(isGridRuntimeItemFn(runtimeInventory));
			if (source === undefined) {
				return yield* Effect.fail(
					new ItemNotOnGridError({
						itemId: props.sourceItemId,
						location: runtimeSource.location,
					}),
				);
			}
			if (
				!isSameGridLocationFn({
					left: source.location,
					right: props.sourceLocation,
				})
			) {
				return yield* Effect.fail(
					new ItemLocationConflictError({
						itemId: props.sourceItemId,
						expectedLocation: props.sourceLocation,
						actualLocation: source.location,
					}),
				);
			}
			if (
				inventory === undefined ||
				inventory.item.type !== TypeSchema.enum.Inventory ||
				!isSameGridLocationFn({
					left: inventory.location,
					right: props.inventoryLocation,
				})
			) {
				return yield* Effect.fail(
					new ItemInventoryTargetInvalidError({
						itemId: props.inventoryItemId,
					}),
				);
			}
			if (
				source.location.scope === LocationScopeEnumSchema.enum.Inventory ||
				!isItemLocationScopeAllowedFn({
					item: source.item,
					locationScope: LocationScopeEnumSchema.enum.Inventory,
				})
			) {
				return yield* Effect.fail(
					new ItemInventoryStorageUnavailableError({
						itemId: source.id,
					}),
				);
			}
			const plan = yield* planInventoryStorageFx({
				item: source,
				runtime,
			});
			const stored = yield* applyInventoryStoragePlanFx({
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
				} satisfies StoreItemInInventoryResult,
				stored.runtime,
			] as const;
		}),
	);
});

export namespace commitStoreInventoryDropFx {
	export interface Props {
		readonly sourceItemId: IdSchema.Type;
		readonly sourceRevision: RevisionSchema.Type;
		readonly sourceLocation: GridLocationSchema.Type;
		readonly inventoryItemId: IdSchema.Type;
		readonly inventoryRevision: RevisionSchema.Type;
		readonly inventoryLocation: GridLocationSchema.Type;
	}
}

/** Commits one exact whole-item transfer through the Inventory opener. */
export const commitStoreInventoryDropFx = Effect.fn("commitStoreInventoryDropFx")(function* (
	props: commitStoreInventoryDropFx.Props,
) {
	return yield* storeItemInInventoryFx(props).pipe(
		Effect.map((result): DropItemResult => {
			const source = projectDropTransferActorFn({
				after: result.sourceAfter,
				before: result.sourceBefore,
			});
			return {
				kind: DropItemResultKind.StoreInventory,
				source,
				inventory: {
					itemId: result.inventoryItem.id,
					revision: result.inventoryItem.revision,
					location: result.inventoryItem.location,
				},
			};
		}),
		Effect.catchTags({
			ItemNotFoundError: (error) =>
				Effect.succeed(
					makeDropRejectedResultFn({
						reason:
							error.itemId === props.inventoryItemId
								? DropItemRejectedReason.StaleTarget
								: DropItemRejectedReason.StaleSource,
						sourceItemId: props.sourceItemId,
						targetItemId: props.inventoryItemId,
					}),
				),
			RevisionConflictError: (error) =>
				Effect.succeed(
					makeDropRejectedResultFn({
						reason:
							error.entityId === props.inventoryItemId
								? DropItemRejectedReason.StaleTarget
								: DropItemRejectedReason.StaleSource,
						sourceItemId: props.sourceItemId,
						targetItemId: props.inventoryItemId,
					}),
				),
			ItemLocationConflictError: () =>
				Effect.succeed(
					makeDropRejectedResultFn({
						reason: DropItemRejectedReason.StaleSource,
						sourceItemId: props.sourceItemId,
						targetItemId: props.inventoryItemId,
					}),
				),
			ItemNotOnGridError: () =>
				Effect.succeed(
					makeDropRejectedResultFn({
						reason: DropItemRejectedReason.InvalidSource,
						sourceItemId: props.sourceItemId,
						targetItemId: props.inventoryItemId,
					}),
				),
			ItemInventoryStorageUnavailableError: () =>
				Effect.succeed(
					makeDropRejectedResultFn({
						reason: DropItemRejectedReason.InvalidTarget,
						sourceItemId: props.sourceItemId,
						targetItemId: props.inventoryItemId,
					}),
				),
			ItemInventoryTargetInvalidError: () =>
				Effect.succeed(
					makeDropRejectedResultFn({
						reason: DropItemRejectedReason.InvalidTarget,
						sourceItemId: props.sourceItemId,
						targetItemId: props.inventoryItemId,
					}),
				),
			ItemStatefulError: () =>
				Effect.succeed(
					makeDropRejectedResultFn({
						reason: DropItemRejectedReason.Blocked,
						sourceItemId: props.sourceItemId,
						targetItemId: props.inventoryItemId,
					}),
				),
			PlacementUnavailableError: () =>
				Effect.succeed(
					makeDropRejectedResultFn({
						reason: DropItemRejectedReason.Blocked,
						sourceItemId: props.sourceItemId,
						targetItemId: props.inventoryItemId,
					}),
				),
		}),
	);
});
