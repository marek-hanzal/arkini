import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { PositionSchema } from "~/v1/grid/schema/PositionSchema";
import type { OutputResultSchema } from "~/v1/output/schema/OutputResultSchema";
import type { DropPlacementResultSchema } from "~/v1/placement/schema/DropPlacementResultSchema";
import type { OutputPlacementResultSchema } from "~/v1/placement/schema/OutputPlacementResultSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { applyPlacementPlanFx } from "./applyPlacementPlanFx";
import { planDropPlacementFx } from "./planDropPlacementFx";

export namespace applyOutputPlacementFx {
	export interface Props {
		origin: PositionSchema.Type;
		originItemId: IdSchema.Type;
		output: OutputResultSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Applies one already resolved output to one explicit runtime draft. */
export const applyOutputPlacementFx = Effect.fn("applyOutputPlacementFx")(function* ({
	origin,
	originItemId,
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
					originItemId,
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
