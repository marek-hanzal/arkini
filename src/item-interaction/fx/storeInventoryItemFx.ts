import { Data, Effect, Option } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import { ItemNotOnGridError } from "~/item-location/error/ItemNotOnGridError";
import { assertRevisionFx } from "~/item-revision/fx/assertRevisionFx";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import type { RevisionSchema } from "~/item-revision/schema/RevisionSchema";
import { ItemLocationConflictError } from "~/item-location/error/ItemLocationConflictError";
import { reviseRuntimeItemFx } from "~/game-runtime/fx/reviseRuntimeItemFx";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";
import { narrowGridRuntimeItemFn } from "~/game-runtime/fn/narrowGridRuntimeItemFn";
import { readRuntimeItemByIdFx } from "~/game-runtime/fx/readRuntimeItemByIdFx";
import type { GridRuntimeItemSchema } from "~/game-runtime/schema/GridRuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
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

interface StoreItemInInventoryResult {
	readonly sourceBefore: GridRuntimeItemSchema.Type;
	readonly sourceAfter?: GridRuntimeItemSchema.Type;
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
	props: storeInventoryItemFx.Props,
) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const runtimeSource = yield* readRuntimeItemByIdFx({
				itemId: props.sourceItemId,
				runtime,
			});
			yield* assertRevisionFx({
				actualRevision: runtimeSource.revision,
				entityId: runtimeSource.id,
				expectedRevision: props.sourceRevision,
			});
			const source = Option.getOrUndefined(narrowGridRuntimeItemFn(runtimeSource));
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
				source.location.scope === LocationScopeEnumSchema.enum.Inventory ||
				(source.location.scope === "board" &&
					source.location.space !== runtime.currentSpace) ||
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
				} satisfies StoreItemInInventoryResult,
				stored.runtime,
			] as const;
		}),
	);
});

export namespace storeInventoryItemFx {
	export interface Props {
		readonly sourceItemId: IdSchema.Type;
		readonly sourceRevision: RevisionSchema.Type;
		readonly sourceLocation: GridLocationSchema.Type;
	}
}

/** Stores one exact whole tile through canonical Inventory placement, without a target item. */
export const storeInventoryItemFx = Effect.fn("storeInventoryItemFx")(function* (
	props: storeInventoryItemFx.Props,
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
			};
		}),
		Effect.catchTags({
			ItemNotFoundError: () =>
				Effect.succeed(
					makeDropRejectedResultFn({
						reason: DropItemRejectedReason.StaleSource,
						sourceItemId: props.sourceItemId,
					}),
				),
			RevisionConflictError: () =>
				Effect.succeed(
					makeDropRejectedResultFn({
						reason: DropItemRejectedReason.StaleSource,
						sourceItemId: props.sourceItemId,
					}),
				),
			ItemLocationConflictError: () =>
				Effect.succeed(
					makeDropRejectedResultFn({
						reason: DropItemRejectedReason.StaleSource,
						sourceItemId: props.sourceItemId,
					}),
				),
			ItemNotOnGridError: () =>
				Effect.succeed(
					makeDropRejectedResultFn({
						reason: DropItemRejectedReason.InvalidSource,
						sourceItemId: props.sourceItemId,
					}),
				),
			ItemInventoryStorageUnavailableError: () =>
				Effect.succeed(
					makeDropRejectedResultFn({
						reason: DropItemRejectedReason.InvalidTarget,
						sourceItemId: props.sourceItemId,
					}),
				),
			ItemStatefulError: () =>
				Effect.succeed(
					makeDropRejectedResultFn({
						reason: DropItemRejectedReason.Blocked,
						sourceItemId: props.sourceItemId,
					}),
				),
			PlacementUnavailableError: () =>
				Effect.succeed(
					makeDropRejectedResultFn({
						reason: DropItemRejectedReason.Blocked,
						sourceItemId: props.sourceItemId,
					}),
				),
		}),
	);
});
