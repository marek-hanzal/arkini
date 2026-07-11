import { Effect } from "effect";

import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import type { StateSchema } from "~/v1/state/schema/StateSchema";
import { fromRuntimeItemFx } from "./fromRuntimeItemFx";

export namespace fromRuntimeFx {
	export interface Props {
		runtime: RuntimeSchema.Type;
	}
}

/**
 * Builds serializable state from the core runtime using canonical item IDs.
 *
 * Counterpart: `fromStateFx` in `~/v1/runtime/fx/fromStateFx` builds the
 * runtime from this state.
 */
export const fromRuntimeFx = Effect.fn("fromRuntimeFx")(function* ({
	runtime,
}: fromRuntimeFx.Props) {
	const boardCells = yield* Effect.forEach(
		Object.entries(runtime.board.cells),
		([cell, item]) => {
			return fromRuntimeItemFx({
				item,
			}).pipe(
				Effect.map((state) => {
					return [
						cell,
						state,
					] as const;
				}),
			);
		},
	);
	const inventoryCells = yield* Effect.forEach(
		Object.entries(runtime.inventory.cells),
		([cell, item]) => {
			return fromRuntimeItemFx({
				item,
			}).pipe(
				Effect.map((state) => {
					return [
						cell,
						state,
					] as const;
				}),
			);
		},
	);
	const result = {
		board: {
			cells: Object.fromEntries(boardCells),
		},
		inventory: {
			cells: Object.fromEntries(inventoryCells),
		},
	};

	return result satisfies StateSchema.Type;
});
