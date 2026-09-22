import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { Array, Data, Effect, Option, pipe } from "effect";

import { GameConfigFx } from "~/game-config/context/GameConfigFx";
import { narrowBoardRuntimeItemFn } from "~/game-runtime/fn/narrowBoardRuntimeItemFn";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";
import { reviseRuntimeItemFx } from "~/game-runtime/fx/reviseRuntimeItemFx";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { makeDropActorRejectedResultFn } from "~/item-interaction/fn/makeDropActorRejectedResultFn";
import { makeDropRejectedResultFn } from "~/item-interaction/fn/makeDropRejectedResultFn";
import type { DropItemResult } from "~/item-interaction/type/DropItemResult";
import { DropItemRejectedReason, DropItemResultKind } from "~/item-interaction/type/DropItemResult";
import { ItemLocationConflictError } from "~/item-location/error/ItemLocationConflictError";
import { ItemNotOnGridError } from "~/item-location/error/ItemNotOnGridError";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import { isSameGridLocationFn } from "~/item-location/fn/isSameGridLocationFn";
import { readBoardLocationsFn } from "~/item-placement/fn/readBoardLocationsFn";
import { readEmptyLocationsFn } from "~/item-placement/fn/readEmptyLocationsFn";
import { assertRevisionFx } from "~/item-revision/fx/assertRevisionFx";
import type { RevisionSchema } from "~/item-revision/schema/RevisionSchema";
import { ItemNotFoundError } from "~/item-resolution/error/ItemNotFoundError";

class PortalDropRejectedError extends Data.TaggedError("PortalDropRejectedError")<{
	readonly reason: DropItemRejectedReason;
}> {}

export namespace commitPortalDropFx {
	export interface Props {
		readonly sourceItemId: IdSchema.Type;
		readonly sourceRevision: RevisionSchema.Type;
		readonly sourceLocation: BoardLocationSchema.Type;
		readonly targetItemId: IdSchema.Type;
		readonly targetRevision: RevisionSchema.Type;
		readonly targetLocation: BoardLocationSchema.Type;
	}
}

/** Moves one exact dropped item to the first free cell on an occupied portal's authored Board. */
export const commitPortalDropFx = Effect.fn("commitPortalDropFx")(function* ({
	sourceItemId,
	sourceRevision,
	sourceLocation,
	targetItemId,
	targetRevision,
	targetLocation,
}: commitPortalDropFx.Props) {
	const rejectActorFx = (
		failedItemId: IdSchema.Type | undefined,
		failure: "invalid-location" | "stale",
	) =>
		Effect.succeed(
			makeDropActorRejectedResultFn({
				failedItemId,
				failure,
				sourceItemId,
				targetItemId,
			}),
		);
	const moved = yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const readItemFn = (itemId: IdSchema.Type) =>
				pipe(
					runtime.items,
					Array.findFirst((candidate) => candidate.id === itemId),
					Option.getOrUndefined,
				);
			const runtimeSource = readItemFn(sourceItemId);
			if (runtimeSource === undefined) {
				return yield* Effect.fail(
					new ItemNotFoundError({
						itemId: sourceItemId,
					}),
				);
			}
			const runtimeTarget = readItemFn(targetItemId);
			if (runtimeTarget === undefined) {
				return yield* Effect.fail(
					new ItemNotFoundError({
						itemId: targetItemId,
					}),
				);
			}
			yield* assertRevisionFx({
				actualRevision: runtimeSource.revision,
				entityId: sourceItemId,
				expectedRevision: sourceRevision,
			});
			yield* assertRevisionFx({
				actualRevision: runtimeTarget.revision,
				entityId: targetItemId,
				expectedRevision: targetRevision,
			});
			const source = Option.getOrUndefined(narrowBoardRuntimeItemFn(runtimeSource));
			if (source === undefined) {
				return yield* Effect.fail(
					new ItemNotOnGridError({
						itemId: sourceItemId,
						location: runtimeSource.location,
					}),
				);
			}
			const target = Option.getOrUndefined(narrowBoardRuntimeItemFn(runtimeTarget));
			if (target === undefined) {
				return yield* Effect.fail(
					new ItemNotOnGridError({
						itemId: targetItemId,
						location: runtimeTarget.location,
					}),
				);
			}
			if (
				!isSameGridLocationFn({
					left: source.location,
					right: sourceLocation,
				})
			) {
				return yield* Effect.fail(
					new ItemLocationConflictError({
						actualLocation: source.location,
						expectedLocation: sourceLocation,
						itemId: sourceItemId,
					}),
				);
			}
			if (
				!isSameGridLocationFn({
					left: target.location,
					right: targetLocation,
				})
			) {
				return yield* Effect.fail(
					new ItemLocationConflictError({
						actualLocation: target.location,
						expectedLocation: targetLocation,
						itemId: targetItemId,
					}),
				);
			}
			const boardSource = Option.getOrUndefined(narrowBoardRuntimeItemFn(source));
			const boardTarget = Option.getOrUndefined(narrowBoardRuntimeItemFn(target));
			if (
				(boardSource !== undefined &&
					boardTarget !== undefined &&
					boardSource.location.space !== boardTarget.location.space) ||
				((boardSource === undefined) !== (boardTarget === undefined) &&
					(boardSource ?? boardTarget)?.location.space !== runtime.currentSpace)
			) {
				return yield* Effect.fail(
					new PortalDropRejectedError({
						reason: DropItemRejectedReason.InvalidTarget,
					}),
				);
			}
			if (target.item.action?.type !== "space") {
				return yield* Effect.fail(
					new PortalDropRejectedError({
						reason: DropItemRejectedReason.InvalidTarget,
					}),
				);
			}
			const config = yield* GameConfigFx;
			const destination = readEmptyLocationsFn({
				locations: readBoardLocationsFn({
					size: config.meta.board,
					space: target.item.action.space,
				}),
				runtime,
			})[0];
			if (destination === undefined) {
				return yield* Effect.fail(
					new PortalDropRejectedError({
						reason: DropItemRejectedReason.Blocked,
					}),
				);
			}
			const item = yield* reviseRuntimeItemFx({
				item: {
					...source,
					location: destination,
				} satisfies RuntimeItemSchema.Type,
			});
			return [
				{
					item,
					previousLocation: source.location,
				},
				{
					...runtime,
					items: runtime.items.map((candidate) =>
						candidate.id === sourceItemId ? item : candidate,
					),
				} satisfies RuntimeSchema.Type,
				[
					{
						type: GameEventEnumSchema.enum.ItemPortalTransferred,
						itemId: item.id,
						canonicalItemId: item.item.id,
						portalItemId: target.id,
						previousLocation: source.location,
						location: item.location,
					} satisfies GameEventSchema.Type,
				],
			] as const;
		}),
	).pipe(
		Effect.map(
			(result): DropItemResult => ({
				kind: DropItemResultKind.Move,
				itemId: result.item.id,
				revision: result.item.revision,
				previousLocation: result.previousLocation,
				location: result.item.location,
			}),
		),
		Effect.catchTags({
			ItemNotFoundError: (error) => rejectActorFx(error.itemId, "stale"),
			RevisionConflictError: (error) => rejectActorFx(error.entityId, "stale"),
			ItemLocationConflictError: (error) => rejectActorFx(error.itemId, "stale"),
			ItemNotOnGridError: (error) => rejectActorFx(error.itemId, "invalid-location"),
			PortalDropRejectedError: (error) =>
				Effect.succeed(
					makeDropRejectedResultFn({
						reason: error.reason,
						sourceItemId,
						targetItemId,
					}),
				),
		}),
	);
	return moved;
});
