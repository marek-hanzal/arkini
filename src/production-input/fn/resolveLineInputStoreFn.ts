import { canControlItemProductionFn } from "~/production-line/fn/canControlItemProductionFn";
import { Option } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";
import { planInputMaterialStoreFn } from "~/production-input/fn/planInputMaterialStoreFn";
import { filterInputSlotItemsFn } from "~/production-input/fn/filterInputSlotItemsFn";
import { TypeSchema } from "~/production-input/schema/TypeSchema";
import { isLineInputClosedFn } from "~/production-line/fn/isLineInputClosedFn";
import { narrowLineOwnerItemFn } from "~/production-line/fn/narrowLineOwnerItemFn";
import { readEffectiveLineFn } from "~/production-line/fn/readEffectiveLineFn";
import { narrowBoardRuntimeItemFn } from "~/game-runtime/fn/narrowBoardRuntimeItemFn";
import type { BoardRuntimeItemSchema } from "~/game-runtime/schema/BoardRuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace resolveLineInputStoreFn {
	export interface Props {
		readonly inputIndex?: NonNegativeIntegerSchema.Type;
		readonly lineId?: IdSchema.Type;
		readonly owner: BoardRuntimeItemSchema.Type;
		readonly runtime: RuntimeSchema.Type;
		readonly source: BoardRuntimeItemSchema.Type;
	}

	export interface Result {
		readonly ownerItemId: IdSchema.Type;
		readonly lineId: IdSchema.Type;
		readonly inputIndex: number;
	}
}

/**
 * Resolves the first open material input on an explicit line or the owner's save-backed default.
 *
 * Pointer drops omit an input request and use the first compatible slot with capacity.
 * Engine-owned commands may constrain the exact line and slot while preserving
 * the same source validation and authoritative capacity recheck.
 */
export const resolveLineInputStoreFn = ({
	inputIndex: requestedInputIndex,
	lineId: requestedLineId,
	owner,
	runtime,
	source,
}: resolveLineInputStoreFn.Props) => {
	const lineOwnerItem = owner.item;
	if (owner.id === source.id || !canControlItemProductionFn(owner.item)) return undefined;
	const narrowedLineOwnerItem = Option.getOrUndefined(narrowLineOwnerItemFn(lineOwnerItem));
	if (narrowedLineOwnerItem === undefined) return undefined;
	const boardOwner = Option.getOrUndefined(narrowBoardRuntimeItemFn(owner));
	if (boardOwner === undefined) return undefined;
	const effectiveDefaultLine =
		requestedLineId === undefined
			? readEffectiveLineFn({
					ownerItemId: boardOwner.id,
					ownerItem: narrowedLineOwnerItem,
					runtime,
				})
			: undefined;
	const lineId = requestedLineId ?? effectiveDefaultLine?.id;
	if (lineId === undefined) return undefined;
	const line = narrowedLineOwnerItem.lines.find((candidate) => candidate.id === lineId);
	if (line === undefined) return undefined;

	for (const [inputIndex, input] of line.input.entries()) {
		if (requestedInputIndex !== undefined && inputIndex !== requestedInputIndex) continue;
		if (input.type !== TypeSchema.enum.Materials) continue;
		const closed = isLineInputClosedFn({
			ownerItemId: boardOwner.id,
			lineId,
			runtime,
		});
		if (closed) continue;
		const storedItems = filterInputSlotItemsFn({
			inputIndex,
			items: runtime.items,
			lineId,
			ownerItemId: boardOwner.id,
		});
		const plan = planInputMaterialStoreFn({
			input,
			item: source,
			storedQuantity: storedItems.length,
		});
		if (plan === undefined) continue;
		return {
			ownerItemId: boardOwner.id,
			lineId,
			inputIndex,
		} satisfies resolveLineInputStoreFn.Result;
	}

	return undefined;
};
