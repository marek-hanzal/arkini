import { Effect } from "effect";

import type { GameEngine } from "~/renderer/game/GameEngine";
import { readDropItemPreviewFx } from "~/item-interaction/fx/readDropItemPreviewFx";

interface Props extends readDropItemPreviewFx.Props {
	readonly game: GameEngine;
}

export namespace readTileDropPreviewFx {
	export type Result = readDropItemPreviewFx.Result;
}

/**
 * Reads one exact engine-owned drop preview through the mounted game capability.
 * Renderer occupancy or drag geometry must never manufacture drop legality.
 */
export const readTileDropPreviewFx = Effect.fn("readTileDropPreviewFx")(
	({ game, ...props }: Props) =>
		Effect.sync(
			(): readTileDropPreviewFx.Result => game.readOrThrow(readDropItemPreviewFx(props)),
		),
);
