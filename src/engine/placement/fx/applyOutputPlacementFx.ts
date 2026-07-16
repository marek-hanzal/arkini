import { Effect } from "effect";

import type { BoardLocationSchema } from "~/engine/location/schema/BoardLocationSchema";
import type { OutputResultSchema } from "~/engine/output/schema/OutputResultSchema";
import type { DropPlacementResultSchema } from "~/engine/placement/schema/DropPlacementResultSchema";
import type { OutputPlacementResultSchema } from "~/engine/placement/schema/OutputPlacementResultSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { applyPlacementPlanFx } from "./applyPlacementPlanFx";
import { planDropPlacementFx } from "./planDropPlacementFx";

export namespace applyOutputPlacementFx {
	export interface Props {
		origin: BoardLocationSchema.Type;
		output: OutputResultSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Applies one already resolved output to one explicit runtime draft. */
export const applyOutputPlacementFx = Effect.fn("applyOutputPlacementFx")(function* ({
	origin,
	output,
	runtime,
}: applyOutputPlacementFx.Props) {
	const placement = yield* Effect.reduce(
		output.drop,
		{
			draft: runtime,
			results: [] as DropPlacementResultSchema.Type[],
		},
		(state, drop) => {
			return Effect.gen(function* () {
				const plan = yield* planDropPlacementFx({
					drop,
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
		} satisfies OutputPlacementResultSchema.Type,
		placement.draft,
	] as const;
});
