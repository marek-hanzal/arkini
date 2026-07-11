import { Effect, SynchronizedRef } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import { ItemNotFoundError } from "~/v1/item/error/ItemNotFoundError";
import type { OutputResultSchema } from "~/v1/output/schema/OutputResultSchema";
import type { DropPlacementResultSchema } from "~/v1/placement/schema/DropPlacementResultSchema";
import type { OutputPlacementResultSchema } from "~/v1/placement/schema/OutputPlacementResultSchema";
import { assertRuntimeFx } from "~/v1/runtime/check/assertRuntimeFx";
import { RuntimeStoreFx } from "~/v1/runtime/internal/RuntimeStoreFx";
import { isGridRuntimeItem } from "~/v1/runtime/read/isGridRuntimeItem";
import { applyPlacementPlanFx } from "~/v1/placement/fx/applyPlacementPlanFx";
import { planDropPlacementFx } from "~/v1/placement/fx/planDropPlacementFx";

export namespace placeOutputFx {
	export interface Props {
		originItemId: IdSchema.Type;
		output: OutputResultSchema.Type;
	}
}

/**
 * Atomically places every resolved drop from one output in authored order.
 */
export const placeOutputFx = Effect.fn("placeOutputFx")(function* ({
	originItemId,
	output,
}: placeOutputFx.Props) {
	const store = yield* RuntimeStoreFx;

	return yield* SynchronizedRef.modifyEffect(store, (runtime) => {
		return Effect.gen(function* () {
			if (output.drop.length === 0) {
				return [
					{
						drop: [],
					} satisfies OutputPlacementResultSchema.Type,
					runtime,
				] as const;
			}

			const originItem = runtime.items.find((item) => item.id === originItemId);
			if (originItem === undefined) {
				return yield* Effect.fail(
					new ItemNotFoundError({
						itemId: originItemId,
					}),
				);
			}
			if (!isGridRuntimeItem(originItem)) {
				return yield* Effect.fail(
					new ItemNotFoundError({
						itemId: originItemId,
					}),
				);
			}

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
							origin: originItem.location.position,
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

			yield* assertRuntimeFx({
				runtime: placement.draft,
			});

			return [
				{
					drop: placement.results,
				} satisfies OutputPlacementResultSchema.Type,
				placement.draft,
			] as const;
		});
	});
});
