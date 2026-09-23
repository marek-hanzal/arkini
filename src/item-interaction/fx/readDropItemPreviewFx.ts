import { readBoardSizeFn } from "~/game-runtime/fn/readBoardSizeFn";
import { Effect, Option } from "effect";

import { GameConfigFx } from "~/game-config/context/GameConfigFx";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { isSameGridLocationFn } from "~/item-location/fn/isSameGridLocationFn";
import { readGridLocationClaimAtFn } from "~/item-location/fn/readGridLocationClaimAtFn";
import { readGridLocationClaimsFn } from "~/item-location/fn/readGridLocationClaimsFn";
import { resolveMergeRuleFx } from "~/item-merge/fx/resolveMergeRuleFx";
import type { DropItemCommand } from "~/item-interaction/type/DropItemCommand";
import { narrowBoardRuntimeItemFn } from "~/game-runtime/fn/narrowBoardRuntimeItemFn";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { DropItemIgnoredReason } from "~/item-interaction/type/DropItemResult";
import { DropItemRejectedReason } from "~/item-interaction/type/DropItemResult";
import { DropItemResultKind } from "~/item-interaction/type/DropItemResult";

export namespace readDropItemPreviewFx {
	export type Result =
		| {
				readonly kind:
					| typeof DropItemResultKind.Move
					| typeof DropItemResultKind.Swap
					| typeof DropItemResultKind.Merge;
		  }
		| {
				readonly kind: typeof DropItemResultKind.Ignored;
				readonly reason: DropItemIgnoredReason;
		  }
		| {
				readonly kind: typeof DropItemResultKind.Reject;
				readonly reason: DropItemRejectedReason;
		  };
}

const rejectedFn = (reason: DropItemRejectedReason): readDropItemPreviewFx.Result => ({
	kind: DropItemResultKind.Reject,
	reason,
});

/** Reads the current authoritative semantic kind of one prospective item drop without mutating runtime. */
export const readDropItemPreviewFx = Effect.fnUntraced(function* ({
	sourceItemId,
	sourceRevision,
	sourceLocation,
	target,
}: DropItemCommand) {
	if (target.kind === "unsupported") {
		return rejectedFn(DropItemRejectedReason.UnsupportedTarget);
	}
	if (
		isSameGridLocationFn({
			left: sourceLocation,
			right: target.location,
		})
	) {
		return {
			kind: DropItemResultKind.Ignored,
			reason: DropItemIgnoredReason.SameLocation,
		} satisfies readDropItemPreviewFx.Result;
	}
	const runtime = yield* readRuntimeFx();
	const runtimeSource = runtime.items.find((item) => item.id === sourceItemId);
	if (runtimeSource === undefined || runtimeSource.revision !== sourceRevision) {
		return rejectedFn(DropItemRejectedReason.StaleSource);
	}
	const source = Option.getOrUndefined(narrowBoardRuntimeItemFn(runtimeSource));
	if (source === undefined) {
		return rejectedFn(DropItemRejectedReason.InvalidSource);
	}
	if (
		!isSameGridLocationFn({
			left: source.location,
			right: sourceLocation,
		})
	) {
		return rejectedFn(DropItemRejectedReason.StaleSource);
	}
	if (target.occupant === null) {
		const claim = readGridLocationClaimAtFn({
			claims: readGridLocationClaimsFn({
				runtime,
			}).filter((candidate) => candidate.itemId !== sourceItemId),
			location: target.location,
		});
		if (claim !== undefined) {
			return rejectedFn(DropItemRejectedReason.Occupied);
		}
		const config = yield* GameConfigFx;
		const targetSize = readBoardSizeFn({
			runtime,
			config,
			space: target.location.space,
		});
		if (
			target.location.position.x >= targetSize.width ||
			target.location.position.y >= targetSize.height
		) {
			return rejectedFn(DropItemRejectedReason.InvalidTarget);
		}
		return {
			kind: DropItemResultKind.Move,
		} satisfies readDropItemPreviewFx.Result;
	}

	const targetOccupant = target.occupant;
	const runtimeTargetItem = runtime.items.find((item) => item.id === targetOccupant.itemId);
	if (runtimeTargetItem === undefined || runtimeTargetItem.revision !== targetOccupant.revision) {
		return rejectedFn(DropItemRejectedReason.StaleTarget);
	}
	const targetItem = Option.getOrUndefined(narrowBoardRuntimeItemFn(runtimeTargetItem));
	if (targetItem === undefined) {
		return rejectedFn(DropItemRejectedReason.InvalidTarget);
	}
	if (
		!isSameGridLocationFn({
			left: targetItem.location,
			right: target.location,
		})
	) {
		return rejectedFn(DropItemRejectedReason.StaleTarget);
	}
	const boardSource = Option.getOrUndefined(narrowBoardRuntimeItemFn(source));
	const boardTarget = Option.getOrUndefined(narrowBoardRuntimeItemFn(targetItem));
	if (
		boardSource !== undefined &&
		boardTarget !== undefined &&
		boardSource.location.space !== boardTarget.location.space
	) {
		return rejectedFn(DropItemRejectedReason.InvalidTarget);
	}
	const oneBoardItem = (boardSource === undefined) !== (boardTarget === undefined);
	const boardItem = boardSource ?? boardTarget;
	if (
		oneBoardItem &&
		boardItem !== undefined &&
		boardItem.location.space !== runtime.currentSpace
	) {
		return rejectedFn(DropItemRejectedReason.InvalidTarget);
	}
	if (targetItem.location.scope === LocationScopeEnumSchema.enum.Board) {
		const mergeRule = yield* resolveMergeRuleFx({
			source,
			target: targetItem,
		}).pipe(Effect.option);
		if (Option.isSome(mergeRule)) {
			return {
				kind: DropItemResultKind.Merge,
			} satisfies readDropItemPreviewFx.Result;
		}
	}
	return {
		kind: DropItemResultKind.Swap,
	} satisfies readDropItemPreviewFx.Result;
});
