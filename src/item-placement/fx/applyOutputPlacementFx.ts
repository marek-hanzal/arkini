import { Effect } from "effect";

import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import type { outputFx } from "~/production-output/fx/outputFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { applyPlacementPlanFx } from "./applyPlacementPlanFx";
import { planDropPlacementFx } from "./planDropPlacementFx";

interface ApplyOutputPlacementProps {
	readonly excludedLocations?: ReadonlyArray<GridLocationSchema.Type>;
	readonly origin: GridLocationSchema.Type;
	readonly output: outputFx.Result;
	readonly runtime: RuntimeSchema.Type;
}

interface ApplyOutputDropPlacement {
	readonly drop: outputFx.Result["drop"][number];
	readonly placement: applyPlacementPlanFx.Result;
}

export namespace applyOutputPlacementFx {
	export interface Result {
		readonly drop: ReadonlyArray<ApplyOutputDropPlacement>;
	}
}

/**
 * Applies one already resolved output to one explicit runtime draft.
 *
 * Optional excluded locations constrain every normal stack and spawn candidate
 * without changing the authored output or selecting a replacement destination.
 * Drops are planned and applied in authored result order against the evolving
 * draft, so an earlier stack or spawn consumes capacity seen by later drops.
 * This function does not publish; its enclosing runtime command owns all-or-nothing
 * commit of the complete output.
 */
export const applyOutputPlacementFx = Effect.fn("applyOutputPlacementFx")(function* ({
	excludedLocations,
	origin,
	output,
	runtime,
}: ApplyOutputPlacementProps) {
	const placement = yield* Effect.reduce(
		output.drop,
		() => ({
			draft: runtime,
			results: [] as ApplyOutputDropPlacement[],
		}),
		(state, drop) => {
			return Effect.gen(function* () {
				const plan = yield* planDropPlacementFx({
					drop,
					excludedLocations,
					origin,
					runtime: state.draft,
				});
				const [result, draft] = yield* applyPlacementPlanFx({
					plan,
					runtime: state.draft,
				});

				return {
					draft,
					results: [
						...state.results,
						{
							drop,
							placement: result,
						},
					],
				};
			});
		},
	);

	return [
		{
			drop: placement.results,
		} satisfies applyOutputPlacementFx.Result,
		placement.draft,
	] as const;
});
