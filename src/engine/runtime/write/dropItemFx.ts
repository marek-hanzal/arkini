import { Effect, Option } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { isSameGridLocation } from "~/engine/location/read/isSameGridLocation";
import { resolveMergeRuleFx } from "~/engine/merge/fx/resolveMergeRuleFx";
import { commitMergeItemsFx } from "~/engine/merge/internal/commitMergeItemsFx";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { isGridRuntimeItem } from "~/engine/runtime/read/isGridRuntimeItem";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import type { DropItemResultSchema } from "~/engine/runtime/schema/command/DropItemResultSchema";
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

type OccupiedDropPreflight =
	| {
			readonly kind: "swap";
	  }
	| {
			readonly kind: "merge";
	  }
	| {
			readonly kind: "reject";
			readonly reason: Extract<
				dropItemFx.Result,
				{
					readonly kind: "reject";
				}
			>["reason"];
	  };

const readOccupiedDropPreflightFx = Effect.fn("readOccupiedDropPreflightFx")(function* ({
	sourceItemId,
	sourceRevision,
	sourceLocation,
	targetItemId,
	targetRevision,
	targetLocation,
}: {
	readonly sourceItemId: IdSchema.Type;
	readonly sourceRevision: RevisionSchema.Type;
	readonly sourceLocation: GridLocationSchema.Type;
	readonly targetItemId: IdSchema.Type;
	readonly targetRevision: RevisionSchema.Type;
	readonly targetLocation: GridLocationSchema.Type;
}) {
	const runtime = yield* readRuntimeFx();
	const source = runtime.items.find((item) => item.id === sourceItemId);
	if (source === undefined || source.revision !== sourceRevision) {
		return {
			kind: "reject",
			reason: "stale-source",
		} satisfies OccupiedDropPreflight;
	}
	const target = runtime.items.find((item) => item.id === targetItemId);
	if (target === undefined || target.revision !== targetRevision) {
		return {
			kind: "reject",
			reason: "stale-target",
		} satisfies OccupiedDropPreflight;
	}
	if (!isGridRuntimeItem(source)) {
		return {
			kind: "reject",
			reason: "invalid-source",
		} satisfies OccupiedDropPreflight;
	}
	if (!isGridRuntimeItem(target)) {
		return {
			kind: "reject",
			reason: "invalid-target",
		} satisfies OccupiedDropPreflight;
	}
	if (!isSameGridLocation(source.location, sourceLocation)) {
		return {
			kind: "reject",
			reason: "stale-source",
		} satisfies OccupiedDropPreflight;
	}
	if (!isSameGridLocation(target.location, targetLocation)) {
		return {
			kind: "reject",
			reason: "stale-target",
		} satisfies OccupiedDropPreflight;
	}
	if (target.location.scope === "board") {
		const mergeRule = yield* resolveMergeRuleFx({
			source,
			target,
		}).pipe(Effect.option);
		if (Option.isSome(mergeRule)) {
			return {
				kind: "merge",
			} satisfies OccupiedDropPreflight;
		}
	}
	return {
		kind: "swap",
	} satisfies OccupiedDropPreflight;
});

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
	kind: "reject",
	reason: errorItemId === targetItemId ? "stale-target" : "stale-source",
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
			kind: "reject",
			reason: "unsupported-target",
			itemId: sourceItemId,
		} satisfies dropItemFx.Result;
	}

	if (isSameGridLocation(sourceLocation, target.location)) {
		return {
			kind: "ignored",
			reason: "same-location",
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
					kind: "move",
					itemId: result.item.id,
					revision: result.item.revision,
					previousLocation: result.previousLocation,
					location: result.item.location,
				}),
			),
			Effect.catchTags({
				LocationOccupiedError: (error) =>
					Effect.succeed({
						kind: "reject" as const,
						reason: "occupied" as const,
						itemId: sourceItemId,
						targetItemId: error.itemId,
					}),
				ItemNotFoundError: () =>
					Effect.succeed({
						kind: "reject" as const,
						reason: "stale-source" as const,
						itemId: sourceItemId,
					}),
				RevisionConflictError: () =>
					Effect.succeed({
						kind: "reject" as const,
						reason: "stale-source" as const,
						itemId: sourceItemId,
					}),
				ItemLocationConflictError: () =>
					Effect.succeed({
						kind: "reject" as const,
						reason: "stale-source" as const,
						itemId: sourceItemId,
					}),
				ItemNotOnGridError: () =>
					Effect.succeed({
						kind: "reject" as const,
						reason: "invalid-source" as const,
						itemId: sourceItemId,
					}),
				CrossSpaceBoardOperationError: () =>
					Effect.succeed({
						kind: "reject" as const,
						reason: "invalid-target" as const,
						itemId: sourceItemId,
					}),
				RuntimeInvalidError: () =>
					Effect.succeed({
						kind: "reject" as const,
						reason: "invalid-target" as const,
						itemId: sourceItemId,
					}),
			}),
		);
	}

	const targetItemId = target.occupant.itemId;
	const preflight = yield* readOccupiedDropPreflightFx({
		sourceItemId,
		sourceRevision,
		sourceLocation,
		targetItemId,
		targetRevision: target.occupant.revision,
		targetLocation: target.location,
	});
	if (preflight.kind === "reject") {
		return {
			kind: "reject",
			reason: preflight.reason,
			itemId: sourceItemId,
			targetItemId,
		} satisfies dropItemFx.Result;
	}
	if (preflight.kind === "merge") {
		return yield* commitMergeItemsFx({
			sourceItemId,
			sourceRevision,
			targetItemId,
			targetRevision: target.occupant.revision,
		}).pipe(
			Effect.map(
				(result): dropItemFx.Result => ({
					kind: "merge",
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
						kind: "reject" as const,
						reason: "invalid-source" as const,
						itemId: sourceItemId,
						targetItemId,
					}),
				ItemNotOnBoardError: () =>
					Effect.succeed({
						kind: "reject" as const,
						reason: "invalid-target" as const,
						itemId: sourceItemId,
						targetItemId,
					}),
				CrossSpaceBoardOperationError: () =>
					Effect.succeed({
						kind: "reject" as const,
						reason: "invalid-target" as const,
						itemId: sourceItemId,
						targetItemId,
					}),
				MergeRuleNotFoundError: () =>
					Effect.succeed({
						kind: "reject" as const,
						reason: "invalid-target" as const,
						itemId: sourceItemId,
						targetItemId,
					}),
			}),
			Effect.catchAll(() =>
				Effect.succeed({
					kind: "reject" as const,
					reason: "blocked" as const,
					itemId: sourceItemId,
					targetItemId,
				}),
			),
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
				kind: "swap",
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
					kind: "reject" as const,
					reason:
						error.itemId === targetItemId
							? ("invalid-target" as const)
							: ("invalid-source" as const),
					itemId: sourceItemId,
					targetItemId,
				}),
			CrossSpaceBoardOperationError: () =>
				Effect.succeed({
					kind: "reject" as const,
					reason: "invalid-target" as const,
					itemId: sourceItemId,
					targetItemId,
				}),
			RuntimeInvalidError: () =>
				Effect.succeed({
					kind: "reject" as const,
					reason: "invalid-target" as const,
					itemId: sourceItemId,
					targetItemId,
				}),
			SwapSameItemError: () =>
				Effect.succeed({
					kind: "ignored" as const,
					reason: "same-location" as const,
					itemId: sourceItemId,
					location: sourceLocation,
				}),
		}),
	);
});
