import { Array, Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import { readBoardItemLineFx } from "~/engine/line/fx/readBoardItemLineFx";
import { placeRuntimeItemFx } from "~/engine/placement/fx/placeRuntimeItemFx";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import { isInputRuntimeItemFx } from "~/engine/runtime/read/isInputRuntimeItemFx";

export namespace withdrawLineInputsFx {
	export interface Props {
		readonly ownerItemId: IdSchema.Type;
		readonly lineId: IdSchema.Type;
	}

	export interface Result {
		readonly withdrawnItemCount: number;
		readonly withdrawnQuantity: number;
	}
}

/** Atomically returns one line's buffered material roots through standard placement. */
export const withdrawLineInputsFx = Effect.fn("withdrawLineInputsFx")(function* ({
	ownerItemId,
	lineId,
}: withdrawLineInputsFx.Props) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const { owner } = yield* readBoardItemLineFx({
				ownerItemId,
				lineId,
				runtime,
			});

			const bufferedItems = Array.getSomes(
				yield* Effect.forEach(runtime.items, isInputRuntimeItemFx),
			).filter(
				(item) =>
					item.location.ownerItemId === ownerItemId && item.location.lineId === lineId,
			);
			let draft = runtime;
			const events: GameEventSchema.Type[] = [];
			for (const bufferedItem of bufferedItems) {
				const placement = yield* placeRuntimeItemFx({
					itemId: bufferedItem.id,
					origin: owner.location,
					originItemId: owner.id,
					runtime: draft,
				});
				events.push(...placement.events);
				draft = placement.runtime;
			}

			return [
				{
					withdrawnItemCount: bufferedItems.length,
					withdrawnQuantity: bufferedItems.reduce(
						(total, item) => total + item.quantity,
						0,
					),
				} satisfies withdrawLineInputsFx.Result,
				draft,
				events,
			] as const;
		}),
	);
});
