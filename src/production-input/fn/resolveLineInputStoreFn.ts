import { Option } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import { planInputMaterialStoreFn } from "~/production-input/fn/planInputMaterialStoreFn";
import { filterInputSlotItemsFn } from "~/production-input/fn/filterInputSlotItemsFn";
import { TypeSchema } from "~/production-input/schema/TypeSchema";
import { isLineInputClosedFn } from "~/production-line/fn/isLineInputClosedFn";
import { isLineOwnerItemFn } from "~/production-line/fn/isLineOwnerItemFn";
import { readEffectiveDefaultLineFn } from "~/production-line/fn/readEffectiveDefaultLineFn";
import { readLineOwnerLinesFn } from "~/production-line/fn/readLineOwnerLinesFn";
import { isBoardRuntimeItemFn } from "~/engine/runtime/read/fn/isBoardRuntimeItemFn";
import type { GridRuntimeItemSchema } from "~/engine/runtime/schema/GridRuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace resolveLineInputStoreFn {
	export interface Props {
		readonly inputIndex?: NonNegativeIntegerSchema.Type;
		readonly lineId?: IdSchema.Type;
		readonly owner: GridRuntimeItemSchema.Type;
		readonly requestedQuantity?: PositiveIntegerSchema.Type;
		readonly runtime: RuntimeSchema.Type;
		readonly source: GridRuntimeItemSchema.Type;
	}

	export interface Result {
		readonly ownerItemId: IdSchema.Type;
		readonly lineId: IdSchema.Type;
		readonly inputIndex: number;
		readonly quantity: number;
	}
}

/**
 * Resolves the first open material input on an explicit line or the owner's save-backed default.
 *
 * Pointer drops omit an input request and may use the first compatible slot's full capacity.
 * Engine-owned commands may constrain the exact line, slot, and requested quantity while preserving
 * the same source validation and authoritative capacity recheck.
 */
export const resolveLineInputStoreFn = ({
	inputIndex: requestedInputIndex,
	lineId: requestedLineId,
	owner,
	requestedQuantity,
	runtime,
	source,
}: resolveLineInputStoreFn.Props) => {
	const lineOwnerItem = owner.item;
	if (owner.id === source.id) return undefined;
	const narrowedLineOwnerItem = Option.getOrUndefined(isLineOwnerItemFn(lineOwnerItem));
	if (narrowedLineOwnerItem === undefined) return undefined;
	const boardOwner = Option.getOrUndefined(isBoardRuntimeItemFn(owner));
	if (boardOwner === undefined) return undefined;
	const effectiveDefaultLine =
		requestedLineId === undefined
			? readEffectiveDefaultLineFn({
					ownerItemId: boardOwner.id,
					ownerItem: narrowedLineOwnerItem,
					runtime,
				})
			: undefined;
	const lineId = requestedLineId ?? effectiveDefaultLine?.id;
	if (lineId === undefined) return undefined;
	const line = readLineOwnerLinesFn(narrowedLineOwnerItem).find(
		(candidate) => candidate.id === lineId,
	);
	if (line === undefined) return undefined;

	for (const [inputIndex, input] of line.input.entries()) {
		if (requestedInputIndex !== undefined && inputIndex !== requestedInputIndex) continue;
		if (input.type !== TypeSchema.enum.Materials) continue;
		const closed = isLineInputClosedFn({
			input,
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
			requestedQuantity: requestedQuantity ?? source.quantity,
			storedQuantity: storedItems.reduce((total, item) => total + item.quantity, 0),
		});
		if (plan === undefined) continue;
		return {
			ownerItemId: boardOwner.id,
			lineId,
			inputIndex,
			quantity: plan.quantity,
		} satisfies resolveLineInputStoreFn.Result;
	}

	return undefined;
};
