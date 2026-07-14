import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { readJobMaximumOutputQuantitiesFx } from "./readJobMaximumOutputQuantitiesFx";

export namespace readReservedJobOutputQuantityFx {
	export interface Props {
		itemId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Sums the worst-case future quantity of one canonical item reserved by active jobs. */
export const readReservedJobOutputQuantityFx = Effect.fn("readReservedJobOutputQuantityFx")(
	function* ({ itemId, runtime }: readReservedJobOutputQuantityFx.Props) {
		let quantity = 0;
		for (const job of runtime.jobs) {
			const quantities = yield* readJobMaximumOutputQuantitiesFx({
				job,
				runtime,
			});
			quantity += quantities.get(itemId) ?? 0;
		}

		return quantity;
	},
);
