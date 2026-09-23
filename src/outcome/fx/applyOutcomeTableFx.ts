import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { Effect } from "effect";
import type { resolveOutcomeTableFx } from "./resolveOutcomeTableFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import type { planBestEffortDropPlacementFx } from "~/item-placement/fx/planBestEffortDropPlacementFx";
import type { applyItemOutcomeFx } from "./applyItemOutcomeFx";
import { applyOutcomeRollFx } from "./applyOutcomeRollFx";

export namespace applyOutcomeTableFx {
	export interface Props {
		readonly outcome: resolveOutcomeTableFx.Result;
		readonly runtime: RuntimeSchema.Type;
		readonly overflow?: "discard";
		readonly excludedLocations?: readonly BoardLocationSchema.Type[];
	}
	export interface Result {
		readonly events?: readonly GameEventSchema.Type[];
		readonly item: readonly applyItemOutcomeFx.Placement[];
		readonly discarded?: readonly planBestEffortDropPlacementFx.Discarded[];
	}
}

/** Applies resolved rolls in authored order without publishing a partial operation. */
export const applyOutcomeTableFx = Effect.fn("applyOutcomeTableFx")(function* ({
	outcome,
	runtime,
	overflow,
	excludedLocations,
}: applyOutcomeTableFx.Props) {
	let draft = runtime;
	const events: GameEventSchema.Type[] = [];
	const item: applyItemOutcomeFx.Placement[] = [];
	const discarded: planBestEffortDropPlacementFx.Discarded[] = [];
	for (const roll of outcome.roll) {
		const result = yield* applyOutcomeRollFx({
			roll,
			runtime: draft,
			overflow,
			excludedLocations,
		});
		draft = result.runtime;
		events.push(...result.events);
		item.push(...result.item);
		discarded.push(...result.discarded);
	}
	const survivingIds = new Set(draft.items.map((entry) => entry.id));
	return [
		{
			item: item.map((entry) => ({
				...entry,
				placement: {
					spawn: entry.placement.spawn.filter((spawn) => survivingIds.has(spawn.id)),
				},
			})),
			...(events.length === 0
				? {}
				: {
						events,
					}),
			...(overflow === "discard"
				? {
						discarded,
					}
				: {}),
		} satisfies applyOutcomeTableFx.Result,
		draft,
	] as const;
});
