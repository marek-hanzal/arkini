import { Effect, Ref } from "effect";
import { match } from "ts-pattern";

import type { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";
import { RuntimeFx } from "~/v1/runtime/context/RuntimeFx";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import type { ScopeEnumSchema } from "~/v1/scope/schema/ScopeEnumSchema";

export namespace setItemFx {
	export interface Props {
		item: RuntimeItemSchema.Type;
		scope: Exclude<ScopeEnumSchema.Type, "any">;
		x: NonNegativeIntegerSchema.Type;
		y: NonNegativeIntegerSchema.Type;
	}
}

/**
 * Writes one item to a concrete runtime grid cell through an atomic update.
 *
 * The cell record key and the item's own coordinates are always derived from
 * the same `x` and `y` input so both representations remain synchronized.
 */
export const setItemFx = Effect.fn("setItemFx")(function* ({ item, scope, x, y }: setItemFx.Props) {
	const runtimeRef = yield* RuntimeFx;
	const key = `${x}:${y}`;
	const placedItem = {
		...item,
		x,
		y,
	} satisfies RuntimeItemSchema.Type;

	yield* Ref.update(runtimeRef, (runtime) => {
		return match(scope)
			.with("board", () => {
				return {
					...runtime,
					board: {
						...runtime.board,
						cells: {
							...runtime.board.cells,
							[key]: placedItem,
						},
					},
				};
			})
			.with("inventory", () => {
				return {
					...runtime,
					inventory: {
						...runtime.inventory,
						cells: {
							...runtime.inventory.cells,
							[key]: placedItem,
						},
					},
				};
			})
			.exhaustive();
	});

	return placedItem;
});
