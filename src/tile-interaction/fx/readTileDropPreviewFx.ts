import { Effect } from "effect";

import type { GameEngine } from "~/playable-game/type/GameEngine";
import { readDropItemPreviewFx } from "~/item-interaction/fx/readDropItemPreviewFx";
import type { DropItemCommand } from "~/item-interaction/type/DropItemCommand";

interface Props extends DropItemCommand {
	readonly game: GameEngine;
}

/**
 * Reads one exact engine-owned drop preview through the mounted game capability.
 * Renderer occupancy or drag geometry must never manufacture drop legality.
 */
export const readTileDropPreviewFx = Effect.fn("readTileDropPreviewFx")(
	({ game, ...props }: Props) =>
		Effect.sync(
			(): readDropItemPreviewFx.Result => game.readOrThrowFn(readDropItemPreviewFx(props)),
		),
);
