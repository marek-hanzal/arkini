import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { isItemPureFx } from "~/engine/item/fx/purity/isItemPureFx";
import { isSameGridLocation } from "~/engine/location/read/isSameGridLocation";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { StackItemsUnavailableError } from "~/engine/runtime/error/StackItemsUnavailableError";
import { isBoardRuntimeItem } from "~/engine/runtime/read/isBoardRuntimeItem";
import { isGridRuntimeItem } from "~/engine/runtime/read/isGridRuntimeItem";
import type { GridRuntimeItemSchema } from "~/engine/runtime/schema/GridRuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace readItemStackResolutionFx {
	export interface Props {
		readonly runtime: RuntimeSchema.Type;
		readonly sourceItemId: IdSchema.Type;
		readonly sourceRevision: RevisionSchema.Type;
		readonly sourceLocation: GridLocationSchema.Type;
		readonly targetItemId: IdSchema.Type;
		readonly targetRevision: RevisionSchema.Type;
		readonly targetLocation: GridLocationSchema.Type;
	}

	export type Result =
		| {
				readonly kind: "available";
				readonly source: GridRuntimeItemSchema.Type;
				readonly target: GridRuntimeItemSchema.Type;
				readonly transferredQuantity: PositiveIntegerSchema.Type;
		  }
		| {
				readonly kind: "blocked";
				readonly reason: Exclude<
					StackItemsUnavailableError.Reason,
					typeof StackItemsUnavailableError.Reason.DifferentCanonicalItem
				>;
		  }
		| {
				readonly kind: "unrelated";
				readonly reason: typeof StackItemsUnavailableError.Reason.DifferentCanonicalItem;
		  };
}

const blocked = (
	reason: Exclude<
		StackItemsUnavailableError.Reason,
		typeof StackItemsUnavailableError.Reason.DifferentCanonicalItem
	>,
): readItemStackResolutionFx.Result => ({
	kind: "blocked",
	reason,
});

/**
 * Resolves whether two exact live grid identities can combine as one pure stack.
 *
 * The caller supplies an explicit immutable runtime snapshot so preview reads
 * and serialized writes can share this decision without sharing mutable state.
 */
export const readItemStackResolutionFx = Effect.fn("readItemStackResolutionFx")(function* ({
	runtime,
	sourceItemId,
	sourceRevision,
	sourceLocation,
	targetItemId,
	targetRevision,
	targetLocation,
}: readItemStackResolutionFx.Props) {
	if (sourceItemId === targetItemId) {
		return blocked(StackItemsUnavailableError.Reason.SameItem);
	}

	const source = runtime.items.find((item) => item.id === sourceItemId);
	if (source === undefined) {
		return blocked(StackItemsUnavailableError.Reason.SourceNotFound);
	}
	const target = runtime.items.find((item) => item.id === targetItemId);
	if (target === undefined) {
		return blocked(StackItemsUnavailableError.Reason.TargetNotFound);
	}
	if (source.revision !== sourceRevision) {
		return blocked(StackItemsUnavailableError.Reason.StaleSourceRevision);
	}
	if (target.revision !== targetRevision) {
		return blocked(StackItemsUnavailableError.Reason.StaleTargetRevision);
	}
	if (!isGridRuntimeItem(source)) {
		return blocked(StackItemsUnavailableError.Reason.SourceNotOnGrid);
	}
	if (!isGridRuntimeItem(target)) {
		return blocked(StackItemsUnavailableError.Reason.TargetNotOnGrid);
	}
	if (!isSameGridLocation(source.location, sourceLocation)) {
		return blocked(StackItemsUnavailableError.Reason.StaleSourceLocation);
	}
	if (!isSameGridLocation(target.location, targetLocation)) {
		return blocked(StackItemsUnavailableError.Reason.StaleTargetLocation);
	}

	if (
		isBoardRuntimeItem(source) &&
		isBoardRuntimeItem(target) &&
		source.location.space !== target.location.space
	) {
		return blocked(StackItemsUnavailableError.Reason.CrossSpace);
	}
	const sourceOnBoard = isBoardRuntimeItem(source);
	const targetOnBoard = isBoardRuntimeItem(target);
	const boardItem = sourceOnBoard ? source : targetOnBoard ? target : undefined;
	if (
		sourceOnBoard !== targetOnBoard &&
		boardItem !== undefined &&
		boardItem.location.space !== runtime.currentSpace
	) {
		return blocked(StackItemsUnavailableError.Reason.CrossSpace);
	}
	if (source.item.id !== target.item.id) {
		return {
			kind: "unrelated",
			reason: StackItemsUnavailableError.Reason.DifferentCanonicalItem,
		} satisfies readItemStackResolutionFx.Result;
	}

	const sourcePure = yield* isItemPureFx({
		item: source,
		runtime,
	});
	if (!sourcePure) {
		return blocked(StackItemsUnavailableError.Reason.SourceStateful);
	}
	const targetPure = yield* isItemPureFx({
		item: target,
		runtime,
	});
	if (!targetPure) {
		return blocked(StackItemsUnavailableError.Reason.TargetStateful);
	}

	const availableQuantity = target.item.maxStackSize - target.quantity;
	if (availableQuantity <= 0) {
		return blocked(StackItemsUnavailableError.Reason.TargetFull);
	}

	return {
		kind: "available",
		source,
		target,
		transferredQuantity: Math.min(
			source.quantity,
			availableQuantity,
		) satisfies PositiveIntegerSchema.Type,
	} satisfies readItemStackResolutionFx.Result;
});
