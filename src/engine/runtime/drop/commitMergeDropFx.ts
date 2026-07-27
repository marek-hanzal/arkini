import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { commitMergeItemsFx } from "~/engine/merge/internal/commitMergeItemsFx";
import {
	makeDropRejectedResult,
	makeBlockedDropRejectedResult,
	makeStaleDropRejectedResult,
} from "~/engine/runtime/drop/makeDropRejectedResult";
import {
	projectDropActorCurrent,
	projectDropTransferActor,
} from "~/engine/runtime/drop/projectDropTransferActor";
import { DropItemRejectedReasonEnumSchema } from "~/engine/runtime/schema/command/DropItemRejectedReasonEnumSchema";
import type { DropItemResultSchema } from "~/engine/runtime/schema/command/DropItemResultSchema";
import { DropItemResultKindEnumSchema } from "~/engine/runtime/schema/command/DropItemResultKindEnumSchema";

export namespace commitMergeDropFx {
	export interface Props {
		readonly sourceItemId: IdSchema.Type;
		readonly sourceRevision: RevisionSchema.Type;
		readonly targetItemId: IdSchema.Type;
		readonly targetRevision: RevisionSchema.Type;
	}

	export type Result = DropItemResultSchema.Type;
}

/** Commits one exact authored merge and normalizes both actor identities. */
export const commitMergeDropFx = Effect.fn("commitMergeDropFx")(function* ({
	sourceItemId,
	sourceRevision,
	targetItemId,
	targetRevision,
}: commitMergeDropFx.Props) {
	const rejectBlockedFx = () =>
		Effect.succeed(
			makeBlockedDropRejectedResult({
				sourceItemId,
				targetItemId,
			}),
		);
	return yield* commitMergeItemsFx({
		sourceItemId,
		sourceRevision,
		targetItemId,
		targetRevision,
	}).pipe(
		Effect.map(
			(result): commitMergeDropFx.Result => ({
				kind: DropItemResultKindEnumSchema.enum.Merge,
				action: result.event.action,
				effect: result.event.effect,
				resultCanonicalItemId: result.event.resultCanonicalItemId,
				source: {
					itemId: result.sourceBefore.id,
					previousRevision: result.sourceBefore.revision,
					previousLocation: result.sourceBefore.location,
					previousQuantity: result.sourceBefore.quantity,
					current: projectDropActorCurrent(result.sourceAfter),
				},
				target: projectDropTransferActor({
					after: result.targetAfter,
					before: result.targetBefore,
				}),
			}),
		),
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
			ItemNotOnGridError: () =>
				Effect.succeed(
					makeDropRejectedResult({
						reason: DropItemRejectedReasonEnumSchema.enum.InvalidSource,
						sourceItemId,
						targetItemId,
					}),
				),
			ItemNotOnBoardError: () =>
				Effect.succeed(
					makeDropRejectedResult({
						reason: DropItemRejectedReasonEnumSchema.enum.InvalidTarget,
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
			MergeRuleNotFoundError: () =>
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
			JobOwnerBusyError: rejectBlockedFx,
			ItemJobScopedError: rejectBlockedFx,
			MergeSameItemError: rejectBlockedFx,
		}),
	);
});
