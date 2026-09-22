import { Effect, Option } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { applyOutputPlacementFx } from "~/item-placement/fx/applyOutputPlacementFx";
import { narrowBoardRuntimeItemFn } from "~/game-runtime/fn/narrowBoardRuntimeItemFn";

interface ReadOutputPlacementItemEventsProps {
	readonly originItemId: IdSchema.Type;
	readonly placement: applyOutputPlacementFx.Result;
}

/** Translates concrete placement results into exact committed spawn facts. */
export const readOutputPlacementItemEventsFx = Effect.fn("readOutputPlacementItemEventsFx")(
	function* ({ originItemId, placement }: ReadOutputPlacementItemEventsProps) {
		const events: GameEventSchema.Type[] = [];
		for (const drop of placement.drop) {
			for (const runtimeItem of drop.placement.spawn) {
				const item = Option.getOrUndefined(narrowBoardRuntimeItemFn(runtimeItem));
				if (item === undefined) {
					return yield* Effect.die(
						new Error(
							`Output placement spawned ${runtimeItem.id} outside a visible grid scope.`,
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
