import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { planInputMaterialStoreFx } from "~/engine/input/fx/planInputMaterialStoreFx";
import { resolveInputMaterialFx } from "~/engine/input/fx/resolveInputMaterialFx";
import { filterInputSlotItemsFx } from "~/engine/input/read/filterInputSlotItemsFx";
import { ItemNotOnBoardError } from "~/engine/item/error/ItemNotOnBoardError";
import { LineNotFoundError } from "~/engine/line/error/LineNotFoundError";
import { isLineInputClosedFx } from "~/engine/line/fx/input/isLineInputClosedFx";
import { readItemLineFx } from "~/engine/line/fx/readItemLineFx";
import { isBoardRuntimeItem } from "~/engine/runtime/read/isBoardRuntimeItem";
import { isGridRuntimeItem } from "~/engine/runtime/read/isGridRuntimeItem";
import { readRuntimeItemByIdFx } from "~/engine/runtime/read/readRuntimeItemByIdFx";
import type { BoardRuntimeItemSchema } from "~/engine/runtime/schema/BoardRuntimeItemSchema";
import type { GridRuntimeItemSchema } from "~/engine/runtime/schema/GridRuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import { InputEnumSchema } from "~/engine/input/schema/InputEnumSchema";

export namespace planLineInputAutofillFx {
	export interface Props {
		readonly ownerItemId: IdSchema.Type;
		readonly lineId: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}

	export interface Entry {
		readonly inputIndex: number;
		readonly sourceItemId: IdSchema.Type;
		readonly quantity: number;
	}

	export interface Result {
		readonly entry: readonly Entry[];
		readonly storedQuantity: number;
		readonly remainingMissingQuantity: number;
	}
}

const candidateRank = ({
	candidate,
	owner,
}: {
	readonly candidate: GridRuntimeItemSchema.Type;
	readonly owner: BoardRuntimeItemSchema.Type;
}) => {
	if (candidate.location.scope === LocationScopeEnumSchema.enum.Board) {
		return {
			surface: 0,
			distance:
				Math.abs(candidate.location.position.x - owner.location.position.x) +
				Math.abs(candidate.location.position.y - owner.location.position.y),
			position: candidate.location.position.y * 10_000 + candidate.location.position.x,
		};
	}

	return {
		surface: candidate.location.scope === LocationScopeEnumSchema.enum.Inventory ? 1 : 2,
		distance: 0,
		position: candidate.location.position.y * 10_000 + candidate.location.position.x,
	};
};

const compareCandidates = (owner: BoardRuntimeItemSchema.Type) => {
	return (left: GridRuntimeItemSchema.Type, right: GridRuntimeItemSchema.Type) => {
		const leftRank = candidateRank({
			candidate: left,
			owner,
		});
		const rightRank = candidateRank({
			candidate: right,
			owner,
		});

		return (
			leftRank.surface - rightRank.surface ||
			leftRank.distance - rightRank.distance ||
			leftRank.position - rightRank.position ||
			left.id.localeCompare(right.id)
		);
	};
};

/**
 * Plans deterministic automatic material delivery for one exact line.
 *
 * Board sources are limited to the owner's current space. Shared Inventory and
 * Toolbar sources remain eligible under the canonical `scope: any` meaning.
 * The plan fills only each slot's minimum missing quantity and never mutates
 * runtime truth by itself.
 */
export const planLineInputAutofillFx = Effect.fn("planLineInputAutofillFx")(function* ({
	ownerItemId,
	lineId,
	runtime,
}: planLineInputAutofillFx.Props) {
	const owner = yield* readRuntimeItemByIdFx({
		itemId: ownerItemId,
		runtime,
	});
	if (!isBoardRuntimeItem(owner)) {
		return yield* Effect.fail(
			new ItemNotOnBoardError({
				itemId: owner.id,
				location: owner.location,
			}),
		);
	}

	const line = yield* readItemLineFx({
		item: owner.item,
		lineId,
	});
	if (line === undefined) {
		return yield* Effect.fail(
			new LineNotFoundError({
				itemId: owner.id,
				lineId,
			}),
		);
	}

	const candidates = runtime.items
		.filter(
			(candidate): candidate is GridRuntimeItemSchema.Type =>
				candidate.id !== owner.id &&
				isGridRuntimeItem(candidate) &&
				(candidate.location.scope !== LocationScopeEnumSchema.enum.Board ||
					candidate.location.space === owner.location.space),
		)
		.slice()
		.sort(compareCandidates(owner));
	const remainingByItemId = new Map(
		candidates.map((candidate) => [
			candidate.id,
			candidate.quantity,
		]),
	);
	const entries: planLineInputAutofillFx.Entry[] = [];
	let remainingMissingQuantity = 0;

	for (const [inputIndex, input] of line.input.entries()) {
		if (input.type !== InputEnumSchema.enum.Materials) continue;

		const storedItems = yield* filterInputSlotItemsFx({
			inputIndex,
			items: runtime.items,
			lineId,
			ownerItemId,
		});
		let storedQuantity = storedItems.reduce((total, item) => total + item.quantity, 0);
		const initialResolution = yield* resolveInputMaterialFx({
			input,
			storedQuantity,
		});
		if (initialResolution.missingQuantity === 0) continue;

		const closed = yield* isLineInputClosedFx({
			input,
			ownerItemId,
			lineId,
			runtime,
		});
		if (closed) {
			remainingMissingQuantity += initialResolution.missingQuantity;
			continue;
		}

		let missingQuantity = initialResolution.missingQuantity;
		for (const candidate of candidates) {
			if (missingQuantity === 0) break;
			const remainingQuantity = remainingByItemId.get(candidate.id) ?? 0;
			if (remainingQuantity === 0) continue;

			const plan = yield* planInputMaterialStoreFx({
				input,
				item: {
					...candidate,
					quantity: remainingQuantity,
				},
				requestedQuantity: missingQuantity,
				storedQuantity,
			});
			if (plan === undefined) continue;

			entries.push({
				inputIndex,
				sourceItemId: candidate.id,
				quantity: plan.quantity,
			});
			remainingByItemId.set(candidate.id, remainingQuantity - plan.quantity);
			storedQuantity += plan.quantity;
			missingQuantity -= plan.quantity;
		}

		remainingMissingQuantity += missingQuantity;
	}

	return {
		entry: entries,
		storedQuantity: entries.reduce((total, entry) => total + entry.quantity, 0),
		remainingMissingQuantity,
	} satisfies planLineInputAutofillFx.Result;
});
