import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
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
				source: {
					itemId: result.sourceBefore.id,
					canonicalItemId: result.sourceBefore.item.id,
					previousRevision: result.sourceBefore.revision,
					previousLocation: result.sourceBefore.location,
					previousQuantity: result.sourceBefore.quantity,
					current:
						result.sourceAfter === undefined
							? null
							: {
									itemId: result.sourceAfter.id,
									canonicalItemId: result.sourceAfter.item.id,
									revision: result.sourceAfter.revision,
									location: result.sourceAfter.location,
									quantity: result.sourceAfter.quantity,
								},
				},
				inventory: {
					itemId: result.inventoryItem.id,
					revision: result.inventoryItem.revision,
					location: result.inventoryItem.location,
				},
			}),
		),
		Effect.catchTags({
			ItemNotFoundError: (error) =>
				Effect.succeed({
					kind: DropItemResultKindEnumSchema.enum.Reject,
					reason:
						error.itemId === props.inventoryItemId
							? DropItemRejectedReasonEnumSchema.enum.StaleTarget
							: DropItemRejectedReasonEnumSchema.enum.StaleSource,
					itemId: props.sourceItemId,
					targetItemId: props.inventoryItemId,
				} satisfies DropItemResultSchema.Type),
			RevisionConflictError: (error) =>
				Effect.succeed({
					kind: DropItemResultKindEnumSchema.enum.Reject,
					reason:
						error.entityId === props.inventoryItemId
							? DropItemRejectedReasonEnumSchema.enum.StaleTarget
							: DropItemRejectedReasonEnumSchema.enum.StaleSource,
					itemId: props.sourceItemId,
					targetItemId: props.inventoryItemId,
				} satisfies DropItemResultSchema.Type),
			ItemLocationConflictError: () =>
				Effect.succeed({
					kind: DropItemResultKindEnumSchema.enum.Reject,
					reason: DropItemRejectedReasonEnumSchema.enum.StaleSource,
					itemId: props.sourceItemId,
					targetItemId: props.inventoryItemId,
				} satisfies DropItemResultSchema.Type),
			ItemNotOnGridError: () =>
				Effect.succeed({
					kind: DropItemResultKindEnumSchema.enum.Reject,
					reason: DropItemRejectedReasonEnumSchema.enum.InvalidSource,
					itemId: props.sourceItemId,
					targetItemId: props.inventoryItemId,
				} satisfies DropItemResultSchema.Type),
			ItemInventoryStorageUnavailableError: () =>
				Effect.succeed({
					kind: DropItemResultKindEnumSchema.enum.Reject,
					reason: DropItemRejectedReasonEnumSchema.enum.InvalidTarget,
					itemId: props.sourceItemId,
					targetItemId: props.inventoryItemId,
				} satisfies DropItemResultSchema.Type),
			ItemInventoryTargetInvalidError: () =>
				Effect.succeed({
					kind: DropItemResultKindEnumSchema.enum.Reject,
					reason: DropItemRejectedReasonEnumSchema.enum.InvalidTarget,
					itemId: props.sourceItemId,
					targetItemId: props.inventoryItemId,
				} satisfies DropItemResultSchema.Type),
			ItemStatefulError: () =>
				Effect.succeed({
					kind: DropItemResultKindEnumSchema.enum.Reject,
					reason: DropItemRejectedReasonEnumSchema.enum.Blocked,
					itemId: props.sourceItemId,
					targetItemId: props.inventoryItemId,
				} satisfies DropItemResultSchema.Type),
			PlacementUnavailableError: () =>
				Effect.succeed({
					kind: DropItemResultKindEnumSchema.enum.Reject,
					reason: DropItemRejectedReasonEnumSchema.enum.Blocked,
					itemId: props.sourceItemId,
					targetItemId: props.inventoryItemId,
				} satisfies DropItemResultSchema.Type),
		}),
	);
});
