import { Effect, Option } from "effect";

import type { ItemDetailLines } from "~/engine/item-detail/read/ItemDetailLines";
import { readBoardItemDetailLineFx } from "~/engine/item-detail/read/readBoardItemDetailLineFx";
import { readStoredItemDetailLineFx } from "~/engine/item-detail/read/readStoredItemDetailLineFx";
import { isLineOwnerItemFn } from "~/production-line/fn/isLineOwnerItemFn";
import { readEffectiveDefaultLineFn } from "~/production-line/fn/readEffectiveDefaultLineFn";
import { readLineOwnerLinesFn } from "~/production-line/fn/readLineOwnerLinesFn";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";

/** Public operation-owned aliases for the stable Item Detail Lines contract. */
export namespace readItemDetailLinesFx {
	export type Props = ItemDetailLines.Props;
	export type Input = ItemDetailLines.Input;
	export type OutputItem = ItemDetailLines.OutputItem;
	export type OutputRoll = ItemDetailLines.OutputRoll;
	export type Availability = ItemDetailLines.Availability;
	export type Result = ItemDetailLines.Result;
}

const unavailable = {
	kind: "unavailable",
} as const satisfies ItemDetailLines.Result;

/** Projects the visible read-only product lines of one exact live line owner. */
export const readItemDetailLinesFx = Effect.fn("readItemDetailLinesFx")(function* ({
	itemId,
	runtime,
}: ItemDetailLines.Props) {
	const owner = runtime.items.find((candidate) => candidate.id === itemId);
	if (owner === undefined) return unavailable;
	const ownerItem = Option.getOrUndefined(isLineOwnerItemFn(owner.item));
	if (ownerItem === undefined) return unavailable;

	const lines = readLineOwnerLinesFn(ownerItem);
	const defaultLineId = readEffectiveDefaultLineFn({
		ownerItemId: owner.id,
		ownerItem,
		runtime,
	})?.id;
	const projected: ItemDetailLines.Line[] = [];

	for (const line of lines) {
		const activeJob = runtime.jobs.find(
			(job) => job.ownerItemId === owner.id && job.lineId === line.id,
		);
		if (owner.location.scope !== LocationScopeEnumSchema.enum.Board) {
			if (!line.show && activeJob === undefined) continue;
			projected.push(
				yield* readStoredItemDetailLineFx({
					activeJob,
					line,
					ownerItemId: owner.id,
					runtime,
					isDefault: line.id === defaultLineId,
				}),
			);
			continue;
		}

		const boardLine = yield* readBoardItemDetailLineFx({
			activeJob,
			defaultLineId,
			line,
			ownerItemId: owner.id,
			runtime,
		});
		if (boardLine !== undefined) projected.push(boardLine);
	}

	const activeLineId = projected.find((line) => line.activeJob !== undefined)?.lineId;
	const visibleLineIds = new Set(projected.map((line) => line.lineId));
	const earliestQueuedLineId = runtime.jobQueue.find(
		(request) => request.ownerItemId === owner.id,
	)?.lineId;
	const queuedLineId =
		earliestQueuedLineId !== undefined && visibleLineIds.has(earliestQueuedLineId)
			? earliestQueuedLineId
			: undefined;
	const focusLineId = activeLineId ?? queuedLineId;
	return {
		kind: "available",
		itemId: owner.id,
		...(focusLineId === undefined
			? {}
			: {
					focusLineId,
				}),
		line: projected,
	} satisfies ItemDetailLines.Result;
});
