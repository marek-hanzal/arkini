import { Effect, Option } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { InputMaterialUnavailableError } from "~/engine/input/error/InputMaterialUnavailableError";
import { readBoardItemLineFx } from "~/engine/line/fx/readBoardItemLineFx";
import { placeRuntimeItemFx } from "~/engine/placement/fx/placeRuntimeItemFx";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { assertRevisionFx } from "~/engine/revision/fx/assertRevisionFx";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import { isInputRuntimeItemFx } from "~/engine/runtime/read/isInputRuntimeItemFx";
import { readRuntimeItemByIdFx } from "~/engine/runtime/read/readRuntimeItemByIdFx";

export namespace withdrawLineInputItemFx {
	export interface Props {
		readonly itemId: IdSchema.Type;
		readonly itemRevision: RevisionSchema.Type;
		readonly ownerItemId: IdSchema.Type;
		readonly lineId: IdSchema.Type;
	}

	export interface Result {
		readonly itemId: IdSchema.Type;
		readonly withdrawnQuantity: number;
	}
}

/** Atomically returns one exact buffered runtime root through standard placement. */
export const withdrawLineInputItemFx = Effect.fn("withdrawLineInputItemFx")(function* ({
	itemId,
	itemRevision,
	ownerItemId,
	lineId,
}: withdrawLineInputItemFx.Props) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const { owner } = yield* readBoardItemLineFx({
				ownerItemId,
				lineId,
				runtime,
			});
			const runtimeItem = yield* readRuntimeItemByIdFx({
				itemId,
				runtime,
			});
			yield* assertRevisionFx({
				actualRevision: runtimeItem.revision,
				entityId: itemId,
				expectedRevision: itemRevision,
			});
			const inputItem = Option.getOrUndefined(yield* isInputRuntimeItemFx(runtimeItem));
			if (
				inputItem === undefined ||
				inputItem.location.ownerItemId !== ownerItemId ||
				inputItem.location.lineId !== lineId
			) {
				return yield* Effect.fail(
					new InputMaterialUnavailableError({
						ownerItemId,
						lineId,
						inputIndex: inputItem?.location.inputIndex ?? 0,
						sourceItemId: itemId,
					}),
				);
			}
			const placement = yield* placeRuntimeItemFx({
				itemId: inputItem.id,
				origin: owner.location,
				originItemId: owner.id,
				runtime,
			});
			return [
				{
					itemId: inputItem.id,
					withdrawnQuantity: inputItem.quantity,
				} satisfies withdrawLineInputItemFx.Result,
				placement.runtime,
				placement.events,
			] as const;
		}),
	);
});
