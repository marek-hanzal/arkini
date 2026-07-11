import { Effect, Ref } from "effect";
import { match } from "ts-pattern";

import type { NonNegativeIntegerSchema } from "~/v1/common/schema/NonNegativeIntegerSchema";
import { ItemNotFoundError } from "~/v1/item/error/ItemNotFoundError";
import { RuntimeFx } from "~/v1/runtime/context/RuntimeFx";
import type { ScopeEnumSchema } from "~/v1/scope/schema/ScopeEnumSchema";

export namespace getItemFx {
	export interface Props {
		scope: Exclude<ScopeEnumSchema.Type, "any">;
		x: NonNegativeIntegerSchema.Type;
		y: NonNegativeIntegerSchema.Type;
	}
}

/**
 * Reads one item from a concrete runtime grid cell.
 *
 * The cell record key is derived from `x` and `y`; callers never construct or
 * parse the storage key themselves.
 */
export const getItemFx = Effect.fn("getItemFx")(function* ({ scope, x, y }: getItemFx.Props) {
	const runtimeRef = yield* RuntimeFx;
	const runtime = yield* Ref.get(runtimeRef);
	const key = `${x}:${y}`;
	const item = match(scope)
		.with("board", () => {
			return runtime.board.cells[key];
		})
		.with("inventory", () => {
			return runtime.inventory.cells[key];
		})
		.exhaustive();

	if (item === undefined) {
		return yield* Effect.fail(
			new ItemNotFoundError({
				scope,
				x,
				y,
			}),
		);
	}

	return item;
});
