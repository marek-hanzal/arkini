import { Option } from "effect";

import { isGridRuntimeItemFn } from "~/game-runtime/read/fn/isGridRuntimeItemFn";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace readGridRuntimeItemFn {
	export interface Props {
		readonly itemId: string;
		readonly runtime: RuntimeSchema.Type | null;
	}
}

/** Reads one grid item from an optional runtime without leaking Option to cue compilers. */
export const readGridRuntimeItemFn = ({ itemId, runtime }: readGridRuntimeItemFn.Props) => {
	if (runtime === null) return null;
	const item = runtime.items.find((candidate) => candidate.id === itemId);
	if (item === undefined) return null;
	return Option.getOrNull(isGridRuntimeItemFn(item));
};
