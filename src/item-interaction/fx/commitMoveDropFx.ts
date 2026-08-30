import { Array, Data, Effect, Option, pipe } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import { ItemNotFoundError } from "~/engine/item/error/ItemNotFoundError";
import { ItemNotOnGridError } from "~/item-location/error/ItemNotOnGridError";
import { assertRevisionFx } from "~/engine/revision/fx/assertRevisionFx";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { ItemLocationConflictError } from "~/game-runtime/error/ItemLocationConflictError";
import { reviseRuntimeItemFx } from "~/game-runtime/fx/reviseRuntimeItemFx";
import { modifyRuntimeFx } from "~/game-runtime/internal/modifyRuntimeFx";
import { isGridRuntimeItemFn } from "~/game-runtime/read/fn/isGridRuntimeItemFn";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { CrossSpaceBoardOperationError } from "~/item-location/error/CrossSpaceBoardOperationError";
import { readGridLocationClaimAtFn } from "~/item-location/fn/readGridLocationClaimAtFn";
import { readGridLocationClaimsFn } from "~/item-location/fn/readGridLocationClaimsFn";
import { isSameGridLocationFn } from "~/item-location/fn/isSameGridLocationFn";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { DropItemRejectedReason } from "~/item-interaction/type/DropItemResult";
import type { DropItemResult } from "~/item-interaction/type/DropItemResult";
import { DropItemResultKind } from "~/item-interaction/type/DropItemResult";

class LocationOccupiedError extends Data.TaggedError("LocationOccupiedError")<{
	readonly itemId: IdSchema.Type;
	readonly location: GridLocationSchema.Type;
}> {}

interface MoveItemProps {
	readonly itemId: IdSchema.Type;
	readonly location: GridLocationSchema.Type;
	readonly revision: RevisionSchema.Type;
	readonly expectedLocation?: GridLocationSchema.Type;
}

interface MoveItemResult {
	readonly item: RuntimeItemSchema.Type;
	readonly previousLocation: GridLocationSchema.Type;
}

const moveItemFx = Effect.fn("moveItemFx")(function* ({
	itemId,
	location,
	revision,
	expectedLocation,
}: MoveItemProps) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const runtimeItem = pipe(
				runtime.items,
				Array.findFirst((candidate) => candidate.id === itemId),
				Option.getOrUndefined,
			);
			if (runtimeItem === undefined) {
				return yield* Effect.fail(
					new ItemNotFoundError({
						itemId,
					}),
				);
			}
			yield* assertRevisionFx({
				actualRevision: runtimeItem.revision,
				entityId: runtimeItem.id,
				expectedRevision: revision,
			});
			const item = Option.getOrUndefined(isGridRuntimeItemFn(runtimeItem));
			if (item === undefined) {
				return yield* Effect.fail(
					new ItemNotOnGridError({
						itemId,
						location: runtimeItem.location,
					}),
				);
			}
			if (
				expectedLocation !== undefined &&
				!isSameGridLocationFn({
					left: item.location,
					right: expectedLocation,
				})
			) {
				return yield* Effect.fail(
					new ItemLocationConflictError({
						itemId,
						expectedLocation,
						actualLocation: item.location,
					}),
				);
			}
			if (
				isSameGridLocationFn({
					left: item.location,
					right: location,
				})
			) {
				return [
					{
						item,
						previousLocation: item.location,
					} satisfies MoveItemResult,
					runtime,
				] as const;
			}
			if (
				item.location.scope === LocationScopeEnumSchema.enum.Board &&
				location.scope === LocationScopeEnumSchema.enum.Board &&
				item.location.space !== location.space
			) {
				return yield* Effect.fail(
					new CrossSpaceBoardOperationError({
						fromSpace: item.location.space,
						toSpace: location.space,
					}),
				);
			}
			if (
				(item.location.scope === LocationScopeEnumSchema.enum.Inventory ||
					item.location.scope === LocationScopeEnumSchema.enum.Toolbar) &&
				location.scope === LocationScopeEnumSchema.enum.Board &&
				location.space !== runtime.currentSpace
			) {
				return yield* Effect.fail(
					new CrossSpaceBoardOperationError({
						fromSpace: runtime.currentSpace,
						toSpace: location.space,
					}),
				);
			}
			const claim = readGridLocationClaimAtFn({
				claims: readGridLocationClaimsFn({
					runtime,
				}).filter((candidate) => candidate.itemId !== itemId),
				location,
			});
			if (claim !== undefined) {
				return yield* Effect.fail(
					new LocationOccupiedError({
						itemId: claim.itemId,
						location,
					}),
				);
			}
			const movedItem = yield* reviseRuntimeItemFx({
				item: {
					...item,
					location,
				} satisfies RuntimeItemSchema.Type,
			});
			return [
				{
					item: movedItem,
					previousLocation: item.location,
				} satisfies MoveItemResult,
				{
					...runtime,
					items: runtime.items.map((candidate) =>
						candidate.id === itemId ? movedItem : candidate,
					),
				} satisfies RuntimeSchema.Type,
			] as const;
		}),
	);
});

export namespace commitMoveDropFx {
	export interface Props {
		readonly sourceItemId: IdSchema.Type;
		readonly sourceRevision: RevisionSchema.Type;
		readonly sourceLocation: GridLocationSchema.Type;
		readonly targetLocation: GridLocationSchema.Type;
	}

	export type Result = DropItemResult;
}

/** Commits one exact empty-slot drop and normalizes its public result. */
export const commitMoveDropFx = Effect.fn("commitMoveDropFx")(function* ({
	sourceItemId,
	sourceRevision,
	sourceLocation,
	targetLocation,
}: commitMoveDropFx.Props) {
	return yield* moveItemFx({
		itemId: sourceItemId,
		revision: sourceRevision,
		expectedLocation: sourceLocation,
		location: targetLocation,
	}).pipe(
		Effect.map(
			(result): commitMoveDropFx.Result => ({
				kind: DropItemResultKind.Move,
				itemId: result.item.id,
				revision: result.item.revision,
				previousLocation: result.previousLocation,
				location: result.item.location,
			}),
		),
		Effect.catchTags({
			LocationOccupiedError: (error) =>
				Effect.succeed({
					kind: DropItemResultKind.Reject,
					reason: DropItemRejectedReason.Occupied,
					itemId: sourceItemId,
					targetItemId: error.itemId,
				}),
			ItemNotFoundError: () =>
				Effect.succeed({
					kind: DropItemResultKind.Reject,
					reason: DropItemRejectedReason.StaleSource,
					itemId: sourceItemId,
				}),
			RevisionConflictError: () =>
				Effect.succeed({
					kind: DropItemResultKind.Reject,
					reason: DropItemRejectedReason.StaleSource,
					itemId: sourceItemId,
				}),
			ItemLocationConflictError: () =>
				Effect.succeed({
					kind: DropItemResultKind.Reject,
					reason: DropItemRejectedReason.StaleSource,
					itemId: sourceItemId,
				}),
			ItemNotOnGridError: () =>
				Effect.succeed({
					kind: DropItemResultKind.Reject,
					reason: DropItemRejectedReason.InvalidSource,
					itemId: sourceItemId,
				}),
			CrossSpaceBoardOperationError: () =>
				Effect.succeed({
					kind: DropItemResultKind.Reject,
					reason: DropItemRejectedReason.InvalidTarget,
					itemId: sourceItemId,
				}),
		}),
	);
});
