import { Effect, Option } from "effect";
import { match } from "ts-pattern";

import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import { TypeSchema } from "~/engine/item/schema/TypeSchema";
import { isItemLocationScopeAllowedFn } from "~/engine/location/fn/isItemLocationScopeAllowedFn";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import { resolveLineInputStoreFx } from "~/engine/input/fx/resolveLineInputStoreFx";
import { isSameGridLocationFn } from "~/engine/location/fn/isSameGridLocationFn";
import { readGridLocationClaimAtFn } from "~/engine/location/fn/readGridLocationClaimAtFn";
import { readGridLocationClaimsFn } from "~/engine/location/fn/readGridLocationClaimsFn";
import { resolveMergeRuleFx } from "~/engine/merge/fx/resolveMergeRuleFx";
import type { DropItemCommand } from "~/engine/runtime/DropItemCommand";
import { isBoardRuntimeItemFn } from "~/engine/runtime/read/fn/isBoardRuntimeItemFn";
import { isGridRuntimeItemFn } from "~/engine/runtime/read/fn/isGridRuntimeItemFn";
import { readDropItemStackRejectedReasonFn } from "~/engine/runtime/read/fn/readDropItemStackRejectedReasonFn";
import { readItemStackResolutionFx } from "~/engine/runtime/read/readItemStackResolutionFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { planInventoryStorageFx } from "~/engine/runtime/fx/planInventoryStorageFx";
import { DropItemIgnoredReason } from "~/engine/runtime/DropItemResult";
import { DropItemRejectedReason } from "~/engine/runtime/DropItemResult";
import { DropItemResultKind } from "~/engine/runtime/DropItemResult";

export namespace readDropItemPreviewFx {
	export type Props = DropItemCommand;

	export type Result =
		| {
				readonly kind:
					| typeof DropItemResultKind.Move
					| typeof DropItemResultKind.Swap
					| typeof DropItemResultKind.Merge
					| typeof DropItemResultKind.StoreInventory
					| typeof DropItemResultKind.Stack;
		  }
		| {
				readonly kind: typeof DropItemResultKind.StoreInput;
				readonly lineId: string;
				readonly inputIndex: number;
				readonly quantity: number;
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

const rejected = (reason: DropItemRejectedReason): readDropItemPreviewFx.Result => ({
	kind: DropItemResultKind.Reject,
	reason,
});

/** Reads the current authoritative semantic kind of one prospective item drop without mutating runtime. */
export const readDropItemPreviewFx = Effect.fnUntraced(function* ({
	sourceItemId,
	sourceRevision,
	sourceLocation,
	target,
}: readDropItemPreviewFx.Props) {
	if (target.kind === "unsupported") {
		return rejected(DropItemRejectedReason.UnsupportedTarget);
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
		return rejected(DropItemRejectedReason.StaleSource);
	}
	const source = Option.getOrUndefined(isGridRuntimeItemFn(runtimeSource));
	if (source === undefined) {
		return rejected(DropItemRejectedReason.InvalidSource);
	}
	if (
		!isSameGridLocationFn({
			left: source.location,
			right: sourceLocation,
		})
	) {
		return rejected(DropItemRejectedReason.StaleSource);
	}
	if (target.occupant === null) {
		const claim = readGridLocationClaimAtFn({
			claims: readGridLocationClaimsFn({
				runtime,
			}).filter((candidate) => candidate.itemId !== sourceItemId),
			location: target.location,
		});
		if (claim !== undefined) {
			return rejected(DropItemRejectedReason.Occupied);
		}
		if (
			!isItemLocationScopeAllowedFn({
				item: source.item,
				locationScope: target.location.scope,
			})
		) {
			return rejected(DropItemRejectedReason.InvalidTarget);
		}
		const config = yield* GameConfigFx;
		const targetSize = match(target.location.scope)
			.with(LocationScopeEnumSchema.enum.Board, () => config.meta.board)
			.with(LocationScopeEnumSchema.enum.Inventory, () => config.meta.inventory)
			.with(LocationScopeEnumSchema.enum.Toolbar, () => ({
				width: config.meta.toolbarSize ?? 0,
				height: 1,
			}))
			.exhaustive();
		if (
			target.location.position.x >= targetSize.width ||
			target.location.position.y >= targetSize.height
		) {
			return rejected(DropItemRejectedReason.InvalidTarget);
		}
		return {
			kind: DropItemResultKind.Move,
		} satisfies readDropItemPreviewFx.Result;
	}

	const targetOccupant = target.occupant;
	const runtimeTargetItem = runtime.items.find((item) => item.id === targetOccupant.itemId);
	if (runtimeTargetItem === undefined || runtimeTargetItem.revision !== targetOccupant.revision) {
		return rejected(DropItemRejectedReason.StaleTarget);
	}
	const targetItem = Option.getOrUndefined(isGridRuntimeItemFn(runtimeTargetItem));
	if (targetItem === undefined) {
		return rejected(DropItemRejectedReason.InvalidTarget);
	}
	if (
		!isSameGridLocationFn({
			left: targetItem.location,
			right: target.location,
		})
	) {
		return rejected(DropItemRejectedReason.StaleTarget);
	}
	const boardSource = Option.getOrUndefined(isBoardRuntimeItemFn(source));
	const boardTarget = Option.getOrUndefined(isBoardRuntimeItemFn(targetItem));
	if (
		boardSource !== undefined &&
		boardTarget !== undefined &&
		boardSource.location.space !== boardTarget.location.space
	) {
		return rejected(DropItemRejectedReason.InvalidTarget);
	}
	const oneBoardItem = (boardSource === undefined) !== (boardTarget === undefined);
	const boardItem = boardSource ?? boardTarget;
	if (
		oneBoardItem &&
		boardItem !== undefined &&
		boardItem.location.space !== runtime.currentSpace
	) {
		return rejected(DropItemRejectedReason.InvalidTarget);
	}
	if (targetItem.item.type === TypeSchema.enum.Inventory) {
		if (
			source.location.scope === LocationScopeEnumSchema.enum.Inventory ||
			!isItemLocationScopeAllowedFn({
				item: source.item,
				locationScope: LocationScopeEnumSchema.enum.Inventory,
			})
		) {
			return rejected(DropItemRejectedReason.InvalidTarget);
		}
		const storagePlan = yield* planInventoryStorageFx({
			item: source,
			runtime,
		}).pipe(Effect.option);
		return Option.isSome(storagePlan)
			? {
					kind: DropItemResultKind.StoreInventory,
				}
			: rejected(DropItemRejectedReason.Blocked);
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
	const inputStore = yield* resolveLineInputStoreFx({
		lineId: target.inputStore?.lineId,
		inputIndex: target.inputStore?.inputIndex,
		owner: targetItem,
		requestedQuantity: target.inputStore?.quantity,
		runtime,
		source,
	});
	if (inputStore !== undefined) {
		return {
			kind: DropItemResultKind.StoreInput,
			lineId: inputStore.lineId,
			inputIndex: inputStore.inputIndex,
			quantity: inputStore.quantity,
		} satisfies readDropItemPreviewFx.Result;
	}
	const stackResolution = yield* readItemStackResolutionFx({
		runtime,
		sourceItemId,
		sourceRevision,
		sourceLocation,
		targetItemId: targetItem.id,
		targetRevision: targetOccupant.revision,
		targetLocation: target.location,
	});
	if (stackResolution.kind === "available") {
		return {
			kind: DropItemResultKind.Stack,
		} satisfies readDropItemPreviewFx.Result;
	}
	if (stackResolution.kind === "blocked") {
		return rejected(
			readDropItemStackRejectedReasonFn({
				reason: stackResolution.reason,
			}),
		);
	}
	const sourceScopeAllowed = isItemLocationScopeAllowedFn({
		item: source.item,
		locationScope: targetItem.location.scope,
	});
	const targetScopeAllowed = isItemLocationScopeAllowedFn({
		item: targetItem.item,
		locationScope: source.location.scope,
	});
	if (!sourceScopeAllowed || !targetScopeAllowed) {
		return rejected(DropItemRejectedReason.InvalidTarget);
	}
	return {
		kind: DropItemResultKind.Swap,
	} satisfies readDropItemPreviewFx.Result;
});
