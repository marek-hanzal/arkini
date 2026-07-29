import { Array, Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { InputDepositSchema } from "~/engine/input/schema/InputDepositSchema";
import type { InputRunResolutionSchema } from "~/engine/input/schema/run/InputRunResolutionSchema";
import { queryFx } from "~/engine/query/fx/queryFx";
import { readBoardRuntimeItemRectangleFx } from "~/engine/grid/fx/readBoardRuntimeItemRectangleFx";
import { readBoardRectangleManhattanGapFx } from "~/engine/grid/fx/readBoardRectangleManhattanGapFx";
import { RuntimeFx } from "~/engine/runtime/context/RuntimeFx";
import { isBoardRuntimeItemFx } from "~/engine/runtime/read/isBoardRuntimeItemFx";
import { readBoardRuntimeItemByIdFx } from "~/engine/runtime/read/readBoardRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { InputEnumSchema } from "~/engine/input/schema/InputEnumSchema";

import { resolveInputChargeRunFx } from "./resolveInputChargeRunFx";

export namespace resolveInputDepositRunFx {
	export interface Props {
		input: InputDepositSchema.Type;
		ownerItemId: IdSchema.Type;
		reservedCharges: ReadonlyMap<IdSchema.Type, number>;
		runtime: RuntimeSchema.Type;
	}
}

/** Selects one deterministic board target that can pay a deposit input charge cost. */
export const resolveInputDepositRunFx = Effect.fn("resolveInputDepositRunFx")(function* ({
	input,
	ownerItemId,
	reservedCharges,
	runtime,
}: resolveInputDepositRunFx.Props) {
	const owner = yield* readBoardRuntimeItemByIdFx({
		itemId: ownerItemId,
		runtime,
	});

	const ownerRectangle = yield* readBoardRuntimeItemRectangleFx({
		item: owner,
	});
	const candidates = yield* queryFx({
		origin: owner.location,
		originRectangle: ownerRectangle,
		query: input.query,
	}).pipe(
		Effect.provideService(RuntimeFx, {
			read: Effect.succeed(runtime),
		}),
	);
	const boardCandidates = yield* Effect.forEach(
		Array.getSomes(yield* Effect.forEach(candidates, isBoardRuntimeItemFx)),
		(candidate) =>
			Effect.gen(function* () {
				return {
					candidate,
					distance: yield* readBoardRectangleManhattanGapFx({
						left: ownerRectangle,
						right: yield* readBoardRuntimeItemRectangleFx({
							item: candidate,
						}),
					}),
				};
			}),
	);
	boardCandidates.sort((left, right) => {
		return (
			left.distance - right.distance ||
			left.candidate.location.position.y - right.candidate.location.position.y ||
			left.candidate.location.position.x - right.candidate.location.position.x ||
			left.candidate.id.localeCompare(right.candidate.id)
		);
	});

	for (const { candidate: target } of boardCandidates) {
		const charges = yield* resolveInputChargeRunFx({
			charges: input.charges,
			ownerItemId,
			reservedCharges,
			targetItemId: target.id,
			runtime,
		});
		if (!charges.ready || charges.plan === undefined) {
			continue;
		}

		return {
			resolution: {
				type: InputEnumSchema.enum.Deposit,
				ready: true,
				targetItemId: target.id,
			},
			plan: {
				type: InputEnumSchema.enum.Deposit,
				charges: charges.plan,
			},
		} satisfies InputRunResolutionSchema.Type;
	}

	return {
		resolution: {
			type: InputEnumSchema.enum.Deposit,
			ready: false,
		},
		plan: undefined,
	} satisfies InputRunResolutionSchema.Type;
});
