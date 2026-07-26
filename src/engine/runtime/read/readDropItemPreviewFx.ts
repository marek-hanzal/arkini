import { Effect, Option } from "effect";
import { match } from "ts-pattern";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { isItemLocationScopeAllowedFx } from "~/engine/location/read/isItemLocationScopeAllowedFx";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import { resolveLineInputStoreFx } from "~/engine/input/fx/resolveLineInputStoreFx";
import { isSameGridLocationFx } from "~/engine/location/read/isSameGridLocationFx";
import { resolveMergeRuleFx } from "~/engine/merge/fx/resolveMergeRuleFx";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { isBoardRuntimeItemFx } from "~/engine/runtime/read/isBoardRuntimeItemFx";
import { isGridRuntimeItemFx } from "~/engine/runtime/read/isGridRuntimeItemFx";
import { readDropItemStackRejectedReasonFx } from "~/engine/runtime/read/readDropItemStackRejectedReasonFx";
import { readItemStackResolutionFx } from "~/engine/runtime/read/readItemStackResolutionFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { readStoreItemInInventoryPlanFx } from "~/engine/runtime/fx/readStoreItemInInventoryPlanFx";
import { DropItemIgnoredReasonEnumSchema } from "~/engine/runtime/schema/command/DropItemIgnoredReasonEnumSchema";
import { DropItemRejectedReasonEnumSchema } from "~/engine/runtime/schema/command/DropItemRejectedReasonEnumSchema";
import { DropItemResultKindEnumSchema } from "~/engine/runtime/schema/command/DropItemResultKindEnumSchema";

export namespace readDropItemPreviewFx {
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
					readonly inputLineId?: IdSchema.Type;
			  }
			| {
					readonly kind: "unsupported";
			  };
	}

	export type Result =
		| {
				readonly kind:
					| typeof DropItemResultKindEnumSchema.enum.Move
					| typeof DropItemResultKindEnumSchema.enum.Swap
					| typeof DropItemResultKindEnumSchema.enum.Merge
					| typeof DropItemResultKindEnumSchema.enum.StoreInventory
					| typeof DropItemResultKindEnumSchema.enum.Stack;
		  }
		| {
				readonly kind: typeof DropItemResultKindEnumSchema.enum.StoreInput;
				readonly lineId: IdSchema.Type;
				readonly inputIndex: number;
				readonly quantity: number;
		  }
		| {
				readonly kind: typeof DropItemResultKindEnumSchema.enum.Ignored;
				readonly reason: DropItemIgnoredReasonEnumSchema.Type;
		  }
		| {
				readonly kind: typeof DropItemResultKindEnumSchema.enum.Reject;
				readonly reason: DropItemRejectedReasonEnumSchema.Type;
		  };
}

const rejected = (reason: DropItemRejectedReasonEnumSchema.Type): readDropItemPreviewFx.Result => ({
	kind: DropItemResultKindEnumSchema.enum.Reject,
	reason,
});

/** Reads the current authoritative semantic kind of one prospective item drop without mutating runtime. */
export const readDropItemPreviewFx = Effect.fn("readDropItemPreviewFx")(function* ({
	sourceItemId,
	sourceRevision,
	sourceLocation,
	target,
}: readDropItemPreviewFx.Props) {
	if (target.kind === "unsupported") {
		return rejected(DropItemRejectedReasonEnumSchema.enum.UnsupportedTarget);
	}
	if (
		yield* isSameGridLocationFx({
			left: sourceLocation,
			right: target.location,
		})
	) {
		return {
			kind: DropItemResultKindEnumSchema.enum.Ignored,
			reason: DropItemIgnoredReasonEnumSchema.enum.SameLocation,
		} satisfies readDropItemPreviewFx.Result;
	}
	const runtime = yield* readRuntimeFx();
	const runtimeSource = runtime.items.find((item) => item.id === sourceItemId);
	if (runtimeSource === undefined || runtimeSource.revision !== sourceRevision) {
		return rejected(DropItemRejectedReasonEnumSchema.enum.StaleSource);
	}
	const source = Option.getOrUndefined(yield* isGridRuntimeItemFx(runtimeSource));
	if (source === undefined) {
		return rejected(DropItemRejectedReasonEnumSchema.enum.InvalidSource);
	}
	if (
		!(yield* isSameGridLocationFx({
			left: source.location,
			right: sourceLocation,
		}))
	) {
		return rejected(DropItemRejectedReasonEnumSchema.enum.StaleSource);
	}
	if (target.occupant === null) {
		if (
			!(yield* isItemLocationScopeAllowedFx({
				item: source.item,
				locationScope: target.location.scope,
			}))
		) {
			return rejected(DropItemRejectedReasonEnumSchema.enum.InvalidTarget);
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
			return rejected(DropItemRejectedReasonEnumSchema.enum.InvalidTarget);
		}
		return {
			kind: DropItemResultKindEnumSchema.enum.Move,
		} satisfies readDropItemPreviewFx.Result;
	}

	const targetOccupant = target.occupant;
	const runtimeTargetItem = runtime.items.find((item) => item.id === targetOccupant.itemId);
	if (runtimeTargetItem === undefined || runtimeTargetItem.revision !== targetOccupant.revision) {
		return rejected(DropItemRejectedReasonEnumSchema.enum.StaleTarget);
	}
	const targetItem = Option.getOrUndefined(yield* isGridRuntimeItemFx(runtimeTargetItem));
	if (targetItem === undefined) {
		return rejected(DropItemRejectedReasonEnumSchema.enum.InvalidTarget);
	}
	if (
		!(yield* isSameGridLocationFx({
			left: targetItem.location,
			right: target.location,
		}))
	) {
		return rejected(DropItemRejectedReasonEnumSchema.enum.StaleTarget);
	}
	const boardSource = Option.getOrUndefined(yield* isBoardRuntimeItemFx(source));
	const boardTarget = Option.getOrUndefined(yield* isBoardRuntimeItemFx(targetItem));
	if (
		boardSource !== undefined &&
		boardTarget !== undefined &&
		boardSource.location.space !== boardTarget.location.space
	) {
		return rejected(DropItemRejectedReasonEnumSchema.enum.InvalidTarget);
	}
	const oneBoardItem = (boardSource === undefined) !== (boardTarget === undefined);
	const boardItem = boardSource ?? boardTarget;
	if (
		oneBoardItem &&
		boardItem !== undefined &&
		boardItem.location.space !== runtime.currentSpace
	) {
		return rejected(DropItemRejectedReasonEnumSchema.enum.InvalidTarget);
	}
	if (targetItem.item.type === ItemEnumSchema.enum.Inventory) {
		if (
			source.location.scope === LocationScopeEnumSchema.enum.Inventory ||
			!(yield* isItemLocationScopeAllowedFx({
				item: source.item,
				locationScope: LocationScopeEnumSchema.enum.Inventory,
			}))
		) {
			return rejected(DropItemRejectedReasonEnumSchema.enum.InvalidTarget);
		}
		const storagePlan = yield* readStoreItemInInventoryPlanFx({
			item: source,
			runtime,
		}).pipe(Effect.option);
		return Option.isSome(storagePlan)
			? {
					kind: DropItemResultKindEnumSchema.enum.StoreInventory,
				}
			: rejected(DropItemRejectedReasonEnumSchema.enum.Blocked);
	}
	if (targetItem.location.scope === LocationScopeEnumSchema.enum.Board) {
		const mergeRule = yield* resolveMergeRuleFx({
			source,
			target: targetItem,
		}).pipe(Effect.option);
		if (Option.isSome(mergeRule)) {
			return {
				kind: DropItemResultKindEnumSchema.enum.Merge,
			} satisfies readDropItemPreviewFx.Result;
		}
	}
	const inputStore = yield* resolveLineInputStoreFx({
		lineId: target.inputLineId,
		owner: targetItem,
		runtime,
		source,
	});
	if (inputStore !== undefined) {
		return {
			kind: DropItemResultKindEnumSchema.enum.StoreInput,
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
			kind: DropItemResultKindEnumSchema.enum.Stack,
		} satisfies readDropItemPreviewFx.Result;
	}
	if (stackResolution.kind === "blocked") {
		return rejected(
			yield* readDropItemStackRejectedReasonFx({
				reason: stackResolution.reason,
			}),
		);
	}
	const sourceScopeAllowed = yield* isItemLocationScopeAllowedFx({
		item: source.item,
		locationScope: targetItem.location.scope,
	});
	const targetScopeAllowed = yield* isItemLocationScopeAllowedFx({
		item: targetItem.item,
		locationScope: source.location.scope,
	});
	if (!sourceScopeAllowed || !targetScopeAllowed) {
		return rejected(DropItemRejectedReasonEnumSchema.enum.InvalidTarget);
	}
	return {
		kind: DropItemResultKindEnumSchema.enum.Swap,
	} satisfies readDropItemPreviewFx.Result;
});
