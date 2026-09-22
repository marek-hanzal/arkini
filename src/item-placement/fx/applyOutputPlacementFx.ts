import { planBestEffortDropPlacementFx } from "~/item-placement/fx/planBestEffortDropPlacementFx";
import { Effect } from "effect";

import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import type { outputFx } from "~/production-output/fx/outputFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { PlacementSchema } from "~/item-placement/schema/PlacementSchema";
import { applyPlacementPlanFx } from "./applyPlacementPlanFx";
import { planDropPlacementFx } from "./planDropPlacementFx";

interface ApplyOutputPlacementProps {
	readonly overflow?: "discard";
	readonly excludedLocations?: ReadonlyArray<BoardLocationSchema.Type>;
	readonly origin: BoardLocationSchema.Type;
	readonly output: outputFx.Result;
	readonly runtime: RuntimeSchema.Type;
}

interface ApplyOutputDropPlacement {
	readonly drop: outputFx.Result["drop"][number];
	readonly placement: applyPlacementPlanFx.Result;
}

export namespace applyOutputPlacementFx {
	export interface Result {
		readonly discarded?: readonly planBestEffortDropPlacementFx.Discarded[];
		readonly drop: ReadonlyArray<ApplyOutputDropPlacement>;
	}
}

const applyOutputDropPlacementFx = Effect.fn("applyOutputDropPlacementFx")(function* ({
	drop,
	overflow,
	excludedLocations,
	origin,
	runtime,
}: Omit<ApplyOutputPlacementProps, "output"> & {
	readonly drop: outputFx.Result["drop"][number];
}) {
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
			results: [] as applyPlacementPlanFx.Result[],
			discarded: [] as planBestEffortDropPlacementFx.Discarded[],
		}),
		(state, resolvedDrop) =>
			Effect.gen(function* () {
				const props = {
					drop: resolvedDrop,
					excludedLocations,
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

				const [result, draft] = yield* applyPlacementPlanFx({
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
						result,
					],
				};
			}),
	);

	return [
		{
			drop,
			placement: {
				remove: placement.results.flatMap(({ remove }) => remove),
				spawn: placement.results.flatMap(({ spawn }) => spawn),
			},
		} satisfies ApplyOutputDropPlacement,
		placement.draft,
		placement.discarded,
	] as const;
});

/**
 * Applies one already resolved output to one explicit runtime draft.
 *
 * Optional excluded locations constrain every spawn candidate
 * without changing the authored output or selecting a replacement destination.
 * Drops are planned and applied in authored result order against the evolving
 * draft, so an earlier spawn consumes capacity seen by later drops.
 * Every quantity unit in a random Board drop plans from its own random origin.
 * This function does not publish; its enclosing runtime command owns all-or-nothing
 * commit of the complete output.
 */
export const applyOutputPlacementFx = Effect.fn("applyOutputPlacementFx")(function* ({
	overflow,
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
			discarded: [] as planBestEffortDropPlacementFx.Discarded[],
		}),
		(state, drop) =>
			Effect.map(
				applyOutputDropPlacementFx({
					drop,
					overflow,
					excludedLocations,
					origin,
					runtime: state.draft,
				}),
				([result, draft, discarded]) => ({
					discarded: [
						...state.discarded,
						...discarded,
					],
					draft,
					results: [
						...state.results,
						result,
					],
				}),
			),
	);

	return [
		{
			drop: placement.results,
			...(overflow === "discard"
				? {
						discarded: placement.discarded,
					}
				: {}),
		} satisfies applyOutputPlacementFx.Result,
		placement.draft,
	] as const;
});
