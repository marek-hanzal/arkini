import { Effect } from "effect";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { readDropItemPreviewFx } from "~/engine/runtime/read/readDropItemPreviewFx";

export namespace readTileDropPreviewFx {
	export interface Props extends readDropItemPreviewFx.Props {
		readonly game: GameEngine;
	}

	export type Result = readDropItemPreviewFx.Result;
}

/** Reads one exact engine-owned drop preview through the renderer bridge. */
export const readTileDropPreviewFx = Effect.fn("readTileDropPreviewFx")(
	({ game, ...props }: readTileDropPreviewFx.Props) =>
		Effect.sync(
			(): readTileDropPreviewFx.Result => game.readOrThrow(readDropItemPreviewFx(props)),
		),
);
