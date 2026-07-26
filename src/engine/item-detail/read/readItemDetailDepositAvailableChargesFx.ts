import { Effect, Option } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { InputDepositSchema } from "~/engine/input/schema/InputDepositSchema";
import { ItemNotOnBoardError } from "~/engine/item/error/ItemNotOnBoardError";
import { readItemRemainingChargesFx } from "~/engine/item/fx/readItemRemainingChargesFx";
import { queryFx } from "~/engine/query/fx/queryFx";
import { RuntimeFx } from "~/engine/runtime/context/RuntimeFx";
import { isBoardRuntimeItemFx } from "~/engine/runtime/read/isBoardRuntimeItemFx";
import { readRuntimeItemByIdFx } from "~/engine/runtime/read/readRuntimeItemByIdFx";
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
	const runtimeOwner = yield* readRuntimeItemByIdFx({
		itemId: ownerItemId,
		runtime,
	});
	const owner = Option.getOrUndefined(yield* isBoardRuntimeItemFx(runtimeOwner));
	if (owner === undefined) {
		return yield* Effect.fail(
			new ItemNotOnBoardError({
				itemId: runtimeOwner.id,
				location: runtimeOwner.location,
			}),
		);
	}
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
	return availableCharges;
});
