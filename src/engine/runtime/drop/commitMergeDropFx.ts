import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { commitMergeItemsFx } from "~/engine/merge/internal/commitMergeItemsFx";
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
				target: {
					itemId: result.targetBefore.id,
					previousRevision: result.targetBefore.revision,
					previousLocation: result.targetBefore.location,
					previousQuantity: result.targetBefore.quantity,
					current:
						result.targetAfter === undefined
							? null
							: {
									itemId: result.targetAfter.id,
									canonicalItemId: result.targetAfter.item.id,
									revision: result.targetAfter.revision,
									location: result.targetAfter.location,
									quantity: result.targetAfter.quantity,
								},
				},
			}),
		),
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
			ItemNotOnGridError: () =>
				Effect.succeed({
					kind: DropItemResultKindEnumSchema.enum.Reject,
					reason: DropItemRejectedReasonEnumSchema.enum.InvalidSource,
					itemId: sourceItemId,
					targetItemId,
				}),
			ItemNotOnBoardError: () =>
				Effect.succeed({
					kind: DropItemResultKindEnumSchema.enum.Reject,
					reason: DropItemRejectedReasonEnumSchema.enum.InvalidTarget,
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
			MergeRuleNotFoundError: () =>
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
			JobOwnerBusyError: () =>
				Effect.succeed({
					kind: DropItemResultKindEnumSchema.enum.Reject,
					reason: DropItemRejectedReasonEnumSchema.enum.Blocked,
					itemId: sourceItemId,
					targetItemId,
				}),
			ItemJobScopedError: () =>
				Effect.succeed({
					kind: DropItemResultKindEnumSchema.enum.Reject,
					reason: DropItemRejectedReasonEnumSchema.enum.Blocked,
					itemId: sourceItemId,
					targetItemId,
				}),
			MergeSameItemError: () =>
				Effect.succeed({
					kind: DropItemResultKindEnumSchema.enum.Reject,
					reason: DropItemRejectedReasonEnumSchema.enum.Blocked,
					itemId: sourceItemId,
					targetItemId,
				}),
		}),
	);
});
