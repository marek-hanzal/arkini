import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { makeDropRejectedResultFn } from "~/engine/runtime/drop/fn/makeDropRejectedResultFn";
import { projectDropTransferActorFn } from "~/engine/runtime/drop/fn/projectDropTransferActorFn";
import { DropItemRejectedReason } from "~/engine/runtime/DropItemResult";
import type { DropItemResult } from "~/engine/runtime/DropItemResult";
import { DropItemResultKind } from "~/engine/runtime/DropItemResult";
import { storeItemInInventoryFx } from "~/engine/runtime/write/storeItemInInventoryFx";

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
