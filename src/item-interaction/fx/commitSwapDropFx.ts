import { Array, Data, Effect, Option, pipe } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import { ItemNotFoundError } from "~/item-resolution/error/ItemNotFoundError";
import { ItemNotOnGridError } from "~/item-location/error/ItemNotOnGridError";
import { assertRevisionFx } from "~/item-revision/fx/assertRevisionFx";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import type { RevisionSchema } from "~/item-revision/schema/RevisionSchema";
import { reviseRuntimeItemFx } from "~/game-runtime/fx/reviseRuntimeItemFx";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";
import { isBoardRuntimeItemFn } from "~/game-runtime/fn/isBoardRuntimeItemFn";
import { isGridRuntimeItemFn } from "~/game-runtime/fn/isGridRuntimeItemFn";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { CrossSpaceBoardOperationError } from "~/item-location/error/CrossSpaceBoardOperationError";
import { DropItemIgnoredReason } from "~/item-interaction/type/DropItemResult";
import { DropItemRejectedReason } from "~/item-interaction/type/DropItemResult";
import type { DropItemResult } from "~/item-interaction/type/DropItemResult";
import { DropItemResultKind } from "~/item-interaction/type/DropItemResult";
import { makeDropActorRejectedResultFn } from "~/item-interaction/fn/makeDropActorRejectedResultFn";
import { makeDropRejectedResultFn } from "~/item-interaction/fn/makeDropRejectedResultFn";

/** A two-item swap requires two distinct runtime identities. */
class SwapSameItemError extends Data.TaggedError("SwapSameItemError")<{
	readonly itemId: IdSchema.Type;
}> {}

interface SwapItemsProps {
	readonly firstItemId: IdSchema.Type;
	readonly firstItemRevision: RevisionSchema.Type;
	readonly secondItemId: IdSchema.Type;
	readonly secondItemRevision: RevisionSchema.Type;
}

interface SwapItemsResult {
	readonly first: RuntimeItemSchema.Type;
	readonly second: RuntimeItemSchema.Type;
}

const swapItemsFx = Effect.fn("swapItemsFx")(function* ({
	firstItemId,
	firstItemRevision,
	secondItemId,
	secondItemRevision,
}: SwapItemsProps) {
	if (firstItemId === secondItemId) {
		return yield* Effect.fail(
			new SwapSameItemError({
				itemId: firstItemId,
			}),
		);
	}

	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const runtimeFirst = pipe(
				runtime.items,
				Array.findFirst((candidate) => candidate.id === firstItemId),
				Option.getOrUndefined,
			);
			if (runtimeFirst === undefined) {
				return yield* Effect.fail(
					new ItemNotFoundError({
						itemId: firstItemId,
					}),
				);
			}
			const runtimeSecond = pipe(
				runtime.items,
				Array.findFirst((candidate) => candidate.id === secondItemId),
				Option.getOrUndefined,
			);
			if (runtimeSecond === undefined) {
				return yield* Effect.fail(
					new ItemNotFoundError({
						itemId: secondItemId,
					}),
				);
			}
			yield* assertRevisionFx({
				actualRevision: runtimeFirst.revision,
				entityId: runtimeFirst.id,
				expectedRevision: firstItemRevision,
			});
			yield* assertRevisionFx({
				actualRevision: runtimeSecond.revision,
				entityId: runtimeSecond.id,
				expectedRevision: secondItemRevision,
			});
			const first = Option.getOrUndefined(isGridRuntimeItemFn(runtimeFirst));
			if (first === undefined) {
				return yield* Effect.fail(
					new ItemNotOnGridError({
						itemId: firstItemId,
						location: runtimeFirst.location,
					}),
				);
			}
			const second = Option.getOrUndefined(isGridRuntimeItemFn(runtimeSecond));
			if (second === undefined) {
				return yield* Effect.fail(
					new ItemNotOnGridError({
						itemId: secondItemId,
						location: runtimeSecond.location,
					}),
				);
			}
			const boardFirst = Option.getOrUndefined(isBoardRuntimeItemFn(first));
			const boardSecond = Option.getOrUndefined(isBoardRuntimeItemFn(second));
			if (
				boardFirst !== undefined &&
				boardSecond !== undefined &&
				boardFirst.location.space !== boardSecond.location.space
			) {
				return yield* Effect.fail(
					new CrossSpaceBoardOperationError({
						fromSpace: boardFirst.location.space,
						toSpace: boardSecond.location.space,
					}),
				);
			}
			const firstOnBoard = boardFirst !== undefined;
			const secondOnBoard = boardSecond !== undefined;
			const boardItem = boardFirst ?? boardSecond;
			if (
				firstOnBoard !== secondOnBoard &&
				boardItem !== undefined &&
				boardItem.location.space !== runtime.currentSpace
			) {
				return yield* Effect.fail(
					new CrossSpaceBoardOperationError({
						fromSpace: runtime.currentSpace,
						toSpace: boardItem.location.space,
					}),
				);
			}
			const swappedFirst = yield* reviseRuntimeItemFx({
				item: {
					...first,
					location: second.location,
				} satisfies RuntimeItemSchema.Type,
			});
			const swappedSecond = yield* reviseRuntimeItemFx({
				item: {
					...second,
					location: first.location,
				} satisfies RuntimeItemSchema.Type,
			});
			return [
				{
					first: swappedFirst,
					second: swappedSecond,
				} satisfies SwapItemsResult,
				{
					...runtime,
					items: runtime.items.map((candidate) => {
						if (candidate.id === firstItemId) return swappedFirst;
						if (candidate.id === secondItemId) return swappedSecond;
						return candidate;
					}),
				} satisfies RuntimeSchema.Type,
			] as const;
		}),
	);
});

export namespace commitSwapDropFx {
	export interface Props {
		readonly sourceItemId: IdSchema.Type;
		readonly sourceRevision: RevisionSchema.Type;
		readonly sourceLocation: GridLocationSchema.Type;
		readonly targetItemId: IdSchema.Type;
		readonly targetRevision: RevisionSchema.Type;
		readonly targetLocation: GridLocationSchema.Type;
	}

	export type Result = DropItemResult;
}

/** Commits one exact grid swap and normalizes both actor identities. */
export const commitSwapDropFx = Effect.fn("commitSwapDropFx")(function* ({
	sourceItemId,
	sourceRevision,
	sourceLocation,
	targetItemId,
	targetRevision,
	targetLocation,
}: commitSwapDropFx.Props) {
	return yield* swapItemsFx({
		firstItemId: sourceItemId,
		firstItemRevision: sourceRevision,
		secondItemId: targetItemId,
		secondItemRevision: targetRevision,
	}).pipe(
		Effect.map(
			(result): commitSwapDropFx.Result => ({
				kind: DropItemResultKind.Swap,
				source: {
					itemId: result.first.id,
					revision: result.first.revision,
					previousLocation: sourceLocation,
					location: result.first.location,
				},
				target: {
					itemId: result.second.id,
					revision: result.second.revision,
					previousLocation: targetLocation,
					location: result.second.location,
				},
			}),
		),
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
			SwapSameItemError: () =>
				Effect.succeed({
					kind: DropItemResultKind.Ignored,
					reason: DropItemIgnoredReason.SameLocation,
					itemId: sourceItemId,
					location: sourceLocation,
				}),
		}),
	);
});
