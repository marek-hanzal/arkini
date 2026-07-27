import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { makeDropRejectedResult } from "~/engine/runtime/drop/makeDropRejectedResult";
import { projectDropTransferActor } from "~/engine/runtime/drop/projectDropTransferActor";
import { DropItemRejectedReasonEnumSchema } from "~/engine/runtime/schema/command/DropItemRejectedReasonEnumSchema";
import type { DropItemResultSchema } from "~/engine/runtime/schema/command/DropItemResultSchema";
import { DropItemResultKindEnumSchema } from "~/engine/runtime/schema/command/DropItemResultKindEnumSchema";
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
		Effect.map(
			(result): DropItemResultSchema.Type => ({
				kind: DropItemResultKindEnumSchema.enum.StoreInventory,
				source: projectDropTransferActor({
					after: result.sourceAfter,
					before: result.sourceBefore,
				}),
				inventory: {
					itemId: result.inventoryItem.id,
					revision: result.inventoryItem.revision,
					location: result.inventoryItem.location,
				},
			}),
		),
		Effect.catchTags({
			ItemNotFoundError: (error) =>
				Effect.succeed(
					makeDropRejectedResult({
						reason:
							error.itemId === props.inventoryItemId
								? DropItemRejectedReasonEnumSchema.enum.StaleTarget
								: DropItemRejectedReasonEnumSchema.enum.StaleSource,
						sourceItemId: props.sourceItemId,
						targetItemId: props.inventoryItemId,
					}),
				),
			RevisionConflictError: (error) =>
				Effect.succeed(
					makeDropRejectedResult({
						reason:
							error.entityId === props.inventoryItemId
								? DropItemRejectedReasonEnumSchema.enum.StaleTarget
								: DropItemRejectedReasonEnumSchema.enum.StaleSource,
						sourceItemId: props.sourceItemId,
						targetItemId: props.inventoryItemId,
					}),
				),
			ItemLocationConflictError: () =>
				Effect.succeed(
					makeDropRejectedResult({
						reason: DropItemRejectedReasonEnumSchema.enum.StaleSource,
						sourceItemId: props.sourceItemId,
						targetItemId: props.inventoryItemId,
					}),
				),
			ItemNotOnGridError: () =>
				Effect.succeed(
					makeDropRejectedResult({
						reason: DropItemRejectedReasonEnumSchema.enum.InvalidSource,
						sourceItemId: props.sourceItemId,
						targetItemId: props.inventoryItemId,
					}),
				),
			ItemInventoryStorageUnavailableError: () =>
				Effect.succeed(
					makeDropRejectedResult({
						reason: DropItemRejectedReasonEnumSchema.enum.InvalidTarget,
						sourceItemId: props.sourceItemId,
						targetItemId: props.inventoryItemId,
					}),
				),
			ItemInventoryTargetInvalidError: () =>
				Effect.succeed(
					makeDropRejectedResult({
						reason: DropItemRejectedReasonEnumSchema.enum.InvalidTarget,
						sourceItemId: props.sourceItemId,
						targetItemId: props.inventoryItemId,
					}),
				),
			ItemStatefulError: () =>
				Effect.succeed(
					makeDropRejectedResult({
						reason: DropItemRejectedReasonEnumSchema.enum.Blocked,
						sourceItemId: props.sourceItemId,
						targetItemId: props.inventoryItemId,
					}),
				),
			PlacementUnavailableError: () =>
				Effect.succeed(
					makeDropRejectedResult({
						reason: DropItemRejectedReasonEnumSchema.enum.Blocked,
						sourceItemId: props.sourceItemId,
						targetItemId: props.inventoryItemId,
					}),
				),
		}),
	);
});
