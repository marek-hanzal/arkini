import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { isSameGridLocation } from "~/engine/location/read/isSameGridLocation";
import { commitMergeItemsFx } from "~/engine/merge/internal/commitMergeItemsFx";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { readDropItemPreviewFx } from "~/engine/runtime/read/readDropItemPreviewFx";
import type { DropItemResultSchema } from "~/engine/runtime/schema/command/DropItemResultSchema";
import { DropItemIgnoredReasonEnumSchema } from "~/engine/runtime/schema/command/DropItemIgnoredReasonEnumSchema";
import { DropItemRejectedReasonEnumSchema } from "~/engine/runtime/schema/command/DropItemRejectedReasonEnumSchema";
import { DropItemResultKindEnumSchema } from "~/engine/runtime/schema/command/DropItemResultKindEnumSchema";
import type { GridRuntimeItemSchema } from "~/engine/runtime/schema/GridRuntimeItemSchema";
import { moveItemFx } from "~/engine/runtime/write/moveItemFx";
import { swapItemsFx } from "~/engine/runtime/write/swapItemsFx";

export namespace dropItemFx {
	export interface Props {
		readonly sourceItemId: IdSchema.Type;
		readonly sourceRevision: RevisionSchema.Type;
		readonly sourceLocation: GridLocationSchema.Type;
		readonly target:
			| {
					readonly kind: "slot";
					readonly location: GridLocationSchema.Type;
					readonly occupant: {
						readonly itemId: IdSchema.Type;
						readonly revision: RevisionSchema.Type;
					} | null;
			  }
			| {
					readonly kind: "unsupported";
			  };
	}

	export type Result = DropItemResultSchema.Type;
}

const mergeActorState = (item: GridRuntimeItemSchema.Type) => ({
	itemId: item.id,
	canonicalItemId: item.item.id,
	revision: item.revision,
	location: item.location,
	quantity: item.quantity,
});

const rejectForItemError = ({
	errorItemId,
	sourceItemId,
	targetItemId,
}: {
	readonly errorItemId?: IdSchema.Type;
	readonly sourceItemId: IdSchema.Type;
	readonly targetItemId: IdSchema.Type;
}): dropItemFx.Result => ({
	kind: DropItemResultKindEnumSchema.enum.Reject,
	reason: errorItemId === targetItemId ? DropItemRejectedReasonEnumSchema.enum.StaleTarget : DropItemRejectedReasonEnumSchema.enum.StaleSource,
	itemId: sourceItemId,
	targetItemId,
});

/** Resolves one requested item drop through the current atomic runtime command path. */
export const dropItemFx = Effect.fn("dropItemFx")(function* ({
	sourceItemId,
	sourceRevision,
	sourceLocation,
	target,
}: dropItemFx.Props) {
	if (target.kind === "unsupported") {
		return {
			kind: DropItemResultKindEnumSchema.enum.Reject,
			reason: DropItemRejectedReasonEnumSchema.enum.UnsupportedTarget,
			itemId: sourceItemId,
		} satisfies dropItemFx.Result;
	}

	if (isSameGridLocation(sourceLocation, target.location)) {
		return {
			kind: DropItemResultKindEnumSchema.enum.Ignored,
			reason: DropItemIgnoredReasonEnumSchema.enum.SameLocation,
			itemId: sourceItemId,
			location: sourceLocation,
		} satisfies dropItemFx.Result;
	}

	if (target.occupant === null) {
		return yield* moveItemFx({
			itemId: sourceItemId,
			revision: sourceRevision,
			expectedLocation: sourceLocation,
			location: target.location,
		}).pipe(
			Effect.map(
				(result): dropItemFx.Result => ({
					kind: DropItemResultKindEnumSchema.enum.Move,
					itemId: result.item.id,
					revision: result.item.revision,
					previousLocation: result.previousLocation,
					location: result.item.location,
				}),
			),
			Effect.catchTags({
				LocationOccupiedError: (error) =>
					Effect.succeed({
						kind: DropItemResultKindEnumSchema.enum.Reject,
						reason: DropItemRejectedReasonEnumSchema.enum.Occupied,
						itemId: sourceItemId,
						targetItemId: error.itemId,
					}),
				ItemNotFoundError: () =>
					Effect.succeed({
						kind: DropItemResultKindEnumSchema.enum.Reject,
						reason: DropItemRejectedReasonEnumSchema.enum.StaleSource,
						itemId: sourceItemId,
					}),
				RevisionConflictError: () =>
					Effect.succeed({
						kind: DropItemResultKindEnumSchema.enum.Reject,
						reason: DropItemRejectedReasonEnumSchema.enum.StaleSource,
						itemId: sourceItemId,
					}),
				ItemLocationConflictError: () =>
					Effect.succeed({
						kind: DropItemResultKindEnumSchema.enum.Reject,
						reason: DropItemRejectedReasonEnumSchema.enum.StaleSource,
						itemId: sourceItemId,
					}),
				ItemNotOnGridError: () =>
					Effect.succeed({
						kind: DropItemResultKindEnumSchema.enum.Reject,
						reason: DropItemRejectedReasonEnumSchema.enum.InvalidSource,
						itemId: sourceItemId,
					}),
				CrossSpaceBoardOperationError: () =>
					Effect.succeed({
						kind: DropItemResultKindEnumSchema.enum.Reject,
						reason: DropItemRejectedReasonEnumSchema.enum.InvalidTarget,
						itemId: sourceItemId,
					}),
				RuntimeInvalidError: () =>
					Effect.succeed({
						kind: DropItemResultKindEnumSchema.enum.Reject,
						reason: DropItemRejectedReasonEnumSchema.enum.InvalidTarget,
						itemId: sourceItemId,
					}),
			}),
		);
	}

	const targetItemId = target.occupant.itemId;
	const preflight = yield* readDropItemPreviewFx({
		sourceItemId,
		sourceRevision,
		sourceLocation,
		target,
	});
	if (preflight.kind === DropItemResultKindEnumSchema.enum.Reject) {
		return {
			kind: DropItemResultKindEnumSchema.enum.Reject,
			reason: preflight.reason,
			itemId: sourceItemId,
			targetItemId,
		} satisfies dropItemFx.Result;
	}
	if (preflight.kind === DropItemResultKindEnumSchema.enum.Merge) {
		return yield* commitMergeItemsFx({
			sourceItemId,
			sourceRevision,
			targetItemId,
			targetRevision: target.occupant.revision,
		}).pipe(
			Effect.map(
				(result): dropItemFx.Result => ({
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
								: mergeActorState(result.sourceAfter),
					},
					target: {
						itemId: result.targetBefore.id,
						previousRevision: result.targetBefore.revision,
						previousLocation: result.targetBefore.location,
						previousQuantity: result.targetBefore.quantity,
						current:
							result.targetAfter === undefined
								? null
								: mergeActorState(result.targetAfter),
					},
				}),
			),
			Effect.catchTags({
				ItemNotFoundError: (error) =>
					Effect.succeed(
						rejectForItemError({
							errorItemId: error.itemId,
							sourceItemId,
							targetItemId,
						}),
					),
				RevisionConflictError: (error) =>
					Effect.succeed(
						rejectForItemError({
							errorItemId: error.entityId,
							sourceItemId,
							targetItemId,
						}),
					),
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
			Effect.catchAll(() =>
				Effect.succeed({
					kind: DropItemResultKindEnumSchema.enum.Reject,
					reason: DropItemRejectedReasonEnumSchema.enum.Blocked,
					itemId: sourceItemId,
					targetItemId,
				}),
			),
		);
	}

	if (preflight.kind !== DropItemResultKindEnumSchema.enum.Swap) {
		return yield* Effect.dieMessage(
			`Occupied drop preview unexpectedly resolved as "${preflight.kind}".`,
		);
	}

	return yield* swapItemsFx({
		firstItemId: sourceItemId,
		firstItemRevision: sourceRevision,
		secondItemId: targetItemId,
		secondItemRevision: target.occupant.revision,
	}).pipe(
		Effect.map(
			(result): dropItemFx.Result => ({
				kind: DropItemResultKindEnumSchema.enum.Swap,
				source: {
					itemId: result.first.id,
					revision: result.first.revision,
					previousLocation: sourceLocation,
					location: result.first.location,
				},
				target: {
					itemId: result.second.id,
					revision: result.second.revision,
					previousLocation: target.location,
					location: result.second.location,
				},
			}),
		),
		Effect.catchTags({
			ItemNotFoundError: (error) =>
				Effect.succeed(
					rejectForItemError({
						errorItemId: error.itemId,
						sourceItemId,
						targetItemId,
					}),
				),
			RevisionConflictError: (error) =>
				Effect.succeed(
					rejectForItemError({
						errorItemId: error.entityId,
						sourceItemId,
						targetItemId,
					}),
				),
			ItemNotOnGridError: (error) =>
				Effect.succeed({
					kind: DropItemResultKindEnumSchema.enum.Reject,
					reason:
						error.itemId === targetItemId
							? (DropItemRejectedReasonEnumSchema.enum.InvalidTarget)
							: (DropItemRejectedReasonEnumSchema.enum.InvalidSource),
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
			RuntimeInvalidError: () =>
				Effect.succeed({
					kind: DropItemResultKindEnumSchema.enum.Reject,
					reason: DropItemRejectedReasonEnumSchema.enum.InvalidTarget,
					itemId: sourceItemId,
					targetItemId,
				}),
			SwapSameItemError: () =>
				Effect.succeed({
					kind: DropItemResultKindEnumSchema.enum.Ignored,
					reason: DropItemIgnoredReasonEnumSchema.enum.SameLocation,
					itemId: sourceItemId,
					location: sourceLocation,
				}),
		}),
	);
});
