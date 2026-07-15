import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { readReservedJobOutputQuantitiesFx } from "./readReservedJobOutputQuantitiesFx";

export namespace readReservedJobOutputQuantityFx {
	export interface Props {
		itemId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Reads the worst-case future quantity of one canonical item reserved by active jobs. */
export const readReservedJobOutputQuantityFx = Effect.fn("readReservedJobOutputQuantityFx")(
	function* ({ itemId, runtime }: readReservedJobOutputQuantityFx.Props) {
		const reserved = yield* readReservedJobOutputQuantitiesFx({
			runtime,
		});
		return reserved.get(itemId)?.quantity ?? 0;
	},
);
