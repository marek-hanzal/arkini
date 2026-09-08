import { Effect } from "effect";

import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import type { outputFx } from "~/production-output/fx/outputFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { StorageSchema } from "~/item-definition/schema/StorageSchema";
import { PlacementSchema } from "~/item-placement/schema/PlacementSchema";
import { resolveItemFx } from "~/item-resolution/fx/resolveItemFx";
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

const applyOutputDropPlacementFx = Effect.fn("applyOutputDropPlacementFx")(function* ({
	drop,
	excludedLocations,
	origin,
	runtime,
}: Omit<ApplyOutputPlacementProps, "output"> & {
	readonly drop: outputFx.Result["drop"][number];
}) {
	const item = yield* resolveItemFx({
		itemId: drop.itemId,
	});
	const usesRandomBoardPlacement =
		origin.scope === "board" &&
		drop.placement === PlacementSchema.enum.Random &&
		(item.scope === StorageSchema.enum.Board || item.scope === StorageSchema.enum.Any);
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
		}),
		(state, resolvedDrop) =>
			Effect.gen(function* () {
				const plan = yield* planDropPlacementFx({
					drop: resolvedDrop,
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
				stack: placement.results.flatMap(({ stack }) => stack),
			},
		} satisfies ApplyOutputDropPlacement,
		placement.draft,
	] as const;
});

/**
 * Applies one already resolved output to one explicit runtime draft.
 *
 * Optional excluded locations constrain every normal stack and spawn candidate
 * without changing the authored output or selecting a replacement destination.
 * Drops are planned and applied in authored result order against the evolving
 * draft, so an earlier stack or spawn consumes capacity seen by later drops.
 * Every quantity unit in a random Board drop plans from its own random origin.
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
		(state, drop) =>
			Effect.map(
				applyOutputDropPlacementFx({
					drop,
					excludedLocations,
					origin,
					runtime: state.draft,
				}),
				([result, draft]) => ({
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
		} satisfies applyOutputPlacementFx.Result,
		placement.draft,
	] as const;
});
