import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { InputDepositSchema } from "~/engine/input/schema/InputDepositSchema";
import type { InputRunResolutionSchema } from "~/engine/input/schema/run/InputRunResolutionSchema";
import { ItemNotOnBoardError } from "~/engine/item/error/ItemNotOnBoardError";
import { queryFx } from "~/engine/query/fx/queryFx";
import { RuntimeFx } from "~/engine/runtime/context/RuntimeFx";
import { isBoardRuntimeItem } from "~/engine/runtime/read/isBoardRuntimeItem";
import { readRuntimeItemByIdFx } from "~/engine/runtime/read/readRuntimeItemByIdFx";
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

const compareTarget = (
	origin: {
		x: number;
		y: number;
	},
	left: {
		id: string;
		location: {
			position: {
				x: number;
				y: number;
			};
		};
	},
	right: {
		id: string;
		location: {
			position: {
				x: number;
				y: number;
			};
		};
	},
) => {
	const leftDistance =
		Math.abs(left.location.position.x - origin.x) +
		Math.abs(left.location.position.y - origin.y);
	const rightDistance =
		Math.abs(right.location.position.x - origin.x) +
		Math.abs(right.location.position.y - origin.y);

	return (
		leftDistance - rightDistance ||
		left.location.position.y - right.location.position.y ||
		left.location.position.x - right.location.position.x ||
		left.id.localeCompare(right.id)
	);
};

/** Selects one deterministic board target that can pay a deposit input charge cost. */
export const resolveInputDepositRunFx = Effect.fn("resolveInputDepositRunFx")(function* ({
	input,
	ownerItemId,
	reservedCharges,
	runtime,
}: resolveInputDepositRunFx.Props) {
	const owner = yield* readRuntimeItemByIdFx({
		itemId: ownerItemId,
		runtime,
	});
	if (!isBoardRuntimeItem(owner)) {
		return yield* Effect.fail(
			new ItemNotOnBoardError({
				itemId: owner.id,
				location: owner.location,
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
	const boardCandidates = candidates
		.filter(isBoardRuntimeItem)
		.sort((left, right) => compareTarget(owner.location.position, left, right));

	for (const target of boardCandidates) {
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
