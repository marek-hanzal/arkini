import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { DropSchema } from "~/engine/output/schema/DropSchema";
import { readQuantityMaximumFx } from "~/engine/quantity/fx/readQuantityMaximumFx";

export namespace readDropMaximumQuantitiesFx {
	export interface Props {
		drop: readonly DropSchema.Type[];
	}
}

/** Sums the largest possible quantity of each canonical item across one emitted drop group. */
export const readDropMaximumQuantitiesFx = Effect.fn("readDropMaximumQuantitiesFx")(function* ({
	drop,
}: readDropMaximumQuantitiesFx.Props) {
	const quantities = new Map<IdSchema.Type, number>();

	for (const candidate of drop) {
		const quantity = yield* readQuantityMaximumFx({
			quantity: candidate.quantity,
		});
		quantities.set(candidate.itemId, (quantities.get(candidate.itemId) ?? 0) + quantity);
	}

	return quantities;
});
