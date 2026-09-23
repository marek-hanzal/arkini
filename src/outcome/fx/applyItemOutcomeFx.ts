import { Effect } from "effect";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import type { ResolvedOutcome } from "~/outcome/type/ResolvedOutcome";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { PlacementSchema } from "~/item-placement/schema/PlacementSchema";
import { applyPlacementPlanFn } from "~/item-placement/fn/applyPlacementPlanFn";
import type { PlacementPlan } from "~/item-placement/type/PlacementPlan";
import { planDropPlacementFx } from "~/item-placement/fx/planDropPlacementFx";
import { planBestEffortDropPlacementFx } from "~/item-placement/fx/planBestEffortDropPlacementFx";

export namespace applyItemOutcomeFx {
	export interface Props {
		readonly drop: ResolvedOutcome.Item;
		readonly overflow?: "discard";
		readonly origin: BoardLocationSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}
	export interface Placement {
		readonly outcome: ResolvedOutcome.Item;
		readonly placement: PlacementPlan;
	}
}

/** Item settlement owns placement and its explicit overflow policy. */
export const applyItemOutcomeFx = Effect.fn("applyItemOutcomeFx")(function* ({
	drop,
	overflow,
	origin,
	runtime,
}: applyItemOutcomeFx.Props) {
	const usesRandomBoardPlacement = drop.placement === PlacementSchema.enum.Random;
	const drops =
		usesRandomBoardPlacement && drop.quantity > 1
			? Array.from(
					{
						length: drop.quantity,
					},
					() => ({
						...drop,
						quantity: 1 as const,
					}),
				)
			: [
					drop,
				];
	const placement = yield* Effect.reduce(
		drops,
		() => ({
			draft: runtime,
			results: [] as PlacementPlan[],
			discarded: [] as planBestEffortDropPlacementFx.Discarded[],
		}),
		(state, resolvedDrop) =>
			Effect.gen(function* () {
				const props = {
					drop: resolvedDrop,
					origin,
					runtime: state.draft,
				};
				const planned =
					overflow === "discard"
						? yield* planBestEffortDropPlacementFx(props)
						: {
								plan: yield* planDropPlacementFx(props),
								discarded: [],
							};

				const draft = applyPlacementPlanFn({
					plan: planned.plan,
					runtime: state.draft,
				});
				return {
					draft,
					discarded: [
						...state.discarded,
						...planned.discarded,
					],
					results: [
						...state.results,
						planned.plan,
					],
				};
			}),
	);

	return [
		{
			outcome: drop,
			placement: {
				spawn: placement.results.flatMap(({ spawn }) => spawn),
			},
		} satisfies applyItemOutcomeFx.Placement,
		placement.draft,
		placement.discarded,
	] as const;
});
