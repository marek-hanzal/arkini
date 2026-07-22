import { Effect, Option } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import { resolveDefaultLineInputStoreFx } from "~/engine/input/fx/resolveDefaultLineInputStoreFx";
import { isSameGridLocation } from "~/engine/location/read/isSameGridLocation";
import { resolveMergeRuleFx } from "~/engine/merge/fx/resolveMergeRuleFx";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { isBoardRuntimeItem } from "~/engine/runtime/read/isBoardRuntimeItem";
import { isGridRuntimeItem } from "~/engine/runtime/read/isGridRuntimeItem";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
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
					| typeof DropItemResultKindEnumSchema.enum.Merge;
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

const rejected = (
	reason: DropItemRejectedReasonEnumSchema.Type,
): readDropItemPreviewFx.Result => ({
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
	if (isSameGridLocation(sourceLocation, target.location)) {
		return {
			kind: DropItemResultKindEnumSchema.enum.Ignored,
			reason: DropItemIgnoredReasonEnumSchema.enum.SameLocation,
		} satisfies readDropItemPreviewFx.Result;
	}
	const runtime = yield* readRuntimeFx();
	const source = runtime.items.find((item) => item.id === sourceItemId);
	if (source === undefined || source.revision !== sourceRevision) {
		return rejected(DropItemRejectedReasonEnumSchema.enum.StaleSource);
	}
	if (!isGridRuntimeItem(source)) {
		return rejected(DropItemRejectedReasonEnumSchema.enum.InvalidSource);
	}
	if (!isSameGridLocation(source.location, sourceLocation)) {
		return rejected(DropItemRejectedReasonEnumSchema.enum.StaleSource);
	}
	if (target.occupant === null) {
		return {
			kind: DropItemResultKindEnumSchema.enum.Move,
		} satisfies readDropItemPreviewFx.Result;
	}

	const targetItem = runtime.items.find((item) => item.id === target.occupant.itemId);
	if (targetItem === undefined || targetItem.revision !== target.occupant.revision) {
		return rejected(DropItemRejectedReasonEnumSchema.enum.StaleTarget);
	}
	if (!isGridRuntimeItem(targetItem)) {
		return rejected(DropItemRejectedReasonEnumSchema.enum.InvalidTarget);
	}
	if (!isSameGridLocation(targetItem.location, target.location)) {
		return rejected(DropItemRejectedReasonEnumSchema.enum.StaleTarget);
	}
	if (
		isBoardRuntimeItem(source) &&
		isBoardRuntimeItem(targetItem) &&
		source.location.space !== targetItem.location.space
	) {
		return rejected(DropItemRejectedReasonEnumSchema.enum.InvalidTarget);
	}
	const oneBoardItem = isBoardRuntimeItem(source) !== isBoardRuntimeItem(targetItem);
	const boardItem = isBoardRuntimeItem(source)
		? source
		: isBoardRuntimeItem(targetItem)
			? targetItem
			: undefined;
	if (oneBoardItem && boardItem !== undefined && boardItem.location.space !== runtime.currentSpace) {
		return rejected(DropItemRejectedReasonEnumSchema.enum.InvalidTarget);
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
	const inputStore = yield* resolveDefaultLineInputStoreFx({
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
	return {
		kind: DropItemResultKindEnumSchema.enum.Swap,
	} satisfies readDropItemPreviewFx.Result;
});
