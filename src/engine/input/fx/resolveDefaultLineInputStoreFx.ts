import { Effect, Option } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { planInputMaterialStoreFx } from "~/engine/input/fx/planInputMaterialStoreFx";
import { filterInputSlotItemsFx } from "~/engine/input/read/filterInputSlotItemsFx";
import { InputEnumSchema } from "~/engine/input/schema/InputEnumSchema";
import { isLineInputClosedFx } from "~/engine/line/fx/input/isLineInputClosedFx";
import { isLineOwnerItemFx } from "~/engine/line/read/isLineOwnerItemFx";
import { readLineOwnerLinesFx } from "~/engine/line/read/readLineOwnerLinesFx";
import { isBoardRuntimeItemFx } from "~/engine/runtime/read/isBoardRuntimeItemFx";
import type { GridRuntimeItemSchema } from "~/engine/runtime/schema/GridRuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace resolveDefaultLineInputStoreFx {
	export interface Props {
		readonly owner: GridRuntimeItemSchema.Type;
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

/** Resolves the first open material input on one exact save-backed default line. */
export const resolveDefaultLineInputStoreFx = Effect.fn("resolveDefaultLineInputStoreFx")(
	function* ({ owner, runtime, source }: resolveDefaultLineInputStoreFx.Props) {
		const lineOwnerItem = owner.item;
		if (owner.id === source.id) return undefined;
		const narrowedLineOwnerItem = Option.getOrUndefined(
			yield* isLineOwnerItemFx(lineOwnerItem),
		);
		if (narrowedLineOwnerItem === undefined) return undefined;
		const boardOwner = Option.getOrUndefined(yield* isBoardRuntimeItemFx(owner));
		if (boardOwner === undefined) return undefined;
		const lineId = runtime.defaultLineByOwnerItemId?.[boardOwner.id];
		if (lineId === undefined) return undefined;
		const line = (yield* readLineOwnerLinesFx(narrowedLineOwnerItem)).find(
			(candidate) => candidate.id === lineId,
		);
		if (line === undefined) return undefined;

		for (const [inputIndex, input] of line.input.entries()) {
			if (input.type !== InputEnumSchema.enum.Materials) continue;
			const closed = yield* isLineInputClosedFx({
				input,
				ownerItemId: boardOwner.id,
				lineId,
				runtime,
			});
			if (closed) continue;
			const storedItems = yield* filterInputSlotItemsFx({
				inputIndex,
				items: runtime.items,
				lineId,
				ownerItemId: boardOwner.id,
			});
			const plan = yield* planInputMaterialStoreFx({
				input,
				item: source,
				requestedQuantity: source.quantity,
				storedQuantity: storedItems.reduce((total, item) => total + item.quantity, 0),
			});
			if (plan === undefined) continue;
			return {
				ownerItemId: boardOwner.id,
				lineId,
				inputIndex,
				quantity: plan.quantity,
			} satisfies resolveDefaultLineInputStoreFx.Result;
		}

		return undefined;
	},
);
