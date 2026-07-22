import { Effect } from "effect";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { readTileActorsFx } from "~/bridge/tile/readTileActorsFx";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import type { CommittedTransitionSchema } from "~/engine/runtime/schema/CommittedTransitionSchema";

export namespace readTileActorTransitionFx {
	export interface Props {
		readonly game: GameEngine;
		readonly transition: CommittedTransitionSchema.Type;
	}

	export interface Result {
		readonly sequence: number;
		readonly previousItems: ReadonlyArray<TileActorItem> | null;
		readonly liveItems: ReadonlyArray<TileActorItem>;
		readonly events: ReadonlyArray<GameEventSchema.Type>;
	}
}

/** Projects one exact committed transition for deterministic tile presentation. */
export const readTileActorTransitionFx = Effect.fn("readTileActorTransitionFx")(function* ({
	game,
	transition,
}: readTileActorTransitionFx.Props) {
	const previousItems =
		transition.previousRuntime === null
			? null
			: yield* readTileActorsFx({ game, runtime: transition.previousRuntime });
	const liveItems = yield* readTileActorsFx({ game, runtime: transition.runtime });

	return {
		sequence: transition.sequence,
		previousItems,
		liveItems,
		events: transition.events,
	} satisfies readTileActorTransitionFx.Result;
});
