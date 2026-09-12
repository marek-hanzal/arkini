import { Effect } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import { storeInputMaterialFx } from "~/production-input/fx/storeInputMaterialFx";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import type { RevisionSchema } from "~/item-revision/schema/RevisionSchema";
import { makeDropActorRejectedResultFn } from "~/item-interaction/fn/makeDropActorRejectedResultFn";
import { makeDropRejectedResultFn } from "~/item-interaction/fn/makeDropRejectedResultFn";
import { projectDropTransferActorFn } from "~/item-interaction/fn/projectDropTransferActorFn";
import { DropItemRejectedReason } from "~/item-interaction/type/DropItemResult";
import type { DropItemResult } from "~/item-interaction/type/DropItemResult";
import { DropItemResultKind } from "~/item-interaction/type/DropItemResult";

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
	const rejectBlockedFx = () =>
		Effect.succeed(
			makeDropRejectedResultFn({
				reason: DropItemRejectedReason.Blocked,
				sourceItemId,
				targetItemId,
			}),
		);
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
		const source = projectDropTransferActorFn({
			after: stored.sourceItem,
			before: stored.sourceBefore,
		});

		return {
			kind: DropItemResultKind.StoreInput,
			storedQuantity: stored.storedItem.quantity,
			lineId,
			inputIndex,
			source,
			owner: {
				itemId: stored.ownerItem.id,
				revision: stored.ownerItem.revision,
				location: stored.ownerItem.location,
			},
		} satisfies DropItemResult;
	}).pipe(
		Effect.catchTags({
			ItemNotFoundError: (error) =>
				Effect.succeed(
					makeDropActorRejectedResultFn({
						failedItemId: error.itemId,
						failure: "stale",
						sourceItemId,
						targetItemId,
					}),
				),
			RevisionConflictError: (error) =>
				Effect.succeed(
					makeDropActorRejectedResultFn({
						failedItemId: error.entityId,
						failure: "stale",
						sourceItemId,
						targetItemId,
					}),
				),
			ItemLocationConflictError: (error) =>
				Effect.succeed(
					makeDropActorRejectedResultFn({
						failedItemId: error.itemId,
						failure: "stale",
						sourceItemId,
						targetItemId,
					}),
				),
			ItemNotOnGridError: (error) =>
				Effect.succeed(
					makeDropActorRejectedResultFn({
						failedItemId: error.itemId,
						failure: "invalid-location",
						sourceItemId,
						targetItemId,
					}),
				),
			CrossSpaceBoardOperationError: () =>
				Effect.succeed(
					makeDropRejectedResultFn({
						reason: DropItemRejectedReason.InvalidTarget,
						sourceItemId,
						targetItemId,
					}),
				),
		}),
		Effect.catchTags({
			ItemStatefulError: rejectBlockedFx,
			PlacementUnavailableError: rejectBlockedFx,
			InputMaterialUnavailableError: rejectBlockedFx,
			LineInputClosedError: rejectBlockedFx,
		}),
	);
});
