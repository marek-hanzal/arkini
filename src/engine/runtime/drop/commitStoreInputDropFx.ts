import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { storeInputMaterialFx } from "~/engine/input/write/storeInputMaterialFx";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import {
	makeBlockedDropRejectedResult,
	makeDropRejectedResult,
	makeInvalidGridDropRejectedResult,
	makeStaleDropRejectedResult,
} from "~/engine/runtime/drop/makeDropRejectedResult";
import { projectDropTransferActor } from "~/engine/runtime/drop/projectDropTransferActor";
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
	const rejectBlockedFx = () =>
		Effect.succeed(
			makeBlockedDropRejectedResult({
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

		return {
			kind: DropItemResultKindEnumSchema.enum.StoreInput,
			storedQuantity: stored.storedItem.quantity,
			lineId,
			inputIndex,
			source: projectDropTransferActor({
				after: stored.sourceItem,
				before: stored.sourceBefore,
			}),
			owner: {
				itemId: stored.ownerItem.id,
				revision: stored.ownerItem.revision,
				location: stored.ownerItem.location,
			},
		} satisfies commitStoreInputDropFx.Result;
	}).pipe(
		Effect.catchTags({
			ItemNotFoundError: (error) =>
				Effect.succeed(
					makeStaleDropRejectedResult({
						entityId: error.itemId,
						sourceItemId,
						targetItemId,
					}),
				),
			RevisionConflictError: (error) =>
				Effect.succeed(
					makeStaleDropRejectedResult({
						entityId: error.entityId,
						sourceItemId,
						targetItemId,
					}),
				),
			ItemLocationConflictError: (error) =>
				Effect.succeed(
					makeStaleDropRejectedResult({
						entityId: error.itemId,
						sourceItemId,
						targetItemId,
					}),
				),
			ItemNotOnGridError: (error) =>
				Effect.succeed(
					makeInvalidGridDropRejectedResult({
						itemId: error.itemId,
						sourceItemId,
						targetItemId,
					}),
				),
			CrossSpaceBoardOperationError: () =>
				Effect.succeed(
					makeDropRejectedResult({
						reason: DropItemRejectedReasonEnumSchema.enum.InvalidTarget,
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
