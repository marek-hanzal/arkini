import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { InputDepositSchema } from "~/engine/input/schema/InputDepositSchema";
import { readItemRemainingChargesFx } from "~/engine/item/fx/readItemRemainingChargesFx";
import { queryFx } from "~/engine/query/fx/queryFx";
import { RuntimeFx } from "~/engine/runtime/context/RuntimeFx";
import { readBoardRuntimeItemByIdFx } from "~/engine/runtime/read/readBoardRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace readItemDetailDepositAvailableChargesFx {
	export interface Props {
		readonly input: InputDepositSchema.Type;
		readonly ownerItemId: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}
}

/**
 * Sums the live charge pool of every deposit matched by the authored input query.
 *
 * The query is shared with line execution, so Item Detail never approximates selector, distance,
 * space, or scope eligibility from renderer state.
 */
export const readItemDetailDepositAvailableChargesFx = Effect.fn(
	"readItemDetailDepositAvailableChargesFx",
)(function* ({ input, ownerItemId, runtime }: readItemDetailDepositAvailableChargesFx.Props) {
	const owner = yield* readBoardRuntimeItemByIdFx({
		itemId: ownerItemId,
		runtime,
	});
	const candidates = yield* queryFx({
		origin: owner.location,
		query: input.query,
	}).pipe(
		Effect.provideService(RuntimeFx, {
			read: Effect.succeed(runtime),
		}),
	);

	let availableCharges = 0;
	for (const candidate of candidates) {
		const remainingCharges = yield* readItemRemainingChargesFx(candidate);
		availableCharges += (remainingCharges ?? 0) * candidate.quantity;
	}
	return {
		availableCharges,
		candidateItemIds: candidates.map((candidate) => candidate.id),
	};
});
