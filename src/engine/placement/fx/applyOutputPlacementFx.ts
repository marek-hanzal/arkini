import { Effect } from "effect";

import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { outputFx } from "~/production-output/fx/outputFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { applyPlacementPlanFx } from "./applyPlacementPlanFx";
import { planDropPlacementFx } from "./planDropPlacementFx";

export namespace applyOutputPlacementFx {
	export interface Props {
		excludedLocations?: ReadonlyArray<GridLocationSchema.Type>;
		origin: GridLocationSchema.Type;
		output: outputFx.Result;
		runtime: RuntimeSchema.Type;
	}

	export interface DropPlacement {
		readonly drop: outputFx.Result["drop"][number];
		readonly placement: applyPlacementPlanFx.Result;
	}

	export interface Result {
		readonly drop: ReadonlyArray<DropPlacement>;
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
}: applyOutputPlacementFx.Props) {
	const placement = yield* Effect.reduce(
		output.drop,
		() => ({
			draft: runtime,
			results: [] as applyOutputPlacementFx.DropPlacement[],
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
