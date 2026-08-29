import { Array, Effect, Option } from "effect";

import { resolveActionChargeFx } from "~/engine/action/fx/resolveActionChargeFx";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { InputRun } from "~/engine/input/InputRun";
import type { DepositSchema } from "~/engine/input/schema/DepositSchema";
import { TypeSchema } from "~/engine/input/schema/TypeSchema";
import { queryFx } from "~/engine/query/fx/queryFx";
import { RuntimeFx } from "~/engine/runtime/context/RuntimeFx";
import { isBoardRuntimeItemFn } from "~/engine/runtime/read/fn/isBoardRuntimeItemFn";
import { readRuntimeItemByIdFx } from "~/engine/runtime/read/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

const compareTarget = (
	origin: {
		readonly x: number;
		readonly y: number;
	},
	left: {
		readonly id: string;
		readonly location: {
			readonly position: {
				readonly x: number;
				readonly y: number;
			};
		};
	},
	right: {
		readonly id: string;
		readonly location: {
			readonly position: {
				readonly x: number;
				readonly y: number;
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

/** Selects one deterministic Board payer, or stays unavailable without a real Board origin. */
export const resolveActionDepositInputFx = Effect.fn("resolveActionDepositInputFx")(function* ({
	input,
	ownerItemId,
	reservedCharges,
	runtime,
}: {
	readonly input: DepositSchema.Type;
	readonly ownerItemId: IdSchema.Type;
	readonly reservedCharges: ReadonlyMap<IdSchema.Type, number>;
	readonly runtime: RuntimeSchema.Type;
}) {
	const runtimeOwner = yield* readRuntimeItemByIdFx({
		itemId: ownerItemId,
		runtime,
	});
	const owner = Option.getOrUndefined(isBoardRuntimeItemFn(runtimeOwner));
	if (owner === undefined) {
		return {
			resolution: {
				type: TypeSchema.enum.Deposit,
				ready: false,
			},
			plan: undefined,
		} satisfies InputRun.Resolution;
	}

	const candidates = yield* queryFx({
		origin: owner.location,
		query: input.query,
	}).pipe(
		Effect.provideService(RuntimeFx, {
			read: Effect.succeed(runtime),
		}),
	);
	const boardCandidates = Array.getSomes(candidates.map(isBoardRuntimeItemFn)).sort(
		(left, right) => compareTarget(owner.location.position, left, right),
	);

	for (const target of boardCandidates) {
		const charges = yield* resolveActionChargeFx({
			charges: input.charges,
			ownerItemId,
			reservedCharges,
			targetItemId: target.id,
			runtime,
		});
		if (!charges.ready || charges.plan === undefined) continue;
		return {
			resolution: {
				type: TypeSchema.enum.Deposit,
				ready: true,
				targetItemId: target.id,
			},
			plan: {
				type: TypeSchema.enum.Deposit,
				charges: charges.plan,
			},
		} satisfies InputRun.Resolution;
	}

	return {
		resolution: {
			type: TypeSchema.enum.Deposit,
			ready: false,
		},
		plan: undefined,
	} satisfies InputRun.Resolution;
});
