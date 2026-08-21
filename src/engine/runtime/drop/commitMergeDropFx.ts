import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { commitMergeItemsFx } from "~/engine/merge/internal/commitMergeItemsFx";
import { makeDropRejectedResultFx } from "~/engine/runtime/drop/makeDropRejectedResultFx";
import { projectDropActorCurrentFx } from "~/engine/runtime/drop/projectDropActorCurrentFx";
import { projectDropTransferActorFx } from "~/engine/runtime/drop/projectDropTransferActorFx";
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
		makeDropRejectedResultFx({
			reason: DropItemRejectedReasonEnumSchema.enum.Blocked,
			sourceItemId,
			targetItemId,
		});
	return yield* commitMergeItemsFx({
		sourceItemId,
		sourceRevision,
		targetItemId,
		targetRevision,
	}).pipe(
		Effect.flatMap((result) =>
			Effect.gen(function* () {
				const sourceCurrent = yield* projectDropActorCurrentFx(result.sourceAfter);
				const target = yield* projectDropTransferActorFx({
					after: result.targetAfter,
					before: result.targetBefore,
				});

				return {
					kind: DropItemResultKindEnumSchema.enum.Merge,
					action: result.event.action,
					effect: result.event.effect,
					resultCanonicalItemId: result.event.resultCanonicalItemId,
					source: {
						itemId: result.sourceBefore.id,
						previousRevision: result.sourceBefore.revision,
						previousLocation: result.sourceBefore.location,
						previousQuantity: result.sourceBefore.quantity,
						current: sourceCurrent,
					},
					target,
				} satisfies commitMergeDropFx.Result;
			}),
		),
		Effect.catchTags({
			ItemNotFoundError: (error) =>
				makeDropRejectedResultFx({
					reason:
						error.itemId === targetItemId
							? DropItemRejectedReasonEnumSchema.enum.StaleTarget
							: DropItemRejectedReasonEnumSchema.enum.StaleSource,
					sourceItemId,
					targetItemId,
				}),
			RevisionConflictError: (error) =>
				makeDropRejectedResultFx({
					reason:
						error.entityId === targetItemId
							? DropItemRejectedReasonEnumSchema.enum.StaleTarget
							: DropItemRejectedReasonEnumSchema.enum.StaleSource,
					sourceItemId,
					targetItemId,
				}),
			ItemNotOnGridError: () =>
				makeDropRejectedResultFx({
					reason: DropItemRejectedReasonEnumSchema.enum.InvalidSource,
					sourceItemId,
					targetItemId,
				}),
			ItemNotOnBoardError: () =>
				makeDropRejectedResultFx({
					reason: DropItemRejectedReasonEnumSchema.enum.InvalidTarget,
					sourceItemId,
					targetItemId,
				}),
			CrossSpaceBoardOperationError: () =>
				makeDropRejectedResultFx({
					reason: DropItemRejectedReasonEnumSchema.enum.InvalidTarget,
					sourceItemId,
					targetItemId,
				}),
			MergeRuleNotFoundError: () =>
				makeDropRejectedResultFx({
					reason: DropItemRejectedReasonEnumSchema.enum.InvalidTarget,
					sourceItemId,
					targetItemId,
				}),
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
