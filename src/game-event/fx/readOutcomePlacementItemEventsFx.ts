import { Effect, Option } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { applyOutcomeTableFx } from "~/outcome/fx/applyOutcomeTableFx";
import { narrowBoardRuntimeItemFn } from "~/game-runtime/fn/narrowBoardRuntimeItemFn";

interface ReadOutcomePlacementItemEventsProps {
	readonly originItemId: IdSchema.Type;
	readonly placement: applyOutcomeTableFx.Result;
}

/** Translates concrete placement results into exact committed spawn facts. */
export const readOutcomePlacementItemEventsFx = Effect.fn("readOutcomePlacementItemEventsFx")(
	function* ({ originItemId, placement }: ReadOutcomePlacementItemEventsProps) {
		const events: GameEventSchema.Type[] = [];
		for (const drop of placement.item) {
			for (const runtimeItem of drop.placement.spawn) {
				const item = Option.getOrUndefined(narrowBoardRuntimeItemFn(runtimeItem));
				if (item === undefined) {
					return yield* Effect.die(
						new Error(
							`Outcome placement spawned ${runtimeItem.id} outside a visible grid scope.`,
						),
					);
				}
				events.push({
					type: GameEventEnumSchema.enum.ItemSpawned,
					itemId: item.id,
					canonicalItemId: item.item.id,
					originItemId,
					location: item.location,
				});
			}
		}
		return events;
	},
);
