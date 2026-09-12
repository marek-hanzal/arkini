import { Array, Effect, Option } from "effect";

import { resolveActionUnitFx } from "~/production-action/fx/resolveActionUnitFx";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { InputRun } from "~/production-input/type/InputRun";
import type { UnitsSchema } from "~/production-input/schema/UnitsSchema";
import { TypeSchema } from "~/production-input/schema/TypeSchema";
import { queryFx } from "~/item-query/fx/queryFx";
import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";
import { narrowBoardRuntimeItemFn } from "~/game-runtime/fn/narrowBoardRuntimeItemFn";
import { readRuntimeItemByIdFx } from "~/game-runtime/fx/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

const compareTargetFn = (
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
export const resolveActionUnitsInputFx = Effect.fn("resolveActionUnitsInputFx")(function* ({
	input,
	ownerItemId,
	reservedUnits,
	runtime,
}: {
	readonly input: UnitsSchema.Type;
	readonly ownerItemId: IdSchema.Type;
	readonly reservedUnits: ReadonlyMap<IdSchema.Type, number>;
	readonly runtime: RuntimeSchema.Type;
}) {
	const runtimeOwner = yield* readRuntimeItemByIdFx({
		itemId: ownerItemId,
		runtime,
	});
	const owner = Option.getOrUndefined(narrowBoardRuntimeItemFn(runtimeOwner));
	if (owner === undefined) {
		return {
			resolution: {
				type: TypeSchema.enum.Units,
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
	const boardCandidates = Array.getSomes(candidates.map(narrowBoardRuntimeItemFn)).sort(
		(left, right) => compareTargetFn(owner.location.position, left, right),
	);

	for (const target of boardCandidates) {
		const units = yield* resolveActionUnitFx({
			units: input.units,
			ownerItemId,
			reservedUnits,
			targetItemId: target.id,
			runtime,
		});
		if (!units.ready || units.plan === undefined) continue;
		return {
			resolution: {
				type: TypeSchema.enum.Units,
				ready: true,
				targetItemId: target.id,
			},
			plan: {
				type: TypeSchema.enum.Units,
				units: units.plan,
			},
		} satisfies InputRun.Resolution;
	}

	return {
		resolution: {
			type: TypeSchema.enum.Units,
			ready: false,
		},
		plan: undefined,
	} satisfies InputRun.Resolution;
});
