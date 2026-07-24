import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { storeInputMaterialFx } from "~/engine/input/write/storeInputMaterialFx";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { DropItemRejectedReasonEnumSchema } from "~/engine/runtime/schema/command/DropItemRejectedReasonEnumSchema";
import type { DropItemResultSchema } from "~/engine/runtime/schema/command/DropItemResultSchema";
import { DropItemResultKindEnumSchema } from "~/engine/runtime/schema/command/DropItemResultKindEnumSchema";

export namespace commitStoreInputDropFx {
	export interface Props {
		readonly sourceItemId: IdSchema.Type;
		readonly sourceRevision: RevisionSchema.Type;
		readonly sourceLocation: GridLocationSchema.Type;
		readonly targetItemId: IdSchema.Type;
		readonly targetRevision: RevisionSchema.Type;
		readonly targetLocation: GridLocationSchema.Type;
		readonly lineId: IdSchema.Type;
		readonly inputIndex: number;
		readonly quantity: number;
	}

	export type Result = DropItemResultSchema.Type;
}

/** Commits one exact default-line input store and normalizes both actor identities. */
export const commitStoreInputDropFx = Effect.fn("commitStoreInputDropFx")(function* ({
	sourceItemId,
	sourceRevision,
	sourceLocation,
	targetItemId,
	targetRevision,
	targetLocation,
	lineId,
	inputIndex,
	quantity,
}: commitStoreInputDropFx.Props) {
	return yield* Effect.gen(function* () {
		const stored = yield* storeInputMaterialFx({
			ownerItemId: targetItemId,
			ownerItemRevision: targetRevision,
			expectedOwnerLocation: targetLocation,
			lineId,
			inputIndex,
			sourceItemId,
			sourceItemRevision: sourceRevision,
			expectedSourceLocation: sourceLocation,
			quantity,
		});

		return {
			kind: DropItemResultKindEnumSchema.enum.StoreInput,
			storedQuantity: stored.storedItem.quantity,
			lineId,
			inputIndex,
			source: {
				itemId: stored.sourceBefore.id,
				canonicalItemId: stored.sourceBefore.item.id,
				previousRevision: stored.sourceBefore.revision,
				previousLocation: stored.sourceBefore.location,
				previousQuantity: stored.sourceBefore.quantity,
				current:
					stored.sourceItem === undefined
						? null
						: {
								itemId: stored.sourceItem.id,
								canonicalItemId: stored.sourceItem.item.id,
								revision: stored.sourceItem.revision,
								location: stored.sourceItem.location,
								quantity: stored.sourceItem.quantity,
							},
			},
			owner: {
				itemId: stored.ownerItem.id,
				revision: stored.ownerItem.revision,
				location: stored.ownerItem.location,
			},
		} satisfies commitStoreInputDropFx.Result;
	}).pipe(
		Effect.catchTags({
			ItemNotFoundError: (error) =>
				Effect.succeed({
					kind: DropItemResultKindEnumSchema.enum.Reject,
					reason:
						error.itemId === targetItemId
							? DropItemRejectedReasonEnumSchema.enum.StaleTarget
							: DropItemRejectedReasonEnumSchema.enum.StaleSource,
					itemId: sourceItemId,
					targetItemId,
				}),
			RevisionConflictError: (error) =>
				Effect.succeed({
					kind: DropItemResultKindEnumSchema.enum.Reject,
					reason:
						error.entityId === targetItemId
							? DropItemRejectedReasonEnumSchema.enum.StaleTarget
							: DropItemRejectedReasonEnumSchema.enum.StaleSource,
					itemId: sourceItemId,
					targetItemId,
				}),
			ItemLocationConflictError: (error) =>
				Effect.succeed({
					kind: DropItemResultKindEnumSchema.enum.Reject,
					reason:
						error.itemId === targetItemId
							? DropItemRejectedReasonEnumSchema.enum.StaleTarget
							: DropItemRejectedReasonEnumSchema.enum.StaleSource,
					itemId: sourceItemId,
					targetItemId,
				}),
			ItemNotOnGridError: (error) =>
				Effect.succeed({
					kind: DropItemResultKindEnumSchema.enum.Reject,
					reason:
						error.itemId === targetItemId
							? DropItemRejectedReasonEnumSchema.enum.InvalidTarget
							: DropItemRejectedReasonEnumSchema.enum.InvalidSource,
					itemId: sourceItemId,
					targetItemId,
				}),
			CrossSpaceBoardOperationError: () =>
				Effect.succeed({
					kind: DropItemResultKindEnumSchema.enum.Reject,
					reason: DropItemRejectedReasonEnumSchema.enum.InvalidTarget,
					itemId: sourceItemId,
					targetItemId,
				}),
		}),
		Effect.catchTags({
			ItemStatefulError: () =>
				Effect.succeed({
					kind: DropItemResultKindEnumSchema.enum.Reject,
					reason: DropItemRejectedReasonEnumSchema.enum.Blocked,
					itemId: sourceItemId,
					targetItemId,
				}),
			PlacementUnavailableError: () =>
				Effect.succeed({
					kind: DropItemResultKindEnumSchema.enum.Reject,
					reason: DropItemRejectedReasonEnumSchema.enum.Blocked,
					itemId: sourceItemId,
					targetItemId,
				}),
			InputMaterialUnavailableError: () =>
				Effect.succeed({
					kind: DropItemResultKindEnumSchema.enum.Reject,
					reason: DropItemRejectedReasonEnumSchema.enum.Blocked,
					itemId: sourceItemId,
					targetItemId,
				}),
			LineInputClosedError: () =>
				Effect.succeed({
					kind: DropItemResultKindEnumSchema.enum.Reject,
					reason: DropItemRejectedReasonEnumSchema.enum.Blocked,
					itemId: sourceItemId,
					targetItemId,
				}),
		}),
	);
});
