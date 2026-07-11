import { Effect } from "effect";

import { GameConfigFx } from "~/v1/game/context/GameConfigFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import type { StateSchema } from "~/v1/state/schema/StateSchema";
import { fromStateItemFx } from "./fromStateItemFx";

export namespace fromStateFx {
	export interface Props {
		state: StateSchema.Type;
	}
}

/**
 * Builds the core runtime from serializable state and canonical game items.
 *
 * Counterpart: `fromRuntimeFx` in `~/v1/state/fx/fromRuntimeFx` builds
 * serializable state from this runtime.
 */
export const fromStateFx = Effect.fn("fromStateFx")(function* ({ state }: fromStateFx.Props) {
	const config = yield* GameConfigFx;
	const boardCells = yield* Effect.forEach(Object.entries(state.board.cells), ([cell, state]) => {
		return fromStateItemFx({
			scope: "board",
			state,
		}).pipe(
			Effect.map((item) => {
				return [
					cell,
					item,
				] as const;
			}),
		);
	});
	const inventoryCells = yield* Effect.forEach(
		Object.entries(state.inventory.cells),
		([cell, state]) => {
			return fromStateItemFx({
				scope: "inventory",
				state,
			}).pipe(
				Effect.map((item) => {
					return [
						cell,
						item,
					] as const;
				}),
			);
		},
	);
	const result = {
		config,
		board: {
			cells: Object.fromEntries(boardCells),
		},
		inventory: {
			cells: Object.fromEntries(inventoryCells),
		},
	};

	return result satisfies RuntimeSchema.Type;
});
