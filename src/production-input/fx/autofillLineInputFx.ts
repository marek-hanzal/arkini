import { Effect } from "effect";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";
import { assertItemProductionPlayerControlFx } from "~/production-line/fx/assertItemProductionPlayerControlFx";
import { readBoardItemLineFx } from "~/production-line/fx/readBoardItemLineFx";
import { isItemProductionAdmissionOpenFn } from "~/production-line/fn/isItemProductionAdmissionOpenFn";
import { isLineInputClosedFn } from "~/production-line/fn/isLineInputClosedFn";
import { LineInputClosedError } from "~/production-line/error/LineInputClosedError";
import { ItemProductionControlUnavailableError } from "~/production-line/error/ItemProductionControlUnavailableError";
import { LineInputNotEmptyError } from "~/production-input/error/LineInputNotEmptyError";
import { filterInputSlotItemsFn } from "~/production-input/fn/filterInputSlotItemsFn";
import { readItemMaterialInputFx } from "~/production-input/fx/readItemMaterialInputFx";
import { autofillLineInputsRuntimeFx } from "~/production-input/fx/autofillLineInputsRuntimeFx";

export namespace autofillLineInputFx {
	export interface Props {
		readonly ownerItemId: IdSchema.Type;
		readonly lineId: IdSchema.Type;
		readonly inputIndex: number;
	}
}

/** Fills one empty slot through ordinary delivery, without creating production intent. */
export const autofillLineInputFx = Effect.fn("autofillLineInputFx")(function* (
	props: autofillLineInputFx.Props,
) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			yield* assertItemProductionPlayerControlFx({
				ownerItemId: props.ownerItemId,
				runtime,
			});
			const { owner } = yield* readBoardItemLineFx({
				...props,
				runtime,
			});
			yield* readItemMaterialInputFx({
				...props,
				item: owner.item,
			});
			if (!isItemProductionAdmissionOpenFn(owner))
				return yield* Effect.fail(
					new ItemProductionControlUnavailableError({
						ownerItemId: owner.id,
						reason: "expired",
					}),
				);
			if (
				isLineInputClosedFn({
					...props,
					runtime,
				})
			)
				return yield* Effect.fail(new LineInputClosedError(props));
			if (
				filterInputSlotItemsFn({
					...props,
					items: runtime.items,
				}).length > 0
			)
				return yield* Effect.fail(new LineInputNotEmptyError(props));
			const autofill = yield* autofillLineInputsRuntimeFx({
				...props,
				runtime,
			});
			return [
				autofill.result.scheduledQuantity,
				autofill.runtime,
				autofill.events,
			] as const;
		}),
	);
});
