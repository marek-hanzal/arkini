import { Option } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import { isItemPureFn } from "~/game-runtime/read/fn/isItemPureFn";
import { isSameGridLocationFn } from "~/item-location/fn/isSameGridLocationFn";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import type { PositiveIntegerSchema } from "~/game-config/schema/PositiveIntegerSchema";
import type { RevisionSchema } from "~/item-revision/schema/RevisionSchema";
import { StackItemsUnavailableError } from "~/item-interaction/error/StackItemsUnavailableError";
import { isBoardRuntimeItemFn } from "~/game-runtime/read/fn/isBoardRuntimeItemFn";
import { isGridRuntimeItemFn } from "~/game-runtime/read/fn/isGridRuntimeItemFn";
import type { GridRuntimeItemSchema } from "~/game-runtime/schema/GridRuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace readItemStackResolutionFn {
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

const blockedFn = (
	reason: Exclude<
		StackItemsUnavailableError.Reason,
		typeof StackItemsUnavailableError.Reason.DifferentCanonicalItem
	>,
): readItemStackResolutionFn.Result => ({
	kind: "blocked",
	reason,
});

/**
 * Resolves whether two exact live grid identities can combine as one pure stack.
 *
 * The caller supplies an explicit immutable runtime snapshot so preview reads
 * and serialized writes can share this decision without sharing mutable state.
 */
export const readItemStackResolutionFn = ({
	runtime,
	sourceItemId,
	sourceRevision,
	sourceLocation,
	targetItemId,
	targetRevision,
	targetLocation,
}: readItemStackResolutionFn.Props) => {
	if (sourceItemId === targetItemId) {
		return blockedFn(StackItemsUnavailableError.Reason.SameItem);
	}

	const runtimeSource = runtime.items.find((item) => item.id === sourceItemId);
	if (runtimeSource === undefined) {
		return blockedFn(StackItemsUnavailableError.Reason.SourceNotFound);
	}
	const runtimeTarget = runtime.items.find((item) => item.id === targetItemId);
	if (runtimeTarget === undefined) {
		return blockedFn(StackItemsUnavailableError.Reason.TargetNotFound);
	}
	if (runtimeSource.revision !== sourceRevision) {
		return blockedFn(StackItemsUnavailableError.Reason.StaleSourceRevision);
	}
	if (runtimeTarget.revision !== targetRevision) {
		return blockedFn(StackItemsUnavailableError.Reason.StaleTargetRevision);
	}
	const source = Option.getOrUndefined(isGridRuntimeItemFn(runtimeSource));
	if (source === undefined) {
		return blockedFn(StackItemsUnavailableError.Reason.SourceNotOnGrid);
	}
	const target = Option.getOrUndefined(isGridRuntimeItemFn(runtimeTarget));
	if (target === undefined) {
		return blockedFn(StackItemsUnavailableError.Reason.TargetNotOnGrid);
	}
	if (
		!isSameGridLocationFn({
			left: source.location,
			right: sourceLocation,
		})
	) {
		return blockedFn(StackItemsUnavailableError.Reason.StaleSourceLocation);
	}
	if (
		!isSameGridLocationFn({
			left: target.location,
			right: targetLocation,
		})
	) {
		return blockedFn(StackItemsUnavailableError.Reason.StaleTargetLocation);
	}

	const boardSource = Option.getOrUndefined(isBoardRuntimeItemFn(source));
	const boardTarget = Option.getOrUndefined(isBoardRuntimeItemFn(target));
	if (
		boardSource !== undefined &&
		boardTarget !== undefined &&
		boardSource.location.space !== boardTarget.location.space
	) {
		return blockedFn(StackItemsUnavailableError.Reason.CrossSpace);
	}
	const sourceOnBoard = boardSource !== undefined;
	const targetOnBoard = boardTarget !== undefined;
	const boardItem = boardSource ?? boardTarget;
	if (
		sourceOnBoard !== targetOnBoard &&
		boardItem !== undefined &&
		boardItem.location.space !== runtime.currentSpace
	) {
		return blockedFn(StackItemsUnavailableError.Reason.CrossSpace);
	}
	if (source.item.id !== target.item.id) {
		return {
			kind: "unrelated",
			reason: StackItemsUnavailableError.Reason.DifferentCanonicalItem,
		} satisfies readItemStackResolutionFn.Result;
	}

	const sourcePure = isItemPureFn({
		item: source,
		runtime,
	});
	if (!sourcePure) {
		return blockedFn(StackItemsUnavailableError.Reason.SourceStateful);
	}
	const targetPure = isItemPureFn({
		item: target,
		runtime,
	});
	if (!targetPure) {
		return blockedFn(StackItemsUnavailableError.Reason.TargetStateful);
	}

	const availableQuantity = target.item.maxStackSize - target.quantity;
	if (availableQuantity <= 0) {
		return blockedFn(StackItemsUnavailableError.Reason.TargetFull);
	}

	return {
		kind: "available",
		source,
		target,
		transferredQuantity: Math.min(
			source.quantity,
			availableQuantity,
		) satisfies PositiveIntegerSchema.Type,
	} satisfies readItemStackResolutionFn.Result;
};
