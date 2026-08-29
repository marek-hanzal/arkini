import { Effect } from "effect";

import type { GameEngine } from "~/renderer/game/GameEngine";
import { removeCheatItemFx as removeEngineCheatItemFx } from "~/engine/cheat/write/removeCheatItemFx";
import type { TileActorItem } from "~/ui/pixi/actor/TileActorItem";

export namespace removeCheatItemFx {
	export interface Props {
		readonly game: GameEngine;
		readonly sourceItem: TileActorItem;
	}
}

/** Removes one already-rebased dragged item through the cheat-authorized engine command. */
export const removeCheatItemFx = Effect.fn("removeCheatItemFx")(
	({ game, sourceItem }: removeCheatItemFx.Props) =>
		game
			.runFx(
				removeEngineCheatItemFx({
					itemId: sourceItem.id,
					revision: sourceItem.revision,
				}),
			)
			.pipe(
				Effect.as(true),
				Effect.catch(() => Effect.succeed(false)),
			),
);
